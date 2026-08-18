/**
 * Shared network stubs + boot helpers for E2E specs.
 *
 * The SDK talks to `campaigns.apps.29next.com`. Every spec fakes those calls
 * with `page.route` so tests are deterministic and never hit the live backend —
 * only the network is faked; the SDK itself is the real one served by Vite.
 *
 * Usage:
 *   test.beforeEach(async ({ page }) => { await stubAll(page); });
 *   test('...', async ({ page }) => { await bootSdk(page, '/e2e/fixtures/x.html'); });
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';
import type { Campaign } from '../../src/types/campaign';
import type { CartSummary, Order } from '../../src/types/api';
import { RICH_CAMPAIGN } from './campaign';
import { TEST_ORDER } from './order';

/** Stub `GET /api/v1/campaigns/` with the given campaign (defaults to RICH). */
export async function stubCampaign(
  page: Page,
  campaign: Campaign = RICH_CAMPAIGN
): Promise<void> {
  await page.route('**/api/v1/campaigns/**', route =>
    route.fulfill({ json: campaign })
  );
}

/**
 * An empty but **complete** `CartSummary` — every field `buildCartFields()` reads.
 *
 * `subtotal`, `total` and `total_discount` are not optional: the calculator does
 * `new Decimal(response.subtotal)` on each, and `new Decimal(undefined)` throws
 * `[DecimalError] Invalid argument: undefined`. This stub used to return
 * `{ lines: [], totals: {} }` — which is not a `CartSummary` at all — so **every
 * spec that touched the cart ran the caught-error path** while the suite stayed
 * green, because nothing here asserts on `console.error`. See the `sdk-e2e` skill
 * §4b.
 */
const EMPTY_CART_SUMMARY: CartSummary = {
  lines: [],
  // A complete method, not `{}`. The calculator guards with
  // `if (response.shipping_method)`, and an empty object passes that guard and
  // then throws on `new Decimal(sm.price)` — truthy is not the same as usable.
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
};

/**
 * Stub `POST /api/v1/carts/calculate/`. Cart totals are computed client-side by
 * the SDK's cart-calculator, so this only has to resolve the debounced
 * recalculation call with a well-formed empty summary — see
 * {@link EMPTY_CART_SUMMARY} for what "well-formed" has to mean.
 *
 * Pass `summary` when a spec needs real totals back from the API.
 */
export async function stubCart(
  page: Page,
  summary: CartSummary = EMPTY_CART_SUMMARY
): Promise<void> {
  await page.route('**/api/v1/carts/calculate/**', route =>
    route.fulfill({ json: summary })
  );
}

/**
 * Stub the order endpoints:
 * - `POST /api/v1/orders/` (checkout create) → the order
 * - `GET  /api/v1/orders/{ref}/` (receipt load) → the order
 * - `POST /api/v1/orders/{ref}/upsells/` (accept upsell) → the order
 */
export async function stubOrder(
  page: Page,
  order: Order = TEST_ORDER
): Promise<void> {
  await page.route('**/api/v1/orders/**', route =>
    route.fulfill({ json: order })
  );
}

/** Stub prospect-cart create/update/get/abandon/convert → echoes an id. */
export async function stubProspectCart(page: Page): Promise<void> {
  await page.route('**/api/v1/prospect-carts/**', route =>
    route.fulfill({ json: { id: 'prospect-1', cart_id: 'prospect-1' } })
  );
}

/**
 * Stub the country/state lists the checkout form's `CountryService` fetches from
 * an external CDN.
 *
 * Two endpoints, two shapes — only `/states` carries `countryConfig`, and
 * answering both with the location shape makes `updateFormLabels` throw. Every
 * spec that boots a checkout form needs this.
 */
export async function stubCountryService(page: Page): Promise<void> {
  await page.route('**/cdn-countries*/**', route => {
    const config = {
      stateLabel: 'State',
      stateRequired: true,
      postcodeLabel: 'ZIP Code',
      postcodeRegex: '',
      postcodeExample: '10001',
      stateExample: 'NY',
    };
    if (route.request().url().includes('/states')) {
      return route.fulfill({
        json: {
          countryConfig: config,
          states: [{ code: 'NY', name: 'New York' }],
        },
      });
    }
    return route.fulfill({
      json: {
        detectedCountryCode: 'US',
        detectedCountryConfig: config,
        detectedStates: [{ code: 'NY', name: 'New York' }],
        countries: [{ code: 'US', name: 'United States' }],
      },
    });
  });
}

/**
 * Stub the address autocomplete provider. `suggestions` is returned verbatim as
 * the `predictions`/results payload the enhancer consumes.
 */
export async function stubAddressAutocomplete(
  page: Page,
  suggestions: unknown[] = []
): Promise<void> {
  await page.route('**/api/v1/addresses/autocomplete/**', route =>
    route.fulfill({ json: { results: suggestions, predictions: suggestions } })
  );
}

/**
 * Stub everything a typical spec needs: campaign + cart calculate. Pass a custom
 * campaign to override. Order/prospect/address stubs are opt-in via their own
 * helpers since most specs don't need them.
 */
export async function stubAll(
  page: Page,
  opts: { campaign?: Campaign } = {}
): Promise<void> {
  await stubCampaign(page, opts.campaign);
  await stubCart(page);
}

/** Navigate to a fixture and wait for the SDK to expose `window.next.on`. */
export async function bootSdk(page: Page, fixture: string): Promise<void> {
  await page.goto(fixture);
  await page.waitForFunction(() => Boolean((window as any).next?.on));
}

/**
 * Serve an existing fixture at a URL of your choosing.
 *
 * Vite maps a URL to a path on disk, so every fixture is served from
 * `/e2e/fixtures/…` and they all share a first path segment. A spec about what the
 * **URL** decides therefore cannot get two different ones out of the dev server —
 * it has to fulfil the navigation itself. Only the navigation is faked: the
 * fixture's `<script type="module" src="/src/index.ts">` is an absolute URL, so the
 * SDK under test is still the real one Vite serves.
 *
 * `fixture` is a path relative to `e2e/fixtures/`; Playwright runs from the repo
 * root, which is what `resolve` is relative to.
 */
export async function bootSdkAt(
  page: Page,
  url: string,
  fixture: string
): Promise<void> {
  const body = readFileSync(resolve('e2e/fixtures', fixture), 'utf8');

  await page.route(`**${url}`, route =>
    route.fulfill({ contentType: 'text/html', body })
  );
  await bootSdk(page, url);
}

/**
 * Start collecting EventBus payloads for `eventName` into a window array.
 * Returns a getter for the captured payloads. Call BEFORE the action that fires
 * the event (after `bootSdk`).
 *
 *   const added = await captureEvents(page, 'cart:item-added');
 *   await page.click('...');
 *   await expect.poll(() => added.count()).toBeGreaterThan(0);
 */
export async function captureEvents(page: Page, eventName: string) {
  const key = `__evt_${eventName.replace(/[^a-z0-9]/gi, '_')}`;
  await page.evaluate(
    ({ key, eventName }) => {
      (window as any)[key] = [];
      (window as any).next.on(eventName, (d: unknown) =>
        (window as any)[key].push(d)
      );
    },
    { key, eventName }
  );
  return {
    /** Number of times the event has fired so far. */
    count: () => page.evaluate(k => (window as any)[k].length, key),
    /** All captured payloads. */
    all: () => page.evaluate(k => (window as any)[k], key),
    /** The payload at `index` (default 0). */
    at: (index = 0) =>
      page.evaluate(({ k, index }) => (window as any)[k][index], {
        k: key,
        index,
      }),
  };
}
