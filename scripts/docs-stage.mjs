/**
 * Stages the hand-written docs for a clean-jsdoc-theme build: copies `docs/guides/**`
 * to `docs/.staged/**` with ```mermaid fences pre-rendered to SVG, TypeDoc-convention
 * titles and links rewritten to what this theme emits, and the readme staged alongside.
 *
 * Why this exists: `@boneskull/typedoc-plugin-mermaid` renders in the browser from
 * `Renderer.EVENT_END_PAGE`, and clean-jsdoc-theme registers its own output writer
 * instead of calling `renderer.render()`, so that hook never fires. Rendering here
 * ships the diagrams as static SVG — no mermaid bundle, no flash, works offline.
 *
 * Each fence becomes a plain markdown image. The theme inlines any `.svg` image into
 * the DOM rather than `<img>`-ing it (`MdxImg` in @clean-jsdoc-theme/rang), so the
 * diagram is live markup — which is why the mermaid theme below paints strokes and
 * text in `currentColor` and leaves fills transparent. One diagram then reads
 * correctly in both light and dark with no extra CSS and no second copy.
 *
 * Raw inline `<svg>` is not an option: the theme compiles doc pages as MDX, where
 * mermaid's markup is invalid JSX and gets dropped.
 *
 * Sources are never modified: `docs/guides` is the input, `docs/.staged` the output.
 */

import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, rm, readdir } from 'node:fs/promises';
import { join, dirname, extname, relative, basename, posix } from 'node:path';
import { chromium } from 'playwright';
import { slugifyHeading } from '@clean-jsdoc-theme/utils';

const ROOT = process.cwd();
const SRC = join(ROOT, 'docs/guides');
const OUT = join(ROOT, 'docs/.staged');
const MERMAID = '/node_modules/mermaid/dist/mermaid.esm.min.mjs';

/**
 * Mermaid's theme engine runs every colour through khroma (it inverts and derives
 * contrast values), so `currentColor` is rejected outright. Render with a sentinel
 * instead and swap it for `currentColor` in the finished SVG — that is what makes a
 * single diagram legible on both themes.
 */
const INK = '#010203';

const THEME_VARIABLES = {
  background: 'transparent',
  primaryColor: 'transparent',
  mainBkg: 'transparent',
  secondaryColor: 'transparent',
  tertiaryColor: 'transparent',
  edgeLabelBackground: 'transparent',
  primaryTextColor: INK,
  textColor: INK,
  lineColor: INK,
  primaryBorderColor: INK,
  nodeBorder: INK,
};

const MIME = { '.mjs': 'text/javascript', '.js': 'text/javascript', '.html': 'text/html' };

/** Serves the repo root so mermaid's ESM entry can resolve its sibling chunks. */
function serve() {
  const server = createServer(async (req, res) => {
    if (req.url === '/') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<!doctype html><html><body></body></html>');
      return;
    }
    try {
      const body = await readFile(join(ROOT, decodeURIComponent(req.url.split('?')[0])));
      res.writeHead(200, { 'content-type': MIME[extname(req.url)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
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

const server = await serve();
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${server.address().port}/`);

await rm(OUT, { recursive: true, force: true });

const fence = /^[ \t]*```mermaid[ \t]*\r?\n([\s\S]*?)^[ \t]*```[ \t]*$/gm;
let count = 0;

/**
 * Guide frontmatter titles use TypeDoc's `Group/Page` convention — `projectDocuments`
 * splits on the slash to build the sidebar hierarchy, so the default theme shows only
 * "How It Works" under a "Start Here" group. clean-jsdoc-theme instead takes the group
 * from the `group:` field and prints `title` verbatim, which renders as
 * "Start Here/How It Works" underneath a heading that already says "Start Here".
 * The group prefix is dropped here; `group:` still carries it.
 */
function stripGroupPrefix(text) {
  const group = /^title:\s*"([^"/]+)\/(.+)"\s*$/m;
  return text.replace(group, (line, prefix, page) =>
    text.includes(`group: "${prefix}"`) ? `title: "${page}"` : line,
  );
}

/**
 * Rewrites the two kinds of markdown link the guides were written against TypeDoc for.
 *
 * Heading anchors: TypeDoc keeps underscores in a heading slug, so the guides link to
 * `#dl_view_item_list`. clean-jsdoc-theme strips them — its `NON_SLUG_HEADING` is
 * `/[^\p{L}\p{N}\p{M}\s-]+/gu` — and emits `id="dlviewitemlist"`, which broke every
 * such link. The theme's own `slugifyHeading` is applied here rather than a local copy,
 * so the two can never drift; it is a no-op on fragments that were already slug-shaped.
 *
 * Page links: `./debugger.md` pointed at a file TypeDoc used to rewrite and this theme
 * does not, leaving a dead link to raw markdown. They become site-absolute paths, which
 * `MdxA` prefixes with `basePath` (`href.startsWith("/") ? withBase(basePath, href)`).
 */
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

for (const file of await walk(SRC)) {
  let text = rewriteLinks(
    stripGroupPrefix(await readFile(file, 'utf8')),
    relative(SRC, dirname(file)) || '.',
  );
  const target = join(OUT, relative(SRC, file));
  await mkdir(dirname(target), { recursive: true });
  for (const [index, match] of [...text.matchAll(fence)].entries()) {
    const name = `${basename(file, '.md')}-diagram-${index + 1}.svg`;
    const svg = await page.evaluate(
      async ({ source, id, MERMAID, themeVariables }) => {
        const mermaid = (await import(MERMAID)).default;
        mermaid.initialize({ startOnLoad: false, theme: 'base', themeVariables, flowchart: { useMaxWidth: true } });
        return (await mermaid.render(id, source)).svg;
      },
      { source: match[1], id: `d${count}`, MERMAID, themeVariables: THEME_VARIABLES },
    );
    await writeFile(join(dirname(target), name), svg.replaceAll(new RegExp(INK, 'gi'), 'currentColor'));
    text = text.replace(match[0], `![Diagram](./${name})`);
    count++;
  }
  await writeFile(target, text);
}

await browser.close();
server.close();

/**
 * The home page is staged too. Under the theme's `docs` option every exported symbol
 * sits at the top level of the sidebar rather than under an `index` module, so the
 * module-qualified `{@link index!CartItem}` targets the readme uses no longer resolve.
 * Bare names do.
 */
const home = await readFile(join(ROOT, 'docs/site-home.md'), 'utf8');
await writeFile(
  join(ROOT, 'docs/.staged-home.md'),
  rewriteLinks(
    // The home page sits a level above the guides and links into `guides/`, which is
    // the directory staged as the docs root — drop that segment so the paths resolve
    // the same way a guide's own links do.
    home.replace(/\{@link index!(\w+)\}/g, '{@link $1}').replace(/\]\(\.?\/?guides\//g, '](./'),
    '.',
  ),
);

console.log(`mermaid: rendered ${count} diagram(s) into docs/.staged`);
