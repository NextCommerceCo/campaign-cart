import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { createServer, type AddressInfo } from 'node:net';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { chromium, type BrowserContext, type Page } from 'playwright-core';

process.env.DEV_CAMPAIGNS ??= join(import.meta.dirname, 'campaigns');
const { startDev } = await import('../server');

const I18N_RULES = 'i18n-rules.nextcommerce.com';
const SHOTS = 'test-results';
const WAIT = 15000;

export const SHOPPER = { email: 'e2e@example.com', fname: 'Jane', lname: 'Doe' };
export const CARD = '4242 4242 4242 4242';

export type Scenario = (t: Run) => Promise<void>;
export type Json = Record<string, any>;
type Layer = 'NextDataLayer' | 'dataLayer';
interface Seen {
  kind: Layer | 'tracking' | 'fbq';
  value: any;
  url: string;
}
interface Post {
  path: string;
  body: Json;
}

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
  if (!found)
    throw new Error('No Chromium found. Run `bunx playwright-core install chromium` or set CHROME=/path/to/chrome');
  return found;
}

/** A port nothing listens on: a running `bun dev` or QA server holds 5173. */
const freePort = () =>
  new Promise<number>((done) => {
    const probe = createServer().listen(0, () => {
      const { port } = probe.address() as AddressInfo;
      probe.close(() => done(port));
    });
  });

function recordPage() {
  const tell = (kind: string, value: unknown) => {
    try {
      (window as any).__e2e({ kind, value: JSON.parse(JSON.stringify(value)), url: location.href });
    } catch {}
  };
  for (const name of ['NextDataLayer', 'dataLayer']) {
    const layer: unknown[] = ((window as any)[name] ??= []);
    const push = layer.push.bind(layer);
    layer.push = (...items: unknown[]) => {
      for (const item of items) tell(name, item);
      return push(...items);
    };
  }
  ((window as any).nextReady ??= []).push((next: any) => next.analytics.on('*', (e: unknown) => tell('tracking', e)));
}

function patchConfig(patch: Json) {
  const patches: Json[] = ((window as any).__e2eConfig ??= []);
  if (patches.push(patch) > 1) return;
  const merge = (into: Json, from: Json): Json => {
    for (const [key, value] of Object.entries(from)) {
      const both = [into[key], value].every((v) => v && typeof v === 'object' && !Array.isArray(v));
      into[key] = both ? merge(into[key], value) : value;
    }
    return into;
  };
  let config: unknown;
  Object.defineProperty(window, 'nextConfig', {
    configurable: true,
    enumerable: true,
    get: () => config,
    set: (value) => (config = value && typeof value === 'object' ? patches.reduce(merge, value) : value),
  });
}

function stubPixel() {
  (window as any).fbq = (...args: unknown[]) =>
    (window as any).__e2e({ kind: 'fbq', value: JSON.parse(JSON.stringify(args)), url: location.href });
}

const field = (name: string) => `[data-next-checkout-field="${name}"]`;

/** One scenario's browser: its own storage and cookies, the dev server's pages and mock API. */
export class Run {
  page!: Page;
  failed = false;
  private seen: Seen[] = [];
  private posts: Post[] = [];
  private problems: string[] = [];
  private expected: RegExp[] = [];

  constructor(
    readonly name: string,
    readonly origin: string,
    private context: BrowserContext,
  ) {}

  async start(): Promise<void> {
    const { context } = this;
    await context.route(/29next\.store/, (route) => route.abort());
    await context.route(
      (url) => /29next\.com|nextcommerce\.com|spreedly\.com/.test(url.hostname) && url.hostname !== I18N_RULES,
      (route) => {
        this.problems.push(`production request blocked: ${route.request().url()}`);
        return route.abort();
      },
    );
    await context.exposeBinding('__e2e', (_, seen: Seen) => void this.seen.push(seen));
    await context.addInitScript(recordPage);
  }

  /** What the pages' `nextConfig` says from now on, over each page's own and the patches before this one. */
  async config(patch: Json): Promise<void> {
    await this.context.addInitScript(patchConfig, patch);
  }

  /** What the mock API answers a path with from now on, such as `('/api/v1/orders/', 400, { lines: ['…'] })`. */
  async api(path: string, status: number, body: unknown): Promise<void> {
    await this.context.route(
      (url) => url.origin === this.origin && url.pathname === `/__api${path}`,
      (route) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }),
    );
  }

  /** Gives every page a `window.fbq` that records its calls, as a Meta Pixel base code would define one. */
  async pixel(): Promise<void> {
    await this.context.addInitScript(stubPixel);
  }

  /** A console error or page error this scenario brings about, such as the browser's own line for an HTTP 400. */
  expect(problem: RegExp): void {
    this.expected.push(problem);
  }

  async open(
    path: string,
    params: Record<string, string> = {},
    { referer, tab = false }: { referer?: string; tab?: boolean } = {},
  ): Promise<void> {
    if (tab || !this.page) this.page = await this.tab();
    const url = new URL(path, this.origin);
    for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
    await this.page.goto(url.href, { referer });
    await this.ready();
  }

  private async tab(): Promise<Page> {
    const page = await this.context.newPage();
    page.on('console', (m) => m.type() === 'error' && this.problems.push(`console error: ${m.text()}`));
    page.on('pageerror', (e) => this.problems.push(`page error: ${e.message}`));
    page.on('request', (r) => {
      const { origin, pathname } = new URL(r.url());
      if (r.method() !== 'POST' || origin !== this.origin || !pathname.startsWith('/__api/')) return;
      try {
        this.posts.push({ path: pathname.slice('/__api'.length), body: JSON.parse(r.postData() ?? 'null') });
      } catch {}
    });
    return page;
  }

  async ready(): Promise<void> {
    await this.page.waitForSelector('html[data-next-ready]', { state: 'attached', timeout: WAIT });
  }

  /** The page the shopper is sent to next, once the SDK is ready on it. */
  async arrive(url: RegExp): Promise<void> {
    await this.page.waitForURL(url, { timeout: WAIT });
    await this.ready();
  }

  async fillCheckout(shopper: Record<string, string> = SHOPPER): Promise<void> {
    const { page } = this;
    await page.waitForFunction(
      (s) => (document.querySelector(s) as HTMLSelectElement)?.options.length > 1,
      field('province'),
    );
    for (const [name, value] of Object.entries(shopper)) await page.fill(field(name), value);
    await page.click(field('address1'));
    await page.keyboard.type('1 Main');
    await page.click('.pac-item-nextcommerce', { timeout: 5000 });
    await page.waitForFunction(
      (s) => (document.querySelector(s) as HTMLSelectElement)?.value === 'TX',
      field('province'),
    );
  }

  async pay(card = CARD): Promise<void> {
    const { page } = this;
    await page.fill('#spreedly-number input', card.replace(/\s/g, ''));
    await page.fill('#spreedly-cvv input', '123');
    await page.selectOption(field('exp-month'), '12');
    await page.selectOption(field('exp-year'), String(new Date().getFullYear() + 2));
    await page.click('button[type="submit"]');
  }

  private async all(kind: Seen['kind']): Promise<Seen[]> {
    await this.page.evaluate(() => 0).catch(() => {});
    return this.seen.filter((s) => s.kind === kind);
  }

  /** Every `dl_*` push of this scenario's pages so far, in order, each as it was pushed. */
  async events(layer: Layer = 'NextDataLayer'): Promise<Json[]> {
    return (await this.all(layer)).map((s) => s.value).filter((e) => typeof e?.event === 'string');
  }

  /** The first push of that name, waited for; `undefined` when none comes. */
  async event(name: string, layer: Layer = 'NextDataLayer', timeout = 8000): Promise<Json | undefined> {
    for (const until = Date.now() + timeout; ;) {
      const found = (await this.events(layer)).find((e) => e.event === name);
      if (found || Date.now() > until) return found;
      await new Promise((done) => setTimeout(done, 100));
    }
  }

  /** Every tracking event `next.analytics.on('*')` gave this scenario's pages. */
  async tracking(): Promise<Json[]> {
    return (await this.all('tracking')).map((s) => s.value);
  }

  /** Every call of the stub `fbq`, with the page that made it. */
  async fbq(): Promise<Array<{ args: any[]; url: string }>> {
    return (await this.all('fbq')).map((s) => ({ args: s.value, url: s.url }));
  }

  /** The JSON bodies the pages POSTed to the API, in order; `path` as the API has it (`/api/v1/orders/`). */
  requests(path?: string): Post[] {
    return this.posts.filter((p) => !path || p.path === path);
  }

  orderBody(): Json | undefined {
    return this.requests('/api/v1/orders/').at(-1)?.body;
  }

  cartBody(): Json | undefined {
    return this.requests('/api/v1/carts/').at(-1)?.body;
  }

  /** One line of the report: `ok  message`, or `FAIL message`; `seen` is printed after either as `(got …)`. */
  check(ok: unknown, message: string, ...seen: unknown[]): void {
    const got = seen.length
      ? ` (got ${seen.map((s) => (typeof s === 'string' ? s : JSON.stringify(s))).join(' ')})`
      : '';
    if (!ok) this.failed = true;
    console.log(`${ok ? 'ok  ' : 'FAIL '}${message}${got}`);
  }

  async finish(): Promise<void> {
    const problems = this.problems.filter((p) => !this.expected.some((e) => e.test(p)));
    this.check(
      !problems.length,
      'no console error, page error or blocked production request',
      problems.join(' ; ') || 'none',
    );
    if (!this.failed) return;
    mkdirSync(SHOTS, { recursive: true });
    await this.page?.screenshot({ path: join(SHOTS, `e2e-${this.name}.png`), fullPage: true }).catch(() => {});
  }
}

/** Runs each scenario in a browser of its own against one dev server; the number that failed. */
export async function runScenarios(scenarios: Record<string, Scenario>): Promise<number> {
  const { origin, close } = await startDev({
    quiet: true,
    port: await freePort(),
    pages: join(import.meta.dirname, 'pages'),
  });
  const browser = await chromium.launch({ executablePath: chrome(), args: ['--no-sandbox'] });
  const failed: string[] = [];
  try {
    for (const [name, scenario] of Object.entries(scenarios)) {
      console.log(`\n${name}`);
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const run = new Run(name, origin, context);
      try {
        await run.start();
        await scenario(run);
      } catch (err) {
        run.check(false, `${name} stopped: ${err instanceof Error ? err.message.split('\n')[0] : err}`);
      }
      await run.finish();
      if (run.failed) failed.push(name);
      await context.close();
    }
  } finally {
    await browser.close();
    await close();
  }
  const count = Object.keys(scenarios).length;
  console.log(
    failed.length
      ? `\n${failed.length} of ${count} scenarios failed: ${failed.join(', ')}`
      : `\n${count} scenarios passed`,
  );
  return failed.length;
}
