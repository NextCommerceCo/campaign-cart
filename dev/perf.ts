// Times the built SDK on campaign pages under Chrome's "Slow 4G" preset, against the mock API:
// `npm run build && bun run perf` (`bun run perf -- 5` for five runs a page). Prints, per page and
// for a first and a second visit, when `html[data-next-ready]` was set and the SDK's requests before it.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createServer, request } from 'node:http';
import { homedir } from 'node:os';
import { extname, join } from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import { chromium, type BrowserContext } from 'playwright-core';

process.env.DEV_CAMPAIGNS ??= join(import.meta.dirname, 'e2e/campaigns');
const { startDev } = await import('./server');

const RUNS = Number(process.argv[2] ?? 3);
const PAGES = ['/olympus/landing/', '/olympus/checkout/'];
const DIST = join(import.meta.dirname, '../dist');
const API = /^https:\/\/campaigns\.apps\.29next\.com(\/.*)$/;
const BLOCKED = ['*29next.store*', '*29next.com*', '*spreedly.com*', '*googletagmanager*', '*google-analytics*'];
/** DevTools' Slow 4G: 1.6 Mbps down, 750 kbps up, 562.5 ms of latency a request. */
const SLOW_4G = {
  offline: false,
  latency: 562.5,
  downloadThroughput: (1.6 * 1024 * 1024 * 0.9) / 8,
  uploadThroughput: (750 * 1024 * 0.9) / 8,
};

function chrome(): string {
  if (process.env.CHROME) return process.env.CHROME;
  const cache = join(homedir(), '.cache/ms-playwright');
  const found = existsSync(cache)
    ? readdirSync(cache)
        .filter((d) => /^chromium-\d+$/.test(d))
        .sort()
        .reverse()
        .map((d) => join(cache, d, 'chrome-linux64/chrome'))
        .find(existsSync)
    : undefined;
  if (!found) throw new Error('No Chromium found. Run `bunx playwright-core install chromium` or set CHROME');
  return found;
}

const dev = await startDev({ quiet: true, port: 5411, dist: true });
const upstream = new URL(dev.origin);

/** Answers as the CDN and the API do: the SDK's files with brotli, pages and JSON with gzip. */
const front = createServer((req, res) => {
  const url = new URL(req.url!, 'http://localhost');
  if (url.pathname.startsWith('/__sdk/')) {
    const file = join(DIST, url.pathname.slice('/__sdk/'.length));
    if (!existsSync(file)) return void res.writeHead(404).end();
    res.writeHead(200, {
      'content-type': extname(file) === '.css' ? 'text/css' : 'text/javascript',
      'content-encoding': 'br',
      'cache-control': 'public, max-age=31536000, immutable',
    });
    return void res.end(brotliCompressSync(readFileSync(file)));
  }
  const sent: Buffer[] = [];
  req.on('data', (chunk) => sent.push(chunk));
  req.on('end', () => {
    const forward = request(
      {
        host: upstream.hostname,
        port: upstream.port,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, host: upstream.host, 'accept-encoding': 'identity' },
      },
      (answer) => {
        const body: Buffer[] = [];
        answer.on('data', (chunk) => body.push(chunk));
        answer.on('end', () => {
          const headers = { ...answer.headers };
          delete headers['content-length'];
          const text = /html|json|javascript|css|svg/.test(String(answer.headers['content-type'] ?? ''));
          if (text) headers['content-encoding'] = 'gzip';
          res.writeHead(answer.statusCode ?? 200, headers);
          res.end(text ? gzipSync(Buffer.concat(body)) : Buffer.concat(body));
        });
      },
    );
    forward.on('error', () => res.writeHead(502).end());
    forward.end(Buffer.concat(sent));
  });
});
await new Promise<void>((done) => front.listen(5412, done));
const origin = 'http://localhost:5412';

interface Timing {
  ready: number;
  parsed: number;
  requests: number;
  sdk: Array<{ name: string; start: number; end: number; bytes: number }>;
}

async function visit(context: BrowserContext, path: string, warm: boolean): Promise<Timing> {
  const page = await context.newPage();
  await page.addInitScript((api) => {
    const w = window as unknown as { __t: { ready?: number; parsed?: number } };
    w.__t = {};
    const real = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const local = new RegExp(api).exec(url);
      return local ? real(`/__api${local[1]}`, init) : real(input, init);
    };
    document.addEventListener('DOMContentLoaded', () => (w.__t.parsed = performance.now()));
    new MutationObserver(() => {
      if (!w.__t.ready && document.documentElement?.hasAttribute('data-next-ready')) w.__t.ready = performance.now();
    }).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-next-ready'] });
  }, API.source);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setBlockedURLs', { urls: BLOCKED });
  if (warm) {
    await page.goto(origin + path);
    await page.waitForSelector('html[data-next-ready]', { state: 'attached', timeout: 60000 });
    await page.waitForTimeout(1500);
  }
  await cdp.send('Network.emulateNetworkConditions', SLOW_4G);
  await page.goto(origin + path, { waitUntil: 'commit' });
  await page.waitForSelector('html[data-next-ready]', { state: 'attached', timeout: 120000 });
  return page.evaluate(() => {
    const t = (window as unknown as { __t: { ready: number; parsed: number } }).__t;
    const before = (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).filter(
      (r) => r.startTime < t.ready,
    );
    return {
      ready: Math.round(t.ready),
      parsed: Math.round(t.parsed),
      requests: before.length,
      sdk: before
        .map((r) => ({
          name: new URL(r.name).pathname.replace(/-[\w-]{8}\.js$/, '.js'),
          start: Math.round(r.startTime),
          end: Math.round(r.responseEnd),
          bytes: r.transferSize,
        }))
        .filter((r) => /^\/__(sdk|api)\//.test(r.name)),
    };
  });
}

const browser = await chromium.launch({ executablePath: chrome(), args: ['--no-sandbox'] });
try {
  for (const path of PAGES) {
    for (const warm of [false, true]) {
      const runs: Timing[] = [];
      for (let i = 0; i < RUNS; i++) {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
        runs.push(await visit(context, path, warm));
        await context.close();
      }
      const middle = runs.sort((a, b) => a.ready - b.ready)[Math.floor(RUNS / 2)]!;
      const bytes = middle.sdk.filter((r) => r.name.startsWith('/__sdk/')).reduce((sum, r) => sum + r.bytes, 0);
      console.log(`\n${path} ${warm ? 'second visit' : 'first visit'}`);
      console.log(
        `  ready ${middle.ready} ms (runs: ${runs.map((r) => r.ready).join(', ')}), parsed ${middle.parsed} ms, ${middle.requests} requests, SDK ${bytes} B`,
      );
      for (const r of middle.sdk)
        console.log(
          `  ${String(r.start).padStart(5)} → ${String(r.end).padStart(5)} ms ${String(r.bytes).padStart(6)} B  ${r.name}`,
        );
    }
  }
} finally {
  await browser.close();
  front.close();
  await dev.close();
}
process.exit(0);
