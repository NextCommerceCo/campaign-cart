#!/usr/bin/env node
/**
 * Generates the docs site's version index — `docs/site/versions.json` and the
 * `docs/site/index.html` redirect that sends a bare visit to `latest/`.
 *
 * The SDK is version-pinned by the pages that load it (`public/loader.js` serves
 * `cdn.jsdelivr.net/gh/NextCommerceCo/campaign-cart@v{version}/dist`), so a page pinned
 * to `v0.4.28` needs docs that describe `v0.4.28`. One built folder per released tag,
 * a `latest` alias, and this file as the switcher's directory.
 *
 * `versions.json` is generated, never hand-kept — `src/tests/docs/docsVersions.test.ts`
 * fails when the committed shape drifts from what this script produces.
 *
 * Usage:
 *   node scripts/docs-versions.mjs                # write docs/site/{versions.json,index.html}
 *   node scripts/docs-versions.mjs --print        # print the JSON, write nothing
 *   node scripts/docs-versions.mjs --all          # list every eligible tag, built or not
 *   node scripts/docs-versions.mjs --out <dir>    # site root other than docs/site
 *
 * Reads tags with `git for-each-ref refs/tags`, not `git tag` — `git tag` is on the
 * agent permission deny list in `.claude/settings.json` because it can create tags,
 * while `for-each-ref` is read-only and sorts by version natively.
 */

import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Oldest tag that gets a versioned docs build.
 *
 * **The whole `0.4` line** (Bond, 2026-07-31). Every `v0.4.x` release gets docs; `v0.3.x`
 * gets none, and a reader on one lands on `latest` with the stale banner.
 *
 * Known cost, accepted: the guide docs arrived in `v0.4.3` (97 markdown pages, up from 3
 * in `v0.4.2` and 0 before it), so `v0.4.0` and `v0.4.1` build an API-only site with an
 * empty Guides tree and `v0.4.2` has three pages in it. They are still the truthful docs
 * for a page pinned to those versions, which is the point of publishing per tag.
 *
 * Override per-invocation with `--floor <tag>`; change the default only when the oldest
 * supported release moves.
 */
export const VERSION_FLOOR = 'v0.4.0';

/** Default site root. Gitignored — the build output is never committed. */
export const DEFAULT_SITE_ROOT = 'docs/site';

/** `v1.2.3` / `v1.2.3-beta.1`. Anything else is not a release tag we document. */
const TAG_RE = /^v(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/;

/** Parses a release tag into a comparable shape, or `null` if it is not one. */
export function parseTag(tag) {
  const m = TAG_RE.exec(tag);
  if (!m) return null;
  return {
    tag,
    version: tag.slice(1),
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    prerelease: m[4] ?? null,
  };
}

/** Newest first. A prerelease sorts below the release it precedes. */
export function compareDesc(a, b) {
  if (a.major !== b.major) return b.major - a.major;
  if (a.minor !== b.minor) return b.minor - a.minor;
  if (a.patch !== b.patch) return b.patch - a.patch;
  if (a.prerelease === b.prerelease) return 0;
  if (a.prerelease === null) return -1;
  if (b.prerelease === null) return 1;
  return b.prerelease.localeCompare(a.prerelease);
}

/** All release tags in the repo, newest first. */
export function listReleaseTags(cwd = REPO) {
  const out = execFileSync(
    'git',
    ['for-each-ref', '--format=%(refname:short)', 'refs/tags'],
    { cwd, encoding: 'utf8' }
  );
  return out
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(parseTag)
    .filter(Boolean)
    .sort(compareDesc);
}

/** `package.json`'s `version` — the working tree's version, tagged or not. */
export function packageVersion(cwd = REPO) {
  return JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8')).version;
}

/**
 * Builds the version index.
 *
 * `current: true` marks the newest release — the one `latest/` aliases. When
 * `package.json`'s version has no tag yet (an unreleased bump), it is *not* added as a
 * version: nothing is built for it and a switcher entry pointing at a missing folder is
 * a 404. It surfaces as `unreleased` on the returned metadata instead.
 *
 * @param options.floor      oldest tag to include (default {@link VERSION_FLOOR})
 * @param options.root       absolute site root; entries without a built folder there are
 *                           dropped unless `all` is set
 * @param options.all        include every eligible tag regardless of what is built
 */
export function buildVersionIndex({
  floor = VERSION_FLOOR,
  root = join(REPO, DEFAULT_SITE_ROOT),
  all = false,
  cwd = REPO,
} = {}) {
  const floorTag = parseTag(floor);
  if (!floorTag) throw new Error(`Not a release tag: ${floor}`);

  const eligible = listReleaseTags(cwd).filter(
    t => compareDesc(t, floorTag) <= 0
  );
  const built = t => {
    const dir = join(root, t.tag);
    return existsSync(dir) && statSync(dir).isDirectory();
  };
  const included = all ? eligible : eligible.filter(built);

  const versions = included.map((t, i) => ({
    version: t.version,
    tag: t.tag,
    path: t.tag,
    current: i === 0,
  }));

  const pkg = packageVersion(cwd);
  return {
    versions,
    floor: floorTag.tag,
    packageVersion: pkg,
    eligible: eligible.map(t => t.tag),
    skipped: all ? [] : eligible.filter(t => !built(t)).map(t => t.tag),
    unreleased: eligible.some(t => t.version === pkg) ? null : pkg,
  };
}

/** The `docs/site/index.html` redirect. Static, offline, no framework. */
export function renderRootRedirect(target = 'latest/') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Campaign Cart SDK documentation</title>
<meta name="robots" content="noindex" />
<link rel="canonical" href="${target}" />
<meta http-equiv="refresh" content="0; url=${target}" />
<style>
  body { font: 16px/1.6 system-ui, sans-serif; margin: 4rem auto; max-width: 32rem; padding: 0 1rem; }
</style>
</head>
<body>
<p>Redirecting to the latest documentation…</p>
<p><a href="${target}">Continue to the latest Campaign Cart SDK documentation</a></p>
<script>
  // Replace rather than push, so Back does not bounce off this page. The hash is
  // carried over so a deep link into a heading survives the redirect.
  location.replace('${target}' + location.hash);
</script>
</body>
</html>
`;
}

function parseArgs(argv) {
  const opts = { print: false, all: false, root: null, floor: VERSION_FLOOR };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--print') opts.print = true;
    else if (arg === '--all') opts.all = true;
    else if (arg === '--out') opts.root = argv[++i];
    else if (arg === '--floor') opts.floor = argv[++i];
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return opts;
}

const USAGE = `Usage: node scripts/docs-versions.mjs [--print] [--all] [--out <dir>] [--floor <tag>]

  --print        Print versions.json to stdout and write nothing.
  --all          Include every tag at or above the floor, even if not built yet.
  --out <dir>    Site root to inspect and write into (default ${DEFAULT_SITE_ROOT}).
  --floor <tag>  Oldest tag to include (default ${VERSION_FLOOR}).
`;

function main(argv) {
  const opts = parseArgs(argv);
  if (opts.help) {
    process.stdout.write(USAGE);
    return 0;
  }

  const root = resolve(opts.root ?? join(REPO, DEFAULT_SITE_ROOT));
  const index = buildVersionIndex({ floor: opts.floor, root, all: opts.all });
  const json = `${JSON.stringify(index.versions, null, 2)}\n`;

  if (opts.print) {
    process.stdout.write(json);
    return 0;
  }

  if (index.versions.length === 0) {
    process.stderr.write(
      `No built version folders found under ${root}.\n` +
        `Build one first:  npm run docs:version -- v${index.packageVersion}\n` +
        `Or list every eligible tag without building:  npm run docs:versions -- --all\n`
    );
    return 1;
  }

  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, 'versions.json'), json);
  writeFileSync(join(root, 'index.html'), renderRootRedirect());

  const current = index.versions[0];
  process.stdout.write(
    `versions.json: ${index.versions.length} version(s), current ${current.tag}\n` +
      `index.html: redirect to latest/\n`
  );
  if (index.skipped.length > 0) {
    process.stdout.write(
      `not built, omitted: ${index.skipped.join(', ')}\n` +
        `  build them with: npm run docs:version -- <tag>\n`
    );
  }
  if (index.unreleased) {
    process.stdout.write(
      `package.json is at ${index.unreleased}, which has no tag yet — not listed.\n`
    );
  }
  if (!existsSync(join(root, 'latest'))) {
    process.stderr.write(
      `warning: ${join(root, 'latest')} does not exist, so index.html redirects nowhere.\n` +
        `  npm run docs:version -- ${current.tag}   creates it.\n`
    );
  }
  return 0;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exit(1);
  }
}
