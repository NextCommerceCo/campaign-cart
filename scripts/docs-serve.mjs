// @ts-check
/**
 * Static file server for the TypeDoc HTML site (`docs/site`), plus an optional
 * `--watch` flag that runs `typedoc --watch` alongside it so the site rebuilds
 * on source/guide changes while you browse it.
 *
 * Zero new dependencies — `node:http` / `node:fs` / `node:path` only, matching
 * this repo's habit of scripting over adding libraries (see
 * docs/documentation-plan.md §8).
 *
 * Usage:
 *   node scripts/docs-serve.mjs           serve docs/site on :3500
 *   node scripts/docs-serve.mjs --watch   also runs `typedoc --watch`
 *   PORT=4000 node scripts/docs-serve.mjs override the port
 */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const ROOT = resolve(process.cwd(), 'docs/site');
const PORT = Number(process.env.PORT) || 3500;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  // mermaid ships as ESM (`assets/mermaid/**.mjs`). A module script served as
  // application/octet-stream is refused by the browser, so every diagram page
  // would fall back to showing its source.
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

/** @param {string} filePath */
function contentTypeFor(filePath) {
  return MIME_TYPES[extname(filePath)] ?? 'application/octet-stream';
}

/**
 * Resolves a request path to a file under ROOT, treating directory requests
 * (and any path with no matching file) as `index.html`. Rejects any path that
 * escapes ROOT via `..` traversal.
 *
 * Everything is served from the build — including `assets/mermaid/**`, which
 * `@boneskull/typedoc-plugin-mermaid` re-copies on every render, so `--watch`
 * keeps its diagrams after a rebuild wipes the output directory.
 * @param {string} urlPath
 */
function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0] ?? '/');
  const safePath = normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  let filePath = join(ROOT, safePath);

  if (!filePath.startsWith(ROOT)) {
    return null;
  }

  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, 'index.html');
  }

  return existsSync(filePath) && statSync(filePath).isFile() ? filePath : null;
}

const server = createServer((req, res) => {
  const filePath = resolveFile(req.url ?? '/');

  if (!filePath) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found\n');
    return;
  }

  res.writeHead(200, { 'Content-Type': contentTypeFor(filePath) });
  createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`docs site: http://localhost:${PORT}`);
});

let watchProcess = null;
if (process.argv.includes('--watch')) {
  watchProcess = spawn('npx', ['typedoc', '--watch'], {
    stdio: 'inherit',
    shell: true,
  });
}

process.on('SIGINT', () => {
  watchProcess?.kill('SIGINT');
  server.close(() => process.exit(0));
});
