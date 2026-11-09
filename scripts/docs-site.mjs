#!/usr/bin/env node
/**
 * Writes the root files of an assembled docs site (`versions.json`, the `index.html`
 * redirect, `_headers`, `robots.txt`, `404.html`) and fails when the site has more files
 * than Workers static assets accepts. Run it once the version folders, `latest/` and
 * `main/` are in place.
 *
 *   node scripts/docs-site.mjs [--base-url https://…]    # default: $DOCS_BASE_URL
 */

import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_SITE_ROOT, buildVersionIndex, renderRootRedirect } from './docs-versions.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Workers static assets on a paid plan. */
export const MAX_FILES = 100_000;

export const HEADERS = `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Cache-Control: public, max-age=300, stale-while-revalidate=86400
`;

/** Only `latest/` is indexed; every version folder and `main/` duplicates it. */
export function renderRobots(baseUrl) {
  return baseUrl ? 'User-agent: *\nAllow: /latest/\nDisallow: /\n' : 'User-agent: *\nDisallow: /\n';
}

/** Served at the URL that missed, so every link is root-absolute. */
export function render404(versions) {
  const items = [
    ...versions.map((v) => `<li><a href="/${v.path}/">${v.version}</a>${v.current ? ' (current)' : ''}</li>`),
    '<li><a href="/main/">main</a> (unreleased)</li>',
  ].join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Page not found · Campaign Cart SDK documentation</title>
<meta name="robots" content="noindex" />
<style>
  body { font: 16px/1.6 system-ui, sans-serif; margin: 4rem auto; max-width: 40rem; padding: 0 1rem; }
  @media (prefers-color-scheme: dark) { body { background: #1c1e21; color: #e8e8e8; } a { color: #79b8ff; } }
</style>
</head>
<body>
<h1>Page not found</h1>
<p>Each SDK version has its own folder, and pages can move between versions.</p>
<p><a href="/latest/">Go to the latest documentation</a></p>
<h2>Versions</h2>
<ul>
${items}
</ul>
</body>
</html>
`;
}

export function countFiles(dir) {
  let count = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    count += entry.isDirectory() ? countFiles(join(dir, entry.name)) : 1;
  }
  return count;
}

function main(argv) {
  const at = argv.indexOf('--base-url');
  const baseUrl = (at === -1 ? process.env.DOCS_BASE_URL : argv[at + 1]) || null;
  const root = join(REPO, DEFAULT_SITE_ROOT);

  const { versions } = buildVersionIndex({ root });
  const home = existsSync(join(root, 'latest')) ? 'latest/' : 'main/';
  writeFileSync(join(root, 'versions.json'), `${JSON.stringify(versions, null, 2)}\n`);
  writeFileSync(join(root, 'index.html'), renderRootRedirect(home));
  writeFileSync(join(root, '_headers'), HEADERS);
  writeFileSync(join(root, 'robots.txt'), renderRobots(baseUrl));
  writeFileSync(join(root, '404.html'), render404(versions));

  const files = countFiles(root);
  process.stdout.write(`docs site: ${versions.length} version(s), home ${home}, ${files} file(s)\n`);
  if (files > MAX_FILES) {
    process.stderr.write(`docs site has ${files} files; Workers static assets accepts ${MAX_FILES}.\n`);
    return 1;
  }
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
