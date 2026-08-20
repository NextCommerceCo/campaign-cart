// @ts-check
/**
 * Static file server for the clean-jsdoc-theme site (`docs/site`), plus an
 * optional `--watch` flag that runs `typedoc --watch` alongside it so the site
 * rebuilds on source/guide changes while you browse it.
 *
 * The theme injects `clean-theme.css` and `site.js` into every page itself, via
 * `cleanJsdocTheme.customCssFile` / `customJsFile` in `typedoc.json` (wired through
 * the adapter by patches/@clean-jsdoc-theme+typedoc+5.1.1.patch). `--watch` stages the
 * guides at startup, stages them again when their source changes, and refreshes the
 * local version index after each TypeDoc rebuild.
 *
 * Zero new dependencies — `node:http` / `node:fs` / `node:path` only, matching
 * this repo's habit of scripting over adding libraries (see
 * docs/documentation-plan.md §8).
 *
 * Usage:
 *   node scripts/docs-serve.mjs           serve docs/site on :3500
 *   node scripts/docs-serve.mjs --watch   also runs the build pipeline in watch mode
 *   PORT=4000 node scripts/docs-serve.mjs override the port
 */
import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { createReadStream, existsSync, statSync, watch } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const ROOT = resolve(process.cwd(), 'docs/site');
const PORT = Number(process.env.PORT) || 3500;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
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
let guidesWatcher = null;
let homeWatcher = null;
let stageTimer = null;
if (process.argv.includes('--watch')) {
  const staged = spawnSync('node', ['scripts/docs-stage.mjs'], {
    stdio: 'inherit',
  });
  if (staged.error) throw staged.error;
  if (staged.status !== 0) process.exit(staged.status ?? 1);

  const queueStage = () => {
    if (stageTimer) clearTimeout(stageTimer);
    stageTimer = setTimeout(() => {
      stageTimer = null;
      spawnSync('node', ['scripts/docs-stage.mjs'], { stdio: 'inherit' });
    }, 50);
  };
  guidesWatcher = watch('docs/guides', { recursive: true }, queueStage);
  homeWatcher = watch('docs/site-home.md', queueStage);

  watchProcess = spawn('npx', ['typedoc', '--watch'], {
    stdio: ['inherit', 'pipe', 'inherit'],
    shell: true,
  });
  // typedoc's build log scrolls the startup URL away; re-print it after each build.
  // The theme's writer signs off with `clean-jsdoc-theme generated at <dir>`, which is
  // also the cue to re-inject the overrides the build just overwrote.
  watchProcess.stdout.on('data', chunk => {
    process.stdout.write(chunk);
    if (chunk.toString().includes('generated at')) {
      spawnSync('node', ['scripts/docs-versions.mjs', '--local'], {
        stdio: 'inherit',
      });
      console.log(`docs site: http://localhost:${PORT}`);
    }
  });
}

process.on('SIGINT', () => {
  if (stageTimer) clearTimeout(stageTimer);
  guidesWatcher?.close();
  homeWatcher?.close();
  watchProcess?.kill('SIGINT');
  server.close(() => process.exit(0));
});
