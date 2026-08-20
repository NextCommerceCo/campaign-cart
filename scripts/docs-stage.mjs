/**
 * Stages the hand-written docs for a clean-jsdoc-theme build: copies `docs/guides/**`
 * to `docs/.staged/**`, with TypeDoc-convention titles and links rewritten to what
 * this theme emits, and the readme staged alongside.
 *
 * `stripGroupPrefix`: the default TypeDoc theme splits `title: "Group/Page"` on
 * `/` to build the sidebar hierarchy. clean-jsdoc-theme takes the group from
 * frontmatter and prints `title` verbatim — left intact it would render as
 * "Start Here/How It Works" under a heading that already says "Start Here".
 *
 * `rewriteLinks`: the guides link to TypeDoc-convention slugs (underscores kept)
 * and raw `./*.md` paths the theme does not resolve. clean-jsdoc-theme strips
 * underscores (`NON_SLUG_HEADING = /[^\p{L}\p{N}\p{M}\s-]+/gu`) and rewrites
 * `.md` paths via `MdxA`'s `basePath` prefix. We re-run its `slugifyHeading`
 * locally to stay aligned with the theme's own slugger.
 *
 * Sources are never modified: `docs/guides` is the input, `docs/.staged` the output.
 */

import {
  readFile,
  writeFile,
  mkdir,
  rm,
  readdir,
  rename,
} from 'node:fs/promises';
import { join, dirname, relative, posix } from 'node:path';
import { slugifyHeading } from '@clean-jsdoc-theme/utils';

const ROOT = process.cwd();
const SRC = join(ROOT, 'docs/guides');
const OUT = join(ROOT, 'docs/.staged');

function stripGroupPrefix(text) {
  const group = /^title:\s*"([^"/]+)\/(.+)"\s*$/m;
  return text.replace(group, (line, prefix, page) =>
    text.includes(`group: "${prefix}"`) ? `title: "${page}"` : line
  );
}

function rewriteLinks(text, dir) {
  return text.replace(/\]\(([^)\s]+)\)/g, (whole, target) => {
    if (/^(https?:|mailto:|#?\/)/.test(target)) return whole;
    const [path, fragment] = target.split('#');
    const hash = fragment ? `#${slugifyHeading(fragment)}` : '';
    if (!path) return `](${hash})`;
    if (!path.endsWith('.md')) return whole;
    return `](/${posix.normalize(posix.join(dir, path)).replace(/\.md$/, '')}${hash})`;
  });
}

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(path)));
    else out.push(path);
  }
  return out;
}

await mkdir(OUT, { recursive: true });
const staleFiles = new Set(await walk(OUT));

let count = 0;
for (const file of await walk(SRC)) {
  const text = rewriteLinks(
    stripGroupPrefix(await readFile(file, 'utf8')),
    relative(SRC, dirname(file)) || '.'
  );
  const target = join(OUT, relative(SRC, file));
  const temporary = `${target}.${process.pid}.tmp`;
  await mkdir(dirname(target), { recursive: true });
  await writeFile(temporary, text);
  await rename(temporary, target);
  staleFiles.delete(target);
  count++;
}

for (const staleFile of staleFiles) {
  await rm(staleFile, { force: true });
}

/**
 * The home page is staged too. Under the theme's `docs` option every exported symbol
 * sits at the top level of the sidebar rather than under an `index` module, so the
 * module-qualified `{@link index!CartItem}` targets the readme uses no longer resolve.
 * Bare names do.
 */
const home = await readFile(join(ROOT, 'docs/site-home.md'), 'utf8');
const stagedHome = join(ROOT, 'docs/.staged-home.md');
const temporaryHome = `${stagedHome}.${process.pid}.tmp`;
await writeFile(
  temporaryHome,
  rewriteLinks(
    home
      .replace(/\{@link index!(\w+)\}/g, '{@link $1}')
      .replace(/\]\(\.?\/?guides\//g, '](./'),
    '.'
  )
);
await rename(temporaryHome, stagedHome);

console.log(`docs: staged ${count} guide file(s) into docs/.staged`);
