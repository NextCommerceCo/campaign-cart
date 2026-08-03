#!/usr/bin/env node
/**
 * Assembles the publishable docs site and checks it against Cloudflare's limits.
 *
 * Builds one folder per released tag (via `docs-build-version.mjs`) plus one for the
 * unreleased branch tip, turns `latest` into a real directory, writes the files
 * Cloudflare reads (`_headers`, `robots.txt`, `404.html`), then counts what would be
 * uploaded and fails if it does not fit.
 *
 * It never deploys — deploying is a human's command, never an agent's. The last thing it
 * prints is the command a human runs; see `docs/wrangler.jsonc` for the target.
 *
 * Usage:
 *   node scripts/docs-publish.mjs                # every eligible tag + main, check
 *   node scripts/docs-publish.mjs --versions 10  # newest 10 tags only
 *   node scripts/docs-publish.mjs --no-branch    # releases only, no unreleased folder
 *   node scripts/docs-publish.mjs --skip-build   # assemble what is already built
 *   node scripts/docs-publish.mjs --rebuild      # rebuild folders that exist
 *   node scripts/docs-publish.mjs --base-url https://…
 *
 * Options:
 *   --out <dir>        Site root (default `docs/site`).
 *   --versions <n>     Publish the newest N eligible tags instead of all of them.
 *   --branch <name>    Branch whose tip is published as the unreleased docs
 *                      (default `main`). Always rebuilt — a branch tip moves.
 *   --no-branch        Publish released tags only.
 *   --floor <tag>      Oldest tag to publish (default `VERSION_FLOOR`).
 *   --base-url <url>   Public site root. Passed to each version build as
 *                      `hostedBaseUrl`, and switches `robots.txt` from "index
 *                      nothing" to "index the current version". Also read from
 *                      `DOCS_BASE_URL`.
 *   --skip-build       Do not run TypeDoc; assemble and check what is on disk.
 *   --rebuild          Rebuild version folders that already exist.
 *   --free-plan        Check against the 20,000-file free-plan ceiling, not 100,000.
 *
 * Why `latest/` is copied rather than symlinked: Wrangler walks the asset
 * directory with `lstat`, so a symlinked directory is not uploaded — the same
 * caveat §8.1 of docs/documentation-plan.md flagged for GitHub Pages. One extra
 * copy of the newest version costs a few hundred files against a 100,000
 * ceiling, which is the cheapest possible way to stop being clever about it.
 */

import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_SITE_ROOT,
  VERSION_FLOOR,
  buildVersionIndex,
  compareDesc,
  listReleaseTags,
  parseTag,
} from './docs-versions.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Cloudflare asset limits, current as of 2026-07-31.
 *
 * Workers static assets: 20,000 files on the free plan, 100,000 on paid (needs
 * Wrangler >= 4.34.0), 25 MiB per file. Cloudflare Pages caps every plan at 20,000,
 * which is why this site is not on Pages — see `docs/wrangler.jsonc`.
 * https://developers.cloudflare.com/workers/static-assets/
 */
const LIMITS = {
  filesPaid: 100_000,
  filesFree: 20_000,
  bytesPerFile: 25 * 1024 * 1024,
};

/**
 * Branch published as the unreleased docs, in a folder of its own name.
 *
 * Readers land on `latest/` for the SDK they load and on `main/` for what is merged but
 * not tagged yet. It is deliberately the *branch name* rather than `next` or `canary`:
 * `next` is the product's own word (`data-next-*`, `window.next`, 29next), so `/next/`
 * would read as "the Next docs" instead of "the unreleased docs", and `canary`/`nightly`
 * promise a build cadence nothing here provides.
 *
 * Never indexed and never `latest/` — see {@link renderRobots}.
 */
const DEFAULT_BRANCH = 'main';

/** Repo-relative for readability, absolute once the path leaves the repo. */
const short = path => {
  const rel = relative(REPO, path);
  return rel && !rel.startsWith('..') ? rel : path;
};

const mib = bytes => `${(bytes / 1024 / 1024).toFixed(1)} MiB`;

/**
 * Root files this script writes. Together with the version folders, `latest/`, and
 * `docs-versions.mjs`'s `index.html` + `versions.json`, this is the whole published
 * tree — anything else found at the root is pruned before the preflight.
 */
const ROOT_FILES = ['_headers', 'robots.txt', '404.html'];

function parseArgs(argv) {
  const opts = {
    root: null,
    versions: null,
    branch: DEFAULT_BRANCH,
    floor: VERSION_FLOOR,
    baseUrl: process.env.DOCS_BASE_URL ?? null,
    skipBuild: false,
    rebuild: false,
    freePlan: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--out') opts.root = argv[++i];
    else if (arg === '--versions') opts.versions = Number(argv[++i]);
    else if (arg === '--branch') opts.branch = argv[++i];
    else if (arg === '--no-branch') opts.branch = null;
    else if (arg === '--floor') opts.floor = argv[++i];
    else if (arg === '--base-url') opts.baseUrl = argv[++i];
    else if (arg === '--skip-build') opts.skipBuild = true;
    else if (arg === '--rebuild') opts.rebuild = true;
    else if (arg === '--free-plan') opts.freePlan = true;
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (
    opts.versions !== null &&
    !(Number.isInteger(opts.versions) && opts.versions > 0)
  )
    throw new Error('--versions takes a positive integer');
  return opts;
}

/** Runs one of this folder's scripts, inheriting stdio. Throws on a non-zero exit. */
function runScript(script, args) {
  const result = spawnSync(
    process.execPath,
    [join(REPO, 'scripts', script), ...args],
    {
      cwd: REPO,
      stdio: 'inherit',
    }
  );
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(
      `${script} ${args.join(' ')} exited with code ${result.status}`
    );
}

/** Every file under `dir`, with its size. Symlinks are reported, not followed. */
function walk(dir, out = { files: [], symlinks: [], bytes: 0 }) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isSymbolicLink()) out.symlinks.push(path);
    else if (entry.isDirectory()) walk(path, out);
    else if (entry.isFile()) {
      const { size } = lstatSync(path);
      out.files.push({ path, size });
      out.bytes += size;
    }
  }
  return out;
}

/**
 * Response headers for every asset.
 *
 * One `/*` block on purpose. Matching rules are *merged*, not overridden — a
 * second block naming `Cache-Control` would produce `max-age=31536000, …,
 * max-age=300` rather than replacing it — so per-folder cache tuning needs
 * non-overlapping patterns, and the version folders and `latest/` overlap by
 * definition.
 *
 * No `Content-Security-Policy`: TypeDoc emits inline `<script>` blocks on every
 * page, so any useful policy would need `unsafe-inline` and buy nothing.
 */
const HEADERS = `# Generated by scripts/docs-publish.mjs — edit that, not this.
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Cache-Control: public, max-age=300, stale-while-revalidate=86400
`;

/**
 * `robots.txt`.
 *
 * With no public domain the whole site is off-limits — a `workers.dev` hostname
 * indexing 31 near-identical copies of the same docs is worse than not being
 * found at all.
 *
 * With one, the *current version folder* is what gets indexed, not `latest/`.
 * `latest/` is a byte copy of that folder, so its pages carry
 * `<link rel="canonical">` pointing at `/v<current>/` — TypeDoc stamped them
 * during that version's build. Excluding `/v<current>/` would therefore disallow
 * the exact URLs every indexable page nominates, which is why only the *older*
 * folders are excluded.
 *
 * The unreleased branch folder is disallowed outright, whatever the current version
 * is: it documents code no page loads, and it changes under the same URL on every
 * publish, so an indexed copy is stale the moment it is crawled.
 *
 * The `Sitemap:` line is emitted only when TypeDoc actually wrote one — it does
 * that solely when `hostedBaseUrl` was set, so assembling with `--base-url` over
 * folders built without it must not advertise a file that is not there.
 */
function renderRobots(versions, baseUrl, root, branch) {
  if (!baseUrl) {
    return `# No public domain configured yet — see docs/wrangler.jsonc.
# Regenerate with: npm run docs:publish -- --base-url https://<host>
User-agent: *
Disallow: /
`;
  }
  const current = versions.find(v => v.current) ?? versions[0];
  const stale = versions.filter(v => v !== current);
  const lines = [
    '# Generated by scripts/docs-publish.mjs — edit that, not this.',
    '# Older releases are duplicate content; every page canonicalises to the current one.',
    '# The unreleased branch folder is never indexed — it describes no released SDK.',
    'User-agent: *',
    ...stale.map(v => `Disallow: /${v.path}/`),
    ...(branch ? [`Disallow: /${branch}/`] : []),
  ];
  if (current && existsSync(join(root, current.path, 'sitemap.xml')))
    lines.push(
      '',
      `Sitemap: ${baseUrl.replace(/\/+$/, '')}/${current.path}/sitemap.xml`
    );
  return `${lines.join('\n')}\n`;
}

/**
 * The page Cloudflare serves for any path with no asset (`not_found_handling:
 * "404-page"`).
 *
 * Links are root-absolute. A 404 body is served *at the URL that missed*, so a relative
 * link would resolve against that path and point at nothing — the one place on
 * this site where relative links are wrong.
 */
function render404(versions, branch) {
  const items = [
    ...versions.map(
      v =>
        `<li><a href="/${v.path}/">${v.version}</a>${v.current ? ' — current' : ''}</li>`
    ),
    ...(branch
      ? [`<li><a href="/${branch}/">${branch}</a> — unreleased</li>`]
      : []),
  ].join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Page not found — Campaign Cart SDK documentation</title>
<meta name="robots" content="noindex" />
<style>
  body { font: 16px/1.6 system-ui, sans-serif; margin: 4rem auto; max-width: 40rem; padding: 0 1rem; }
  h1 { font-size: 1.5rem; }
  ul { padding-left: 1.2rem; }
  code { background: #f4f4f5; padding: 0.1em 0.3em; border-radius: 3px; }
  @media (prefers-color-scheme: dark) {
    body { background: #1c1e21; color: #e8e8e8; }
    a { color: #79b8ff; }
    code { background: #2b2d31; }
  }
</style>
</head>
<body>
<h1>Page not found</h1>
<p>
  This documentation is published one folder per released SDK version, so a link that
  worked on one version can be missing on another — pages get renamed between releases.
</p>
<p><a href="/latest/">Go to the latest documentation</a></p>
<h2>All published versions</h2>
<ul>
${items}
</ul>
</body>
</html>
`;
}

const USAGE = `Usage: node scripts/docs-publish.mjs [options]

  --out <dir>        Site root (default ${DEFAULT_SITE_ROOT}).
  --versions <n>     Publish the newest N eligible tags instead of all of them.
  --branch <name>    Branch published as the unreleased docs (default ${DEFAULT_BRANCH}).
  --no-branch        Publish released tags only.
  --floor <tag>      Oldest tag to publish (default ${VERSION_FLOOR}).
  --base-url <url>   Public site root: sets hostedBaseUrl per version and lets
                     robots.txt allow indexing of latest/.
  --skip-build       Assemble and check what is already built.
  --rebuild          Rebuild version folders that already exist.
  --free-plan        Check against the 20,000-file free-plan ceiling.
`;

function main(argv) {
  const opts = parseArgs(argv);
  if (opts.help) {
    process.stdout.write(USAGE);
    return 0;
  }

  const root = resolve(opts.root ?? join(REPO, DEFAULT_SITE_ROOT));
  const floorTag = parseTag(opts.floor);
  if (!floorTag) throw new Error(`--floor is not a release tag: ${opts.floor}`);

  let tags = listReleaseTags().filter(t => compareDesc(t, floorTag) <= 0);
  if (tags.length === 0)
    throw new Error(
      `No release tags at or above ${floorTag.tag} in this repository.`
    );
  if (opts.versions !== null) tags = tags.slice(0, opts.versions);

  mkdirSync(root, { recursive: true });

  // 1. One folder per tag. `--no-latest` because step 2 owns that alias, and
  //    `--skip-existing` because a released tag's docs never change once built.
  if (opts.skipBuild) {
    process.stdout.write(
      `--skip-build: using the folders already in ${short(root)}\n\n`
    );
  } else {
    process.stdout.write(
      `Building ${tags.length} version(s) into ${short(root)}\n\n`
    );
    for (const tag of tags) {
      const args = [
        tag.tag,
        '--out',
        root,
        '--floor',
        floorTag.tag,
        '--no-latest',
      ];
      if (!opts.rebuild) args.push('--skip-existing');
      if (opts.baseUrl) args.push('--base-url', opts.baseUrl);
      runScript('docs-build-version.mjs', args);
    }
    // 1b. The unreleased branch folder. Never `--skip-existing`: a tag's docs are frozen
    //     once built, a branch tip is not, so a stale `main/` is the one folder that can
    //     silently misdescribe the code it names.
    if (opts.branch) {
      const args = ['--branch', opts.branch, '--out', root];
      if (opts.baseUrl) args.push('--base-url', opts.baseUrl);
      runScript('docs-build-version.mjs', args);
    }
    process.stdout.write('\n');
  }

  const built = tags.filter(t => existsSync(join(root, t.tag)));
  if (built.length === 0)
    throw new Error(
      `Nothing to publish — no version folders under ${short(root)}.\n` +
        `Drop --skip-build, or build one with: npm run docs:version -- ${tags[0].tag}`
    );
  if (built.length < tags.length) {
    const missing = tags.filter(t => !built.includes(t)).map(t => t.tag);
    process.stdout.write(`not built, excluded: ${missing.join(', ')}\n`);
  }

  // 2. `latest/` as a real directory — see the header comment on why not a symlink.
  const newest = built[0];
  const latest = join(root, 'latest');
  rmSync(latest, { recursive: true, force: true });
  cpSync(join(root, newest.tag), latest, { recursive: true });
  process.stdout.write(`latest/ -> copy of ${newest.tag}\n`);

  // A `--skip-build` run over folders built before this flag existed has no branch folder;
  // robots.txt and 404.html must not point at one that is not there.
  const branchFolder =
    opts.branch && existsSync(join(root, opts.branch)) ? opts.branch : null;
  if (opts.branch && !branchFolder)
    process.stdout.write(
      `${opts.branch}/ not built, excluded — drop --skip-build to build it.\n`
    );
  else if (branchFolder)
    process.stdout.write(`${branchFolder}/ -> unreleased branch tip\n`);

  // 3. Everything else at the root goes. `dev/` is built from the working tree and is
  //    never published; a plain `npm run docs` leaves a whole unversioned site there
  //    (`classes/`, `documents/`, `hierarchy.html`, ~900 files) which would otherwise
  //    ship at the site root, describing no version in particular.
  const keep = new Set([
    ...built.map(t => t.tag),
    'latest',
    ...(branchFolder ? [branchFolder] : []),
    ...ROOT_FILES,
    'index.html',
    'versions.json',
  ]);
  const pruned = readdirSync(root)
    .filter(name => !keep.has(name))
    .sort();
  for (const name of pruned)
    rmSync(join(root, name), { recursive: true, force: true });
  if (pruned.length > 0)
    process.stdout.write(
      `removed from the site root: ${pruned.join(', ')}\n` +
        `  (only version folders, latest/, and the generated root files are published)\n`
    );

  // 4. versions.json + the root redirect, from what is actually on disk.
  runScript('docs-versions.mjs', ['--out', root, '--floor', floorTag.tag]);

  const { versions } = buildVersionIndex({ floor: floorTag.tag, root });

  // 5. What Cloudflare reads. `_headers` is consumed at deploy time, not served.
  writeFileSync(join(root, '_headers'), HEADERS);
  writeFileSync(
    join(root, 'robots.txt'),
    renderRobots(versions, opts.baseUrl, root, branchFolder)
  );
  writeFileSync(join(root, '404.html'), render404(versions, branchFolder));
  process.stdout.write(`wrote ${ROOT_FILES.join(', ')}\n\n`);

  // 6. Preflight. Failing here beats failing halfway through an upload.
  const { files, symlinks, bytes } = walk(root);
  const maxFiles = opts.freePlan ? LIMITS.filesFree : LIMITS.filesPaid;
  const plan = opts.freePlan ? 'free' : 'paid';
  const oversized = files.filter(f => f.size > LIMITS.bytesPerFile);
  const largest = files.reduce((a, b) => (b.size > a.size ? b : a), {
    size: 0,
    path: '',
  });

  process.stdout.write(
    `${short(root)}: ${versions.length} version(s) + latest${branchFolder ? ` + ${branchFolder}` : ''}\n` +
      `  files    ${files.length.toLocaleString()} / ${maxFiles.toLocaleString()} (${plan} plan)\n` +
      `  size     ${mib(bytes)}\n` +
      `  largest  ${mib(largest.size)} — ${short(largest.path)}\n`
  );

  const problems = [];
  if (files.length > maxFiles) {
    // `latest/` is a copy of one version and the branch folder is another whole build, so
    // the folder count is versions + 1 (+ 1), and the budget has to leave room for them.
    const folders = versions.length + 1 + (branchFolder ? 1 : 0);
    const perVersion = Math.ceil(files.length / folders);
    const fits = Math.max(1, Math.floor(maxFiles / perVersion) - 1);
    problems.push(
      `${files.length.toLocaleString()} files exceeds the ${maxFiles.toLocaleString()}-file ` +
        `limit on the ${plan} plan (~${perVersion.toLocaleString()} per version). ` +
        `Publish fewer: --versions ${fits}`
    );
  }
  for (const f of oversized)
    problems.push(
      `${short(f.path)} is ${mib(f.size)}, over the 25 MiB per-file limit.`
    );
  for (const link of symlinks)
    problems.push(
      `${short(link)} is a symlink. Wrangler does not upload symlinked paths, so it would ` +
        `be silently missing from the deployed site.`
    );
  if (problems.length > 0) {
    process.stderr.write(`\n${problems.map(p => `error: ${p}`).join('\n')}\n`);
    return 1;
  }

  if (!opts.freePlan && files.length > LIMITS.filesFree) {
    process.stdout.write(
      `\nnote: ${files.length.toLocaleString()} files needs the Workers **paid** plan ` +
        `(free stops at ${LIMITS.filesFree.toLocaleString()}) and Wrangler >= 4.34.0.\n` +
        `      Check with --free-plan.\n`
    );
  }
  if (!opts.baseUrl) {
    process.stdout.write(
      `\nnote: no --base-url, so canonical URLs and sitemap.xml are omitted and robots.txt\n` +
        `      disallows everything. Re-run with --base-url once the hostname is decided.\n`
    );
  }

  process.stdout.write(
    `\nReady. Nothing was deployed — that step is yours:\n\n` +
      `  npx wrangler deploy -c docs/wrangler.jsonc\n\n` +
      `Preview it locally first:  npm run docs:serve\n`
  );
  return 0;
}

try {
  process.exit(main(process.argv.slice(2)));
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exit(1);
}
