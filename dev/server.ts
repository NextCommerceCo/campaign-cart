import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { createServer, type Plugin, type ViteDevServer } from 'vite';
import { apiTarget, hasLocalRules, mockApi } from './mock';

const SITE = resolve(process.env.SITE ?? join(import.meta.dirname, '../../my-campaigns/_site'));
const DIST = join(import.meta.dirname, '../dist');
const LOADER = /<script\b[^>]*\bsrc=["'][^"']*\/loader\.js(?:\?[^"']*)?["'][^>]*>\s*<\/script>/;
const LEFTOVER_SDK = /<script\b[^>]*campaign-cart[^>]*>\s*<\/script>/g;
const PASS_COOKIE = 'next_qa';

export interface DevOptions {
  api?: string;
  key?: string;
  dist?: boolean;
  share?: boolean;
  token?: string;
  port?: number;
  quiet?: boolean;
}

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

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function describe(api: string): { label: string; detail: string } {
  if (api === 'live')
    return { label: 'LIVE', detail: 'real campaign data and prices; orders, prospects and payments are fake' };
  if (api === 'full') return { label: 'FULL', detail: 'the real API: orders, prospects and payment.js are REAL' };
  if (apiTarget(api)) return { label: 'LOCAL API', detail: `everything goes to ${api}` };
  return { label: 'MOCK', detail: 'nothing leaves this machine; prices from saved campaigns' };
}

function pageFile(pathname: string): string | undefined {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return undefined;
  }
  const base = resolve(SITE, `.${decoded}`);
  if (base !== SITE && !base.startsWith(SITE + sep)) return undefined;
  for (const file of [base, join(base, 'index.html'), `${base}.html`]) {
    if (existsSync(file) && statSync(file).isFile()) return file;
  }
  return undefined;
}

function entryPages(): Array<{ campaign: string; pages: string[] }> {
  const order = ['landing', 'presell', 'checkout', 'information'];
  const rank = (p: string) => (order.indexOf(p) + 1 || 99) - 1;
  return readdirSync(SITE)
    .filter((d) => statSync(join(SITE, d)).isDirectory() && !d.startsWith('.'))
    .map((campaign) => ({
      campaign,
      pages: readdirSync(join(SITE, campaign))
        .filter((p) => existsSync(join(SITE, campaign, p, 'index.html')))
        .sort((a, b) => rank(a) - rank(b)),
    }))
    .filter((c) => c.pages.length);
}

function launcher(api: string, key?: string): string {
  const { label, detail } = describe(api);
  const color = label === 'FULL' ? '#c51a00' : label === 'MOCK' ? '#555' : '#0b62d6';
  const rows = entryPages()
    .map(({ campaign, pages }) => {
      const links = pages.map((p) => `<a href="/${escape(campaign)}/${escape(p)}/">${escape(p)}</a>`).join(' · ');
      return `<tr><th>${escape(campaign)}</th><td>${links}</td></tr>`;
    })
    .join('');
  const cards =
    label === 'MOCK' || label === 'LIVE'
      ? '<code>4242 4242 4242 4242</code> pays, <code>4000 0000 0000 0002</code> declines'
      : 'use the test cards of the campaign’s sandbox gateway';
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Campaign SDK test pages</title>
<style>body{font:15px/1.5 system-ui;margin:0;padding:16px;max-width:60rem}h1{font-size:20px}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:8px 6px;border-bottom:1px solid #eee;vertical-align:top}th{white-space:nowrap}.mode{display:inline-block;padding:2px 10px;border-radius:999px;color:#fff;background:${color}}code{background:#f3f3f3;padding:1px 4px;border-radius:4px}</style>
<h1>Campaign SDK test pages <span class="mode">${label}</span></h1>
<p>${escape(detail)}${key ? ` · campaign key <code>${escape(key)}</code> on every page` : ''}</p>
<p>Test cards: ${cards}. Any future expiry, any CVV. · <a href="/__dev/reset">Start over</a> (clears this browser’s cart, form and order)</p>
<table>${rows}</table>`;
}

const RESET = `<!doctype html><meta charset="utf-8"><title>Reset</title><script>
for (const store of [sessionStorage, localStorage]) for (const k of Object.keys(store)) if (k.startsWith('next')) store.removeItem(k);
location.replace('/');
</script>`;

const PASSCODE = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Passcode needed</title>
<body style="font:16px system-ui;max-width:28rem;margin:4rem auto;padding:0 1rem"><h1>Ask for the full link</h1>
<p>This test server only opens with the link that includes its passcode.</p></body>`;

function cookie(req: IncomingMessage, name: string): string | undefined {
  return (req.headers.cookie ?? '')
    .split(';')
    .map((c) => c.trim().split('='))
    .find(([k]) => k === name)?.[1];
}

function withLocalSdk(html: string, options: DevOptions, rules: boolean): string {
  const { label } = describe(options.api ?? 'mock');
  const dev = { mode: label, stubPayments: label === 'MOCK' || label === 'LIVE', rules };
  const src = options.dist ? '/__sdk/loader.js' : '/src/loader.ts';
  const swapped = html.replace(LOADER, (tag) => {
    let local = tag
      .replace(/\s\btype=["'][^"']*["']/, '')
      .replace(/\bsrc=["'][^"']*["']/, `src="${src}"`)
      .replace('<script', '<script type="module"');
    if (options.key) {
      local = local
        .replace(/\sdata-campaign=["'][^"']*["']/, '')
        .replace('<script', `<script data-campaign="${escape(options.key)}"`);
    }
    return `<script>window.__NEXT_DEV__=${JSON.stringify(dev)}</script>\n<script type="module" src="/dev/client.ts"></script>\n${local}`;
  });
  if (!LEFTOVER_SDK.test(swapped)) return swapped;
  console.warn('[dev] removed an SDK script tag it could not swap, so it cannot reach production');
  return swapped.replace(LEFTOVER_SDK, '');
}

function passcode(token: string | undefined) {
  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!token) return next();
    const url = new URL(req.url ?? '/', 'http://dev');
    if (url.searchParams.get('qa') === token) {
      url.searchParams.delete('qa');
      res.writeHead(302, {
        'set-cookie': `${PASS_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax`,
        location: url.pathname + url.search,
      });
      return res.end();
    }
    if (cookie(req, PASS_COOKIE) === token) return next();
    res.writeHead(401, { 'content-type': 'text/html' });
    res.end(PASSCODE);
  };
}

function sitePages(server: () => ViteDevServer, options: DevOptions): Plugin {
  const api = options.api ?? 'mock';
  const rules = hasLocalRules();
  const sendFile = (res: ServerResponse, file: string) => {
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  };
  const serve = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const { pathname } = new URL(req.url ?? '/', 'http://dev');
    if (pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html' });
      return res.end(launcher(api, options.key));
    }
    if (pathname === '/__dev/reset') {
      res.writeHead(200, { 'content-type': 'text/html' });
      return res.end(RESET);
    }
    const stub = pathname.startsWith('/__dev/stub/') && STUBS[pathname.slice('/__dev/stub/'.length)];
    if (stub) {
      res.writeHead(200, { 'content-type': 'text/javascript' });
      return res.end(stub);
    }
    if (pathname.startsWith('/__sdk/')) {
      const file = resolve(DIST, `.${pathname.slice('/__sdk'.length)}`);
      return file.startsWith(DIST + sep) && existsSync(file) ? sendFile(res, file) : next();
    }
    if (pathname === '/src/campaign-cart.css')
      return sendFile(res, join(import.meta.dirname, '../public/campaign-cart.css'));
    if (/^\/(src|dev|node_modules|@)/.test(pathname)) return next();
    const file = pageFile(pathname);
    if (!file) return next();
    if (extname(file) !== '.html') return sendFile(res, file);
    const page = withLocalSdk(readFileSync(file, 'utf8'), options, rules);
    const html = options.dist ? page : await server().transformIndexHtml(pathname, page);
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(html);
  };
  return {
    name: 'campaign-pages',
    configureServer(vite) {
      vite.middlewares.use(passcode(options.token));
      vite.middlewares.use(mockApi(api));
      vite.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) =>
        serve(req, res, next).catch((err: unknown) => {
          console.error('[dev]', err);
          res.writeHead(500);
          res.end(String(err));
        }),
      );
    },
  };
}

export async function startDev(options: DevOptions = {}) {
  if (!existsSync(SITE))
    throw new Error(`no campaign pages at ${SITE}. Build my-campaigns, or set SITE=/path/to/_site`);
  if (options.api === 'full' && !options.key) {
    throw new Error('--api full creates real orders: pass --key pk_… of a test campaign');
  }
  if (options.dist && !existsSync(join(DIST, 'loader.js'))) throw new Error('no dist/: run `bun run build` first');
  let vite: ViteDevServer;
  vite = await createServer({
    plugins: [sitePages(() => vite, options)],
    server: { port: options.port ?? 5173, ...(options.share && { allowedHosts: true, hmr: false }) },
    clearScreen: false,
    logLevel: options.quiet ? 'silent' : 'info',
  });
  await vite.listen();
  const origin = vite.resolvedUrls?.local[0]?.replace(/\/$/, '') ?? 'http://localhost:5173';
  return { origin, close: () => vite.close() };
}

export function readArgs(argv: string[]): DevOptions {
  const value = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    api: argv.includes('--live') ? 'live' : (value('--api') ?? 'mock'),
    key: value('--key'),
    dist: argv.includes('--dist'),
    port: Number(value('--port')) || undefined,
  };
}

if (import.meta.main) {
  const options = readArgs(process.argv);
  const { origin } = await startDev(options);
  const { label, detail } = describe(options.api ?? 'mock');
  console.log(`\n  Campaign SDK dev — ${label}: ${detail}`);
  console.log(`  Pages from ${SITE}${options.dist ? ', SDK from dist/' : ', SDK from source'}`);
  console.log(`\n  Open ${origin}/ for every campaign page\n`);
}
