#!/usr/bin/env node
/**
 * Builds one folder of the versioned docs site.
 *
 * A released tag is checked out into a throwaway `git worktree`, this checkout's
 * `node_modules` is linked into it, and TypeDoc runs there with `out` pointing at
 * `<site>/v<version>`. The worktree is removed afterwards, including on failure.
 * `--branch <name>` builds a branch tip the same way, into `<site>/<name>`.
 * `--dev` skips the worktree and builds the working tree into `<site>/dev`.
 *
 * Usage:
 *   node scripts/docs-build-version.mjs v0.4.30        # one released version
 *   node scripts/docs-build-version.mjs --branch main  # branch tip -> <site>/main
 *   node scripts/docs-build-version.mjs --dev          # working tree -> <site>/dev
 *   node scripts/docs-build-version.mjs v0.4.30 --out /tmp/site --base-url https://…
 *
 * Options:
 *   --branch <name>      Build that branch's tip into `<site>/<name>` — the unreleased
 *                        docs. Not a release, so it never becomes `latest/` and never
 *                        enters `versions.json`; the in-page switcher offers it by name
 *                        (see `docs/assets/site.js`).
 *   --dev                Build the working tree into `<site>/dev`. Never published.
 *   --out <dir>          Site root (default `docs/site`).
 *   --base-url <url>     Site root URL. Sets TypeDoc `hostedBaseUrl` to
 *                        `<url>/<folder>/` so canonical links and the sitemap point at
 *                        the version they belong to. Also read from `DOCS_BASE_URL`.
 *                        Omitted by default — hosting is undecided, and a wrong
 *                        canonical URL is worse than none.
 *   --floor <tag>        Oldest tag allowed (default `VERSION_FLOOR` in
 *                        `docs-versions.mjs`). Below it the build refuses.
 *   --skip-existing      Leave an already-built folder alone instead of rebuilding.
 *   --no-latest          Do not point `<site>/latest` at this build.
 *   --strict             Keep `validation.invalidLink` on for a tag build.
 *
 * Why the tag's own `typedoc.json` is not used: no released tag has one, and the folder
 * layout moved (`src/enhancers` -> `src/features`, `src/stores` -> `src/state`). The
 * config is generated per build from this checkout's `typedoc.json` plus the layout
 * actually present in the worktree, so one script covers every tag.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  globSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_SITE_ROOT,
  VERSION_FLOOR,
  compareDesc,
  listReleaseTags,
  packageVersion,
  parseTag,
} from './docs-versions.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TYPEDOC_BIN = join(REPO, 'node_modules', '.bin', 'typedoc');

/** Repo-relative for readability, absolute once the path leaves the repo. */
const short = path => {
  const rel = relative(REPO, path);
  return rel && !rel.startsWith('..') ? rel : path;
};

/**
 * Entry-point and document globs, per layout generation.
 *
 * Both generations are listed and only the directories that exist in the worktree are
 * used, so the same config generator serves `v0.4.3` (`src/enhancers`, `src/stores`,
 * no `src/core/guide`) and today's tree (`src/features`, `src/state`, `src/core/guide`).
 */
const LAYOUTS = [
  { dir: 'src/core', entryPoint: true, documents: ['src/core/guide/**/*.md'] },
  {
    dir: 'src/state',
    entryPoint: true,
    documents: ['src/state/**/guide/*.md', 'src/state/**/guide/reference/*.md'],
  },
  {
    dir: 'src/stores',
    entryPoint: true,
    documents: [
      'src/stores/**/guide/*.md',
      'src/stores/**/guide/reference/*.md',
    ],
  },
  {
    dir: 'src/features',
    entryPoint: false,
    documents: [
      'src/features/**/guide/*.md',
      'src/features/**/guide/reference/*.md',
    ],
  },
  {
    dir: 'src/enhancers',
    entryPoint: false,
    documents: [
      'src/enhancers/**/guide/*.md',
      'src/enhancers/**/guide/reference/*.md',
    ],
  },
];

/**
 * Options whose paths must come from *this* checkout — no tag has `docs/assets/` or
 * `docs/site-home.md`, so resolving them against the worktree fails the build outright
 * ("Provided README path … could not be read", exit 4).
 *
 * `readme` also takes the literal `"none"`, which is a mode and not a path. Left alone.
 */
const ASSET_OPTIONS = ['customCss', 'customJs', 'readme'];

/**
 * Names a branch folder may not take, because the published site root already uses them.
 *
 * `latest/` is the alias for the current release, `dev/` is the working-tree build, and
 * the rest are the files `docs-publish.mjs` and `docs-versions.mjs` write at the root. A
 * tag-shaped branch name is rejected separately — `main` and a `v0.4.31` branch are not
 * the same kind of thing, and one folder cannot be both.
 */
const RESERVED_FOLDERS = new Set([
  'latest',
  'dev',
  '_headers',
  '404.html',
  'index.html',
  'robots.txt',
  'versions.json',
]);

function parseArgs(argv) {
  const opts = {
    tag: null,
    branch: null,
    dev: false,
    root: null,
    baseUrl: process.env.DOCS_BASE_URL ?? null,
    floor: VERSION_FLOOR,
    skipExisting: false,
    latest: true,
    strict: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dev') opts.dev = true;
    else if (arg === '--branch') opts.branch = argv[++i];
    else if (arg === '--out') opts.root = argv[++i];
    else if (arg === '--base-url') opts.baseUrl = argv[++i];
    else if (arg === '--floor') opts.floor = argv[++i];
    else if (arg === '--skip-existing') opts.skipExisting = true;
    else if (arg === '--no-latest') opts.latest = false;
    else if (arg === '--strict') opts.strict = true;
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`);
    else if (opts.tag)
      throw new Error(`Expected one tag, got "${opts.tag}" and "${arg}"`);
    else opts.tag = arg;
  }
  return opts;
}

/** Reads this checkout's `typedoc.json` as the base every version build starts from. */
function baseConfig() {
  const raw = JSON.parse(readFileSync(join(REPO, 'typedoc.json'), 'utf8'));
  delete raw.$schema;
  return raw;
}

/**
 * Turns the base config into one for a specific source tree.
 *
 * Every path in the result is absolute. TypeDoc resolves relative option paths against
 * the *options file*, not the working directory, and the options file does not always sit
 * at the root of the tree it describes — absolute paths remove that trap entirely.
 *
 * Document globs are kept only when they match a file. TypeDoc warns on a glob that
 * matches nothing, and with `--treatWarningsAsErrors` that would fail every tag whose
 * layout is a subset of today's.
 */
function versionConfig({
  base,
  sourceRoot,
  outDir,
  hostedBaseUrl,
  gitRevision,
  strict,
}) {
  const config = { ...base };
  const abs = path => join(sourceRoot, path);

  config.entryPoints = [abs('src/index.ts')];
  config.projectDocuments = [];
  for (const layout of LAYOUTS) {
    if (!existsSync(abs(layout.dir))) continue;
    if (layout.entryPoint) config.entryPoints.push(abs(layout.dir));
    for (const glob of layout.documents) {
      if (globSync(glob, { cwd: sourceRoot }).length > 0)
        config.projectDocuments.push(abs(glob));
    }
  }

  for (const key of ASSET_OPTIONS) {
    if (typeof config[key] === 'string' && config[key] !== 'none')
      config[key] = resolve(REPO, config[key]);
  }

  config.out = outDir;
  config.tsconfig = abs('tsconfig.json');
  if (gitRevision) config.gitRevision = gitRevision;
  if (hostedBaseUrl) config.hostedBaseUrl = hostedBaseUrl;

  // A released tag's markdown is frozen: a broken link in it cannot be fixed without
  // rewriting history, so link validation would make every historical build fail. The
  // gate that matters runs on the working tree (`npm run docs:check`).
  if (!strict) config.validation = { ...config.validation, invalidLink: false };

  return config;
}

/** Runs TypeDoc with a generated options file, inheriting stdio. */
function runTypedoc({ cwd, optionsFile }) {
  const result = spawnSync(TYPEDOC_BIN, ['--options', optionsFile], {
    cwd,
    stdio: 'inherit',
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`typedoc exited with code ${result.status}`);
}

/*
 * No asset-copy step here on purpose. TypeDoc emits only `customCss`/`customJs`, but the
 * one runtime asset the site needs beyond those — mermaid's ESM bundle — is copied into
 * `<outDir>/assets/mermaid/` by `@boneskull/typedoc-plugin-mermaid` itself, and only for
 * builds that actually contain a diagram. A tag whose guides have no mermaid block pays
 * nothing.
 */

/** Writes the generated options next to the sources it describes. */
function writeOptions(sourceRoot, config) {
  const file = join(sourceRoot, 'typedoc.version.json');
  writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
  return file;
}

/** `git rev-parse --short <ref>`, or `null` when the ref does not exist. */
function revParse(ref) {
  try {
    return execFileSync('git', ['rev-parse', '--verify', '--short', ref], {
      cwd: REPO,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

/** A ref's commit date as `YYYY-MM-DD`, for the line the build prints. */
function refDate(ref) {
  return execFileSync('git', ['log', '-1', '--format=%cs', ref], {
    cwd: REPO,
    encoding: 'utf8',
  }).trim();
}

/**
 * Resolves `--branch <name>` to a local branch, or throws with what to do about it.
 *
 * The name becomes a folder and a URL segment, so a branch with a slash in it
 * (`feature/offers`) cannot be built — it would nest a second level under the site root
 * that nothing else on the site knows about. Only the local branch is built: `origin/…`
 * is reported when it differs, but silently documenting a ref the reader never asked for
 * is worse than being one fetch behind.
 */
function resolveBranch(name) {
  if (!/^[A-Za-z0-9._-]+$/.test(name))
    throw new Error(
      `--branch ${name} cannot be a site folder: use a name of letters, digits, ` +
        `dot, dash or underscore. A branch with a slash needs a different folder name.`
    );
  if (RESERVED_FOLDERS.has(name))
    throw new Error(
      `--branch ${name} collides with a folder the published site already uses ` +
        `(${[...RESERVED_FOLDERS].join(', ')}).`
    );
  if (parseTag(name))
    throw new Error(
      `--branch ${name} is shaped like a release tag, and would overwrite that tag's ` +
        `version folder. Build the tag instead: ${name}`
    );

  const head = revParse(`refs/heads/${name}`);
  if (!head) {
    const remote = revParse(`refs/remotes/origin/${name}`);
    throw new Error(
      `No local branch "${name}" in this repository.` +
        (remote
          ? `\norigin/${name} exists at ${remote} — create the local branch first: ` +
            `git branch ${name} origin/${name}`
          : '')
    );
  }

  const remote = revParse(`refs/remotes/origin/${name}`);
  return { name, head, date: refDate(head), remote };
}

/**
 * Builds a committed ref — a tag or a branch tip — into `outDir`.
 *
 * The ref is checked out detached into a throwaway worktree so the build never touches the
 * working tree, and this checkout's `node_modules` is linked in rather than installed: old
 * tags predate today's lockfile, installing per ref would be minutes each and could
 * resolve differently every run. One known-good TypeDoc builds every folder.
 */
function buildRef({
  ref,
  slug,
  base,
  outDir,
  hostedBaseUrl,
  gitRevision,
  strict,
}) {
  const worktree = mkdtempSync(join(tmpdir(), `cc-docs-${slug}-`));
  // mkdtemp created it; `git worktree add` needs the path free.
  rmSync(worktree, { recursive: true, force: true });

  try {
    process.stdout.write(`Checking out ${ref} into ${worktree}\n`);
    execFileSync(
      'git',
      ['worktree', 'add', '--detach', '--quiet', worktree, ref],
      {
        cwd: REPO,
        stdio: 'inherit',
      }
    );
    symlinkSync(
      join(REPO, 'node_modules'),
      join(worktree, 'node_modules'),
      'junction'
    );

    const config = versionConfig({
      base,
      sourceRoot: worktree,
      outDir,
      hostedBaseUrl,
      gitRevision,
      strict,
    });
    runTypedoc({ cwd: worktree, optionsFile: writeOptions(worktree, config) });
  } finally {
    cleanupWorktree(worktree);
  }
}

/**
 * Points `<root>/latest` at `folder`.
 *
 * A symlink keeps the site one copy per version instead of two. Filesystems that refuse
 * symlinks (Windows without developer mode) fall back to a directory copy, so the
 * published tree looks the same either way.
 */
function linkLatest(root, folder) {
  const link = join(root, 'latest');
  rmSync(link, { recursive: true, force: true });
  try {
    symlinkSync(folder, link, 'junction');
    return 'symlink';
  } catch {
    cpSync(join(root, folder), link, { recursive: true });
    return 'copy';
  }
}

/** Removes the worktree and its `node_modules` link. Safe to call twice. */
function cleanupWorktree(path) {
  const link = join(path, 'node_modules');
  try {
    if (existsSync(link) && lstatSync(link).isSymbolicLink()) rmSync(link);
  } catch {
    /* the worktree removal below reports anything that actually matters */
  }
  try {
    execFileSync('git', ['worktree', 'remove', '--force', path], {
      cwd: REPO,
      stdio: 'pipe',
    });
  } catch {
    rmSync(path, { recursive: true, force: true });
    execFileSync('git', ['worktree', 'prune'], { cwd: REPO, stdio: 'pipe' });
  }
}

const USAGE = `Usage: node scripts/docs-build-version.mjs <tag> | --branch <name> | --dev [options]

  <tag>              Released tag to build, e.g. v0.4.30.
  --branch <name>    Build that branch's tip into <site>/<name> — the unreleased docs.
  --dev              Build the working tree into <site>/dev instead. Never published.
  --out <dir>        Site root (default ${DEFAULT_SITE_ROOT}).
  --base-url <url>   Site root URL; sets hostedBaseUrl to <url>/<folder>/.
  --floor <tag>      Oldest tag allowed (default ${VERSION_FLOOR}).
  --skip-existing    Leave an already-built folder alone.
  --no-latest        Do not point <site>/latest at this build.
  --strict           Keep link validation on for a tag build.
`;

function main(argv) {
  const opts = parseArgs(argv);
  if (opts.help || (!opts.tag && !opts.dev && !opts.branch)) {
    process.stdout.write(USAGE);
    return opts.help ? 0 : 1;
  }
  if ([opts.tag, opts.dev, opts.branch].filter(Boolean).length > 1)
    throw new Error('Pass one of <tag>, --branch <name>, or --dev.');

  const root = resolve(opts.root ?? join(REPO, DEFAULT_SITE_ROOT));
  const folder = opts.dev ? 'dev' : (opts.branch ?? opts.tag);
  const outDir = join(root, folder);

  if (opts.skipExisting && existsSync(outDir)) {
    process.stdout.write(`${short(outDir)} already built — skipped.\n`);
    return 0;
  }

  const hostedBaseUrl = opts.baseUrl
    ? `${opts.baseUrl.replace(/\/+$/, '')}/${folder}/`
    : null;
  const base = baseConfig();
  mkdirSync(root, { recursive: true });

  if (opts.dev) {
    const config = versionConfig({
      base,
      sourceRoot: REPO,
      outDir,
      hostedBaseUrl,
      gitRevision: null,
      strict: true,
    });
    const optionsFile = writeOptions(
      mkdtempSync(join(tmpdir(), 'cc-docs-dev-')),
      config
    );
    runTypedoc({ cwd: REPO, optionsFile });
    rmSync(dirname(optionsFile), { recursive: true, force: true });
    process.stdout.write(`\nBuilt working tree -> ${short(outDir)}\n`);
    return 0;
  }

  if (opts.branch) {
    const branch = resolveBranch(opts.branch);
    buildRef({
      ref: branch.head,
      slug: branch.name,
      base,
      outDir,
      hostedBaseUrl,
      // Source links point at the branch, not the commit — the whole point of this folder
      // is "what is on `main` now", and a detached sha is not a URL a reader can browse.
      gitRevision: branch.name,
      // Same reason a tag build is lenient: the markdown being built is not in this
      // working tree, so a broken link in it cannot be fixed from here. `npm run
      // docs:check` is the gate that runs on the tree you can actually edit.
      strict: opts.strict,
    });

    process.stdout.write(
      `\nBuilt ${branch.name} (${branch.head}, ${branch.date}) -> ${short(outDir)}\n` +
        `Unreleased: no versions.json entry and never latest/ — the switcher offers it by name.\n`
    );
    if (branch.remote && branch.remote !== branch.head) {
      process.stderr.write(
        `warning: origin/${branch.name} is at ${branch.remote}, this build is ${branch.head}.\n` +
          `  Fetch and merge first if the published folder should match the remote.\n`
      );
    }
    return 0;
  }

  const tag = parseTag(opts.tag);
  if (!tag)
    throw new Error(
      `Not a release tag: ${opts.tag} (expected v<major>.<minor>.<patch>)`
    );

  const floor = parseTag(opts.floor);
  if (!floor) throw new Error(`--floor is not a release tag: ${opts.floor}`);
  if (compareDesc(tag, floor) > 0) {
    throw new Error(
      `${tag.tag} is below the documentation version floor ${floor.tag}, so it is not built.\n` +
        `Readers on a version below the floor land on latest/ with the stale banner instead.\n` +
        `The floor and the reasoning behind it live on VERSION_FLOOR in docs-versions.mjs.\n` +
        `To build this tag anyway: --floor ${tag.tag}`
    );
  }

  const tags = listReleaseTags();
  if (!tags.some(t => t.tag === tag.tag)) {
    throw new Error(`No such tag in this repository: ${tag.tag}`);
  }

  buildRef({
    ref: tag.tag,
    slug: tag.tag,
    base,
    outDir,
    hostedBaseUrl,
    gitRevision: tag.tag,
    strict: opts.strict,
  });

  process.stdout.write(`\nBuilt ${tag.tag} -> ${short(outDir)}\n`);

  const newest = tags[0];
  if (opts.latest && newest?.tag === tag.tag) {
    process.stdout.write(
      `latest/ -> ${folder} (${linkLatest(root, folder)})\n`
    );
  } else if (opts.latest) {
    process.stdout.write(
      `latest/ left alone — ${newest?.tag ?? 'the newest tag'} is newer than ${tag.tag}.\n`
    );
  }
  process.stdout.write(
    `Next: node scripts/docs-versions.mjs --out ${short(root)}\n`
  );

  const pkg = packageVersion();
  if (tag.version !== pkg && newest?.tag === tag.tag) {
    process.stderr.write(
      `warning: package.json is at ${pkg} but the newest tag is ${tag.tag}.\n` +
        `  ${pkg} has no tag, so it gets no version folder.\n`
    );
  }
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
