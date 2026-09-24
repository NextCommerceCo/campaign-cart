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
import type { PhoneRules } from '../../src/core/country-service/country-service.phone';
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
 * Every request to the address-rules service, on either host it has been served from
 * (`i18n-rules.nextcommerce.com`, `i18n-rules.kasemsanm-dev.workers.dev`). The SDK's
 * base URLs live in `country-service.next-address.ts` and `address-form.api.ts`; if
 * either moves to a host this does not match, every spec below silently calls the live
 * service instead of its stub.
 */
export const ADDRESS_SERVICE_ROUTE = '**/i18n-rules.*/**';

/**
 * The phone rule each country's file carries on the address-rules service, served at
 * the top level of its spec as `spec.phone`. Copied from those files (i18n-rules-v2
 * `src/rules/{us,th,gb,ar}.ts`); Argentina's has no `callingCode` because its mobiles
 * keep a `15` only the order API's conversion removes.
 */
const PHONE_RULES: Record<string, PhoneRules> = {
  US: {
    callingCode: '1',
    nationalPrefix: '1',
    mask: '(###) ###-####',
    pattern: '^[0-9]{10,11}$',
    example: '(201) 555-0123',
  },
  TH: {
    callingCode: '66',
    nationalPrefix: '0',
    mask: '### ### ####',
    pattern: '^[0-9]{8,14}$',
    example: '081 234 5678',
  },
  GB: {
    callingCode: '44',
    nationalPrefix: '0',
    mask: '##### ######',
    pattern: '^[0-9]{7,11}$',
    example: '07400 123456',
  },
  AR: {
    nationalPrefix: '0',
    mask: '### ##-####-####',
    pattern: '^[0-9]{10,13}$',
    example: '011 15-2345-6789',
  },
};

/**
 * The countries `/v1/bootstrap` lists, in its order (by English name), each with the one
 * subdivision the stub serves so a checkout can be completed in any of them.
 */
const COUNTRIES = [
  { code: 'AR', name: 'Argentina', state: { code: 'B', name: 'Buenos Aires' } },
  { code: 'TH', name: 'Thailand', state: { code: '10', name: 'Bangkok' } },
  {
    code: 'GB',
    name: 'United Kingdom',
    state: { code: 'LND', name: 'London' },
  },
  {
    code: 'US',
    name: 'United States',
    state: { code: 'NY', name: 'New York' },
  },
];

/** A 4:3 flag, the aspect the service's flag-icons SVGs have. */
const FLAG_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="3" viewBox="0 0 4 3">' +
  '<rect width="4" height="3" fill="#3c3b6e"/></svg>';

export interface AddressServiceOptions {
  /** The visitor's country, as `/v1/bootstrap` detects it. Defaults to `US`. */
  country?: string;
  /** `false` answers as a deployment with no phone data does: no `spec.phone` at all. */
  phoneRules?: boolean;
}

/**
 * Stub everything the checkout form fetches from the address-rules service: the
 * country list, each country's rules and states, and the phone field's flags.
 *
 * Three routes, three shapes — `/v1/bootstrap` carries the country list as well as the
 * detected country's rules, `/v1/layout/:country` carries one country's, and
 * `/v1/flags/:code.svg` an image. A spec that answers the first two with the bootstrap
 * shape makes `updateFormLabels` throw. Every spec that boots a checkout form needs this.
 *
 * The phone half is {@link PHONE_RULES}. `fields.phone_number` carries what the service's
 * does apart from its localized hint, and nothing the SDK formats or checks with. The
 * address half is the same US layout for
 * every country, because no spec using this stub asserts on another country's address
 * fields. `spec.layout` is what decides which fields a country collects; a layout that
 * omits `state` produces a config with no state label however `spec.fields` reads, so it
 * has to name every field the assertions expect.
 *
 * A flag is served for every listed country, and anything else is a `404`, as the
 * service answers it.
 */
export async function stubCountryService(
  page: Page,
  { country = 'US', phoneRules: withPhone = true }: AddressServiceOptions = {}
): Promise<void> {
  const specFor = (code: string) => {
    const phone = withPhone ? PHONE_RULES[code] : undefined;
    return {
      country: code,
      layout: [['country'], ['line1'], ['city', 'state', 'postcode']],
      fields: {
        state: { label: 'State', required: true },
        postcode: { label: 'ZIP Code', required: true, example: '10001' },
        ...(phone
          ? {
              phone_number: {
                autocomplete: 'tel',
                callingCode: phone.callingCode,
                example: phone.example,
              },
            }
          : {}),
      },
      ...(phone ? { phone } : {}),
    };
  };
  const statesFor = (code: string) =>
    COUNTRIES.filter(row => row.code === code).map(row => row.state);

  await page.route(ADDRESS_SERVICE_ROUTE, route => {
    const { pathname } = new URL(route.request().url());

    if (pathname.startsWith('/v1/flags/')) {
      const flag = pathname.match(/^\/v1\/flags\/([a-z]{2})\.svg$/)?.[1];
      return COUNTRIES.some(row => row.code.toLowerCase() === flag)
        ? route.fulfill({ contentType: 'image/svg+xml', body: FLAG_SVG })
        : route.fulfill({ status: 404, json: { error: 'not_found' } });
    }

    const layout = pathname.match(/^\/v1\/layout\/([A-Z]{2})$/)?.[1];
    if (layout) {
      return route.fulfill({
        json: { spec: specFor(layout), states: statesFor(layout) },
      });
    }

    return route.fulfill({
      json: {
        geo: { country },
        spec: specFor(country),
        countries: COUNTRIES.map(({ code, name }) => ({ code, name })),
        states: statesFor(country),
      },
    });
  });
}

/**
 * Aborts every request that is not for the dev server, and returns the URLs it
 * aborted so a spec can assert the list is empty.
 *
 * Call it **before** any other stub. Playwright consults routes newest first, so this
 * catch-all, registered first, only sees what no stub answered — which is exactly the
 * request that would otherwise have reached a live server.
 */
export async function blockLiveNetwork(page: Page): Promise<string[]> {
  const escaped: string[] = [];
  await page.route(
    url => url.hostname !== 'localhost',
    route => {
      escaped.push(route.request().url());
      return route.abort('blockedbyclient');
    }
  );
  return escaped;
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
