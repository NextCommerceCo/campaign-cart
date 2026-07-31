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

import type { Page } from '@playwright/test';
import type { Campaign } from '../../src/types/campaign';
import type { Order } from '../../src/types/api';
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
 * Stub `POST /api/v1/carts/calculate/`. Cart totals are computed client-side by
 * the SDK's cart-calculator, so this only needs to resolve the debounced
 * recalculation call with a well-formed empty summary.
 */
export async function stubCart(page: Page): Promise<void> {
  await page.route('**/api/v1/carts/calculate/**', route =>
    route.fulfill({ json: { lines: [], totals: {} } })
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
      page.evaluate(
        ({ k, index }) => (window as any)[k][index],
        { k: key, index }
      ),
  };
}
