import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { createServer, type Plugin, type ViteDevServer } from 'vite';
import { mockApi } from './mock';

const live = process.argv.includes('--live');
const SITE = resolve(process.env.SITE ?? join(import.meta.dirname, '../../my-campaigns/_site'));
const LOADER = /<script\b[^>]*\bsrc="[^"]*\/loader\.js(?:\?[^"]*)?"[^>]*>\s*<\/script>/;

const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const STUBS: Record<string, string> = {
  'payment.js': 'window.NextPayment = window.__devNextPayment;',
  'next-campaign.js':
    "window.nextCampaign = { config() {}, event(name, data) { console.info('[dev] nextCampaign.' + name, data); } };",
};

function pageFile(pathname: string): string | undefined {
  const base = join(SITE, decodeURIComponent(pathname));
  if (!base.startsWith(SITE)) return undefined;
  for (const file of [base, join(base, 'index.html'), `${base}.html`]) {
    if (existsSync(file) && statSync(file).isFile()) return file;
  }
  return undefined;
}

function withLocalSdk(html: string): string {
  return html.replace(LOADER, (tag) => {
    const local = tag
      .replace(/\s\btype="[^"]*"/, '')
      .replace(/\bsrc="[^"]*"/, 'src="/src/loader.ts"')
      .replace('<script', '<script type="module"');
    return `<script type="module" src="/dev/client.ts"></script>\n${local}`;
  });
}

function sitePages(server: () => ViteDevServer): Plugin {
  return {
    name: 'campaign-pages',
    configureServer(vite) {
      vite.middlewares.use(mockApi(live));
      vite.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const { pathname } = new URL(req.url ?? '/', 'http://dev');
        const stub = pathname.startsWith('/__dev/stub/') && STUBS[pathname.slice('/__dev/stub/'.length)];
        if (stub) {
          res.writeHead(200, { 'content-type': 'text/javascript' });
          return res.end(stub);
        }
        if (/^\/(src|dev|node_modules|@)/.test(pathname)) return next();
        const file = pageFile(pathname);
        if (!file) return next();
        const type = TYPES[extname(file)] ?? 'application/octet-stream';
        if (type !== 'text/html') {
          res.writeHead(200, { 'content-type': type });
          return res.end(readFileSync(file));
        }
        const html = await server().transformIndexHtml(pathname, withLocalSdk(readFileSync(file, 'utf8')));
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end(html);
      });
    },
  };
}

if (!existsSync(SITE)) {
  console.error(`[dev] no campaign pages at ${SITE}. Build my-campaigns, or set SITE=/path/to/_site`);
  process.exit(1);
}

let vite: ViteDevServer;
vite = await createServer({ plugins: [sitePages(() => vite)], server: { port: 5173 }, clearScreen: false });
await vite.listen();

const origin = vite.resolvedUrls?.local[0]?.replace(/\/$/, '') ?? 'http://localhost:5173';
const campaigns = readdirSync(SITE).filter((d) => statSync(join(SITE, d)).isDirectory() && !d.startsWith('.'));
console.log(`\n  Campaign SDK dev — ${live ? 'LIVE campaign data (orders and prospects still mocked)' : 'mock API'}`);
console.log(`  Pages from ${SITE}\n`);
for (const name of campaigns) {
  const pages = readdirSync(join(SITE, name)).filter((p) => existsSync(join(SITE, name, p, 'index.html')));
  const first = ['checkout', 'information', 'landing'].find((p) => pages.includes(p)) ?? pages[0];
  if (first) console.log(`  ${name.padEnd(32)} ${origin}/${name}/${first}/`);
}
console.log('\n  Test cards: 4242 4242 4242 4242 pays · 4000 0000 0000 0002 declines\n');
