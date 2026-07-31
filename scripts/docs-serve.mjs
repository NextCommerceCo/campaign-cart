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
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

/** @param {string} filePath */
function contentTypeFor(filePath) {
  return MIME_TYPES[extname(filePath)] ?? 'application/octet-stream';
}

/** Vendored assets live in the repo, not in the build — see scripts/docs-assets.mjs. */
const VENDOR = resolve(process.cwd(), 'docs/assets/vendor');

/**
 * Resolves a request path to a file under ROOT, treating directory requests
 * (and any path with no matching file) as `index.html`. Rejects any path that
 * escapes ROOT via `..` traversal.
 *
 * `assets/vendor/**` falls back to the repo copy: TypeDoc wipes the output
 * directory on every rebuild, so in `--watch` mode the copied vendor bundle
 * disappears the first time a file changes and mermaid diagrams stop rendering
 * until the next `npm run docs`. Serving it from source keeps watch mode honest.
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

  if (!existsSync(filePath)) {
    const vendorMatch = /(?:^|\/)assets\/vendor\/(.+)$/.exec(safePath);
    if (vendorMatch?.[1]) {
      const fromRepo = join(VENDOR, vendorMatch[1]);
      if (
        fromRepo.startsWith(VENDOR) &&
        existsSync(fromRepo) &&
        statSync(fromRepo).isFile()
      ) {
        return fromRepo;
      }
    }
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
