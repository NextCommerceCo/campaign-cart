/**
 * Seeded monkey: drives random clicks and inputs across every E2E fixture and
 * reports what the SDK swallowed.
 *
 * Why it exists: no spec in `e2e/` watches the console, so an error the SDK
 * catches and logs is invisible to every assertion in the suite. That is how a
 * malformed shared stub kept 446 tests green while every cart sync threw
 * (`sdk-e2e` skill §4b). This walks the fixtures the way a confused shopper
 * would and collects `console.error` plus `pageerror`.
 *
 * Reproducibility is the point — a finding you cannot replay is not actionable —
 * so every choice comes from a seeded PRNG. Same `--seed`, same run.
 *
 *   node scripts/monkey.mjs                        # all fixtures, seed 1
 *   node scripts/monkey.mjs --seed 7 --actions 40
 *   node scripts/monkey.mjs --fixture cart-summary --headed
 *
 * Needs the dev server on :3000 (`npm run dev`); it starts one if none answers,
 * mirroring `playwright.config.ts`.
 *
 * Two traps this file is written around, both of which have produced phantom
 * findings before:
 *   - `page.route('**\/api/**')` also matches Vite serving `/src/api/client.ts`,
 *     which then arrives as JSON and kills the module graph. Globs are scoped to
 *     the real API prefix, `**\/api/v1/**`.
 *   - Playwright checks routes in REVERSE registration order, so the catch-all is
 *     registered FIRST and the specific stubs after it.
 */

import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { createConnection } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_DIR = join(ROOT, 'e2e', 'fixtures');
const ORIGIN = 'http://localhost:3000';
/** Stands in for PayPal — a page on this origin that boots no SDK. */
const GATEWAY_FIXTURE = '/e2e/fixtures/express-gateway.html';

// ── args ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const SEED = Number(flag('seed', 1));
const ACTIONS = Number(flag('actions', 25));
const ONLY = flag('fixture', null);
const HEADED = args.includes('--headed');
/** Prints every action the monkey takes — for when a fixture reports nothing and
 *  you need to know whether it was actually driven or just stared at. */
const VERBOSE = args.includes('--verbose');

/** mulberry32 — small, seedable, and identical across runs. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── fixtures + stubs ─────────────────────────────────────────────────────────

const fixtures = readdirSync(FIXTURE_DIR)
  .filter(f => f.endsWith('.html'))
  .filter(f => !ONLY || f.startsWith(ONLY))
  .sort();

/**
 * Fixtures that only reach their interesting state when opened the way their spec
 * opens them. A post-purchase page with no `?ref_id=` has no order, so
 * `canAddUpsells()` is false and every accept button answers "Unable to add
 * upsell at this time" — the enhancer behaving correctly, reported as a finding.
 * Taken from the `FIXTURE` constants in `e2e/*.spec.ts`; grep for
 * `fixtures/*.html?` there if a new one appears.
 */
const FIXTURE_QUERY = {
  'accept-upsell.html': '?ref_id=test-order-ref',
  'order-display.html': '?ref_id=test-order-ref',
  'order-item-list.html': '?ref_id=test-order-ref',
  'upsell.html': '?ref_id=test-order-ref',
};

/**
 * The very fixtures the specs use — `RICH_CAMPAIGN` and `TEST_ORDER` — read
 * through the dev server rather than re-typed here, so the monkey and the suite
 * can never drift apart. They are TypeScript modules; Vite transpiles them on
 * request, so the browser can just import them.
 *
 * Loaded from `express-gateway.html`, the one fixture that boots no SDK, so this
 * page cannot make an API call before any stub is registered.
 */
async function loadStubData(context) {
  const page = await context.newPage();
  await page.goto(`${ORIGIN}/e2e/fixtures/express-gateway.html`);
  const data = await page.evaluate(async () => {
    const [campaign, order] = await Promise.all([
      import('/e2e/fixtures/campaign.ts'),
      import('/e2e/fixtures/order.ts'),
    ]);
    return { campaign: campaign.RICH_CAMPAIGN, order: order.TEST_ORDER };
  });
  await page.close();
  return data;
}

/**
 * Every backend call a fixture can make, faked. Registration order matters:
 * catch-all first (Playwright takes the LAST matching route), specific after.
 */
async function stub(page, campaign, order) {
  // Playwright checks routes in REVERSE registration order — the last one added
  // wins — so these run broadest-first, most-specific-last. Getting this backwards
  // is not a subtle bug: an off-origin abort registered last swallows the campaign
  // stub, the SDK never boots, and every fixture reports the same four fetch
  // errors as if they were findings. (It did, once, while this was being written.)

  // 1. Nothing may leave the origin. A monkey that reaches the real network is
  //    not seeded. Images are answered with a 1×1 PNG rather than aborted:
  //    aborting them produced a `net::ERR_FAILED` on every fixture whose campaign
  //    has product images, which reads like a finding and is not one.
  await page.route(/^https?:\/\/(?!localhost:3000)/, route =>
    route.request().resourceType() === 'image'
      ? route.fulfill({ body: TRANSPARENT_PNG, contentType: 'image/png' })
      : route.abort()
  );

  // 2. The countries CDN, which has TWO endpoints with DIFFERENT shapes —
  //    `/location` and `/countries/{CODE}/states`, the latter carrying
  //    `countryConfig`. Answering both with the location shape leaves
  //    `countryConfig` undefined, which `updateFormLabels` reads straight into a
  //    TypeError: a stub bug that looks exactly like an SDK bug. Shapes mirror
  //    `e2e/country-service.spec.ts`, which is the authoritative version.
  const COUNTRY_CONFIG = {
    stateLabel: 'State',
    stateRequired: true,
    postcodeLabel: 'ZIP Code',
    postcodeRegex: null,
    postcodeMinLength: 5,
    postcodeMaxLength: 10,
    postcodeExample: '10001',
    currencyCode: 'USD',
    currencySymbol: '$',
  };
  await page.route('**/cdn-countries*/**', route => {
    const url = route.request().url();
    if (url.includes('/states')) {
      return route.fulfill({
        json: {
          countryConfig: COUNTRY_CONFIG,
          states: [
            { code: 'NY', name: 'New York' },
            { code: 'CA', name: 'California' },
          ],
        },
      });
    }
    return route.fulfill({
      json: {
        detectedCountryCode: 'US',
        detectedCountryConfig: COUNTRY_CONFIG,
        detectedStates: [],
        countries: [
          { code: 'US', name: 'United States', phonecode: '+1', currencyCode: 'USD', currencySymbol: '$' },
          { code: 'CA', name: 'Canada', phonecode: '+1', currencyCode: 'CAD', currencySymbol: '$' },
        ],
      },
    });
  });

  // 3. The API prefix — scoped to `/api/v1/`, never `**/api/**`, which also
  //    matches Vite serving `/src/api/client.ts` as a module.
  await page.route('**/api/v1/**', route =>
    route.fulfill({ json: { results: [], detail: 'monkey stub' } })
  );
  await page.route('**/api/v1/campaigns/**', route =>
    route.fulfill({
      json: {
        ...campaign,
        // RICH_CAMPAIGN declares no express methods, so the express container
        // renders no buttons — and a monkey with nothing to click there can never
        // reach the order-creating path the purchase invariant below is about.
        available_express_payment_methods: [
          { code: 'paypal', label: 'PayPal' },
        ],
      },
    })
  );
  await page.route('**/api/v1/carts/calculate/**', route =>
    route.fulfill({
      json: {
        lines: [],
        shipping_method: {
          id: 0,
          name: 'Standard',
          code: 'standard',
          original_price: '0.00',
          price: '0.00',
          discounts: [],
        },
        offer_discounts: [],
        voucher_discounts: [],
        subtotal: '0.00',
        total_discount: '0.00',
        total: '0.00',
        currency: 'USD',
      },
    })
  );
  // Creating an order answers the way a redirect payment really does — a real
  // order record with a `payment_complete_url` and no money moved yet — while
  // fetching one back answers with the finished order. Answering both with a
  // finished order would skip the exact state issue #71 was about.
  await page.route('**/api/v1/orders/**', route =>
    route.fulfill({
      json:
        route.request().method() === 'POST'
          ? { ...order, payment_complete_url: `${ORIGIN}${GATEWAY_FIXTURE}` }
          : order,
    })
  );
  await page.route('**/api/v1/prospect-carts/**', route =>
    route.fulfill({ json: { id: 'prospect-1', cart_id: 'prospect-1' } })
  );
  await page.route('**/api/v1/addresses/**', route =>
    route.fulfill({ json: { results: [], predictions: [] } })
  );
}

// ── the walk ─────────────────────────────────────────────────────────────────

const CLICKABLE = [
  '[data-next-action]',
  '[data-next-selector-id]',
  '[data-next-toggle]',
  '[data-next-quantity]',
  '[data-next-remove-item]',
  '[data-next-express-checkout="paypal"]',
  '[data-next-express-checkout="apple_pay"]',
  '[data-next-express-checkout="google_pay"]',
  '[data-next-express-checkout] button',
  '[data-next-upsell-action]',
  '[data-next-checkout-submit]',
  '[data-next-accordion]',
  '[data-next-tooltip]',
  'button',
  'a[href^="#"]',
  '[role="button"]',
  'summary',
  'label',
].join(', ');

/**
 * Console output a fixture is *supposed* to produce. Listed rather than filtered
 * out silently: an expected line that stops appearing means the fixture stopped
 * covering what it was built to cover.
 */
const EXPECTED = [
  {
    fixture: 'error-handler.html',
    match: 'Failed to initialize quantity enhancer',
    why: 'the fixture carries a deliberately malformed data-next-quantity with no data-package-id — that is what it exists to test',
  },
];

const expectedFor = (fixture, message) =>
  EXPECTED.find(e => e.fixture === fixture && message.includes(e.match));

const TEXT_SAMPLES = ['ada@example.test', 'Ada', '10001', '1 Test St', '42', ''];

/** 1×1 transparent PNG, for off-origin product images. */
const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYGD4DwABBAEAX+XKIgAAAABJRU5ErkJggg==',
  'base64'
);

async function walk(page, random, log) {
  for (let i = 0; i < ACTIONS; i++) {
    const inputs = await page.locator('input:visible, select:visible').all();
    const clicks = await page.locator(`${CLICKABLE}`).all();
    const pool = [...clicks, ...inputs];
    if (pool.length === 0) return;

    const target = pool[Math.floor(random() * pool.length)];
    if (VERBOSE) {
      const what = await target
        .evaluate(
          el =>
            `${el.tagName.toLowerCase()}${[...el.attributes]
              .filter(a => a.name.startsWith('data-next') || a.name === 'type')
              .map(a => `[${a.name}="${a.value}"]`)
              .join('')}`
        )
        .catch(() => '(detached)');
      log(`${i + 1}/${ACTIONS} pool=${pool.length} → ${what}`);
    }
    try {
      const tag = await target.evaluate(el => el.tagName.toLowerCase(), {
        timeout: 1000,
      });
      if (tag === 'input') {
        const type = await target.getAttribute('type');
        if (type === 'checkbox' || type === 'radio') {
          await target.click({ timeout: 1000, force: true });
        } else {
          const value = TEXT_SAMPLES[Math.floor(random() * TEXT_SAMPLES.length)];
          await target.fill(value, { timeout: 1000 });
          await target.blur({ timeout: 1000 }).catch(() => {});
        }
      } else if (tag === 'select') {
        const options = await target.locator('option').all();
        if (options.length > 1) {
          const pick = options[1 + Math.floor(random() * (options.length - 1))];
          const value = await pick.getAttribute('value');
          if (value !== null) {
            await target.selectOption(value, { timeout: 1000 });
          }
        }
      } else {
        await target.click({ timeout: 1000, force: true });
      }
    } catch {
      // A detached or covered element is a normal outcome of random clicking —
      // the console is what this run is watching, not the click's success.
      continue;
    }
    // Let subscriptions, debounced recalculations and renders settle.
    await page.waitForTimeout(60);
    if (!page.url().startsWith(ORIGIN)) {
      log(`navigated off-origin to ${page.url()} — stopping this fixture`);
      return;
    }
  }
}

// ── dev server ───────────────────────────────────────────────────────────────

const portOpen = () =>
  new Promise(resolve => {
    const socket = createConnection({ port: 3000, host: 'localhost' })
      .on('connect', () => (socket.end(), resolve(true)))
      .on('error', () => resolve(false));
  });

async function ensureDevServer() {
  if (await portOpen()) return null;
  const child = spawn('npm', ['run', 'dev'], { cwd: ROOT, stdio: 'ignore' });
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 500));
    if (await portOpen()) return child;
  }
  child.kill();
  throw new Error('dev server did not come up on :3000');
}

// ── run ──────────────────────────────────────────────────────────────────────

const server = await ensureDevServer();
const browser = await chromium.launch({ headless: !HEADED });
const findings = [];

const bootstrap = await browser.newContext();
const { campaign: CAMPAIGN, order: ORDER } = await loadStubData(bootstrap);
await bootstrap.close();

for (const fixture of fixtures) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const messages = [];

  page.on('console', m => {
    if (m.type() === 'error') messages.push(`console.error: ${m.text()}`);
  });
  page.on('pageerror', e => messages.push(`pageerror: ${String(e)}`));

  const random = rng(SEED);
  const log = line => process.stdout.write(`    ${line}\n`);

  await stub(page, CAMPAIGN, ORDER);
  try {
    const query = FIXTURE_QUERY[fixture] ?? '';
    await page.goto(`${ORIGIN}/e2e/fixtures/${fixture}${query}`, {
      timeout: 20_000,
    });
    // Fixtures that deliberately never boot (no SDK script) are still walked —
    // the point is what the console says, not whether window.next appeared.
    const booted = await page
      .waitForFunction(() => Boolean(window.next?.on), { timeout: 8000 })
      .then(() => true)
      .catch(() => {
        log('window.next never appeared (fixture may not boot one)');
        return false;
      });

    // Put something in the cart before clicking around. Half the SDK refuses to
    // do anything with an empty one — express checkout returns at its
    // `isCartEmpty` guard, so a monkey that cannot fill a cart cannot reach the
    // order-creating paths at all, and any invariant about them is vacuous. This
    // is a shopper who added an item, which is the normal case anyway.
    if (booted) {
      await page
        .evaluate(async () => {
          // getCartCount(), not getCartData(): the latter's shape has no
          // `totalQuantity`, so `cart.totalQuantity === 0` was never true and the
          // cart was never seeded — which left every express button disabled and
          // the whole order-creating path unreachable.
          if ((window.next.getCartCount?.() ?? 0) === 0) {
            await window.next.addItem({ packageId: 1 });
          }
        })
        .catch(() => log('could not seed the cart'));
      await page.waitForTimeout(200);
    }

    await walk(page, random, log);
    await page.waitForTimeout(400);

    // Issue #71's invariant, checked on every fixture rather than only in the two
    // specs that target it: no page may report a `dl_purchase` without an order to
    // report. A page carrying `?ref_id=` legitimately reports the order it loaded.
    //
    // The come-back step is what gives this teeth. A purchase raised as the page
    // navigates away is parked in `sessionStorage` rather than pushed, so looking
    // at the data layer of the page that raised it sees nothing — that is exactly
    // how the bug hid. So: if anything was parked, walk back in and look there,
    // which is the shopper pressing back from PayPal.
    const parked = await page
      .evaluate(() =>
        JSON.parse(sessionStorage.getItem('next_v2_pending_events') ?? '[]').length
      )
      .catch(() => 0);
    if (parked > 0) {
      log(`${parked} analytics event(s) parked for the next page — going back in`);
      await page.goto(`${ORIGIN}/e2e/fixtures/${fixture}${query}`);
      await page
        .waitForFunction(() => Boolean(window.next?.on), { timeout: 8000 })
        .catch(() => {});
      // The queue is replayed 200ms after analytics initialises.
      await page.waitForTimeout(1500);
    }

    const stray = await page
      .evaluate(() =>
        (window.NextDataLayer ?? [])
          .filter(e => e.event === 'dl_purchase')
          .map(e => e.ecommerce?.transaction_id ?? '(no transaction_id)')
      )
      .catch(() => []);
    if (stray.length > 0 && !page.url().includes('ref_id=')) {
      messages.push(
        `purchase invariant: dl_purchase on a page with no order — ${stray.join(', ')}`
      );
    }
  } catch (error) {
    messages.push(`harness: ${String(error).split('\n')[0]}`);
  }

  const unique = [...new Set(messages)];
  const unexpected = unique.filter(m => !expectedFor(fixture, m));
  const status =
    unique.length === 0
      ? 'clean'
      : unexpected.length === 0
        ? `${unique.length} expected`
        : `${unexpected.length} unexpected`;
  process.stdout.write(`  ${fixture.padEnd(38)} ${status}\n`);
  for (const message of unique) {
    const expected = expectedFor(fixture, message);
    process.stdout.write(
      `      ${expected ? '(expected) ' : ''}${message.slice(0, 240)}\n`
    );
    if (expected) process.stdout.write(`        └ ${expected.why}\n`);
    else findings.push({ fixture, message });
  }

  // A closed page or context is reported, not fatal: one flaky renderer teardown
  // should not throw away the other 44 fixtures' results.
  await context.close().catch(() => {});
}

await browser.close();
if (server) server.kill();

process.stdout.write(
  `\nseed ${SEED}, ${ACTIONS} actions per fixture, ${fixtures.length} fixtures — ` +
    `${findings.length} unexpected console/page error(s)\n`
);
process.exit(findings.length > 0 ? 1 : 0);
