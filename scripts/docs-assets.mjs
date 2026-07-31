#!/usr/bin/env node
/**
 * Copies the site's static assets into a TypeDoc build.
 *
 * TypeDoc has no static-asset option — `customCss` and `customJs` are copied as
 * `assets/custom.css` / `assets/custom.js` and nothing else travels. The mermaid
 * bundle that `docs/assets/site.js` lazy-loads at runtime therefore has to be
 * copied by hand, or every diagram page 404s on the request and silently shows
 * its source instead.
 *
 * TypeDoc also clears the output directory on every build, so this runs *after*
 * typedoc, and it has to run again after each rebuild (`docs-serve.mjs` serves
 * `assets/vendor/**` straight from the repo in watch mode for that reason).
 *
 *   node scripts/docs-assets.mjs [--out docs/site]
 */
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const outIndex = process.argv.indexOf('--out');
const out = resolve(
  ROOT,
  outIndex === -1 ? 'docs/site' : process.argv[outIndex + 1]
);

const source = join(ROOT, 'docs/assets/vendor');
const target = join(out, 'assets/vendor');

if (!existsSync(source)) {
  console.log(`docs-assets: nothing to copy (${source} does not exist)`);
  process.exit(0);
}

if (!existsSync(out)) {
  console.error(
    `docs-assets: ${out} does not exist — run \`npm run docs\` first`
  );
  process.exit(1);
}

mkdirSync(dirname(target), { recursive: true });
cpSync(source, target, { recursive: true });
console.log(`docs-assets: copied vendor assets → ${target}`);
