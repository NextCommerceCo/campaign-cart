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
import type {
  PhoneNumberResult,
  PhoneRules,
} from '../../src/core/i18n-rules/i18n-rules.phone';
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
  // Every page that loads a campaign also asks the address-rules service where the
  // visitor is, at boot. Stubbed here, so a spec that never thinks about addresses still
  // never reaches the live service. Only when nothing answers it yet: Playwright answers
  // with the newest route, so this would replace a stub the spec registered first.
  if (!ADDRESS_STUBBED.has(page)) await stubCountryService(page);
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
 * base URLs live in `i18n-rules.api.ts` and `address-form.api.ts`; if
 * either moves to a host this does not match, every spec below silently calls the live
 * service instead of its stub.
 */
export const ADDRESS_SERVICE_ROUTE = '**/i18n-rules.*/**';

/**
 * The phone rule each country's file carries on the address-rules service, served at
 * the top level of its spec as `spec.phone`. Copied from those files (i18n-rules
 * `src/rules/{us,th,gb,ar}.json`): a mask, a loose pattern and an example. Argentina's
 * has no `calling_code` because its mobiles keep a `15` only libphonenumber's conversion
 * removes, which the service makes.
 */
const PHONE_RULES: Record<string, PhoneRules> = {
  US: {
    calling_code: '1',
    national_prefix: '1',
    masks: [{ mask: '(###) ###-####' }],
    pattern: '^[0-9]{10,11}$',
    example: '(201) 555-0123',
  },
  TH: {
    calling_code: '66',
    national_prefix: '0',
    masks: [
      { start: '02', mask: '## ### ####' },
      { start: '0[3-57]', mask: '### ### ###' },
      { start: '1', mask: '#### ### ###' },
      { mask: '### ### ####' },
    ],
    pattern: '^[0-9]{8,14}$',
    example: '081 234 5678',
  },
  GB: {
    calling_code: '44',
    national_prefix: '0',
    masks: [{ mask: '##### ######' }],
    pattern: '^[0-9]{7,11}$',
    example: '07400 123456',
  },
  AR: {
    national_prefix: '0',
    masks: [{ mask: '### ##-####-####' }],
    pattern: '^[0-9]{10,13}$',
    example: '011 15-2345-6789',
  },
};

/**
 * What the address-rules service's `POST /v1/validate` answered, from libphonenumber, for
 * the phone numbers the specs type, keyed by the address country and the digits and `+`
 * typed. Anything else is read as not valid, as an unassigned number is.
 */
const PHONE_READINGS: Record<string, PhoneNumberResult> = {
  'US|4155552671': {
    valid: true,
    value: '+14155552671',
    country: 'US',
    type: 'fixed_line_or_mobile',
    national: '(415) 555-2671',
    international: '+1 415 555 2671',
  },
  'US|14155552671': {
    valid: true,
    value: '+14155552671',
    country: 'US',
    type: 'fixed_line_or_mobile',
    national: '(415) 555-2671',
    international: '+1 415 555 2671',
  },
  'US|+66812345678': {
    valid: true,
    value: '+66812345678',
    country: 'TH',
    type: 'mobile',
    national: '081 234 5678',
    international: '+66 81 234 5678',
  },
  'US|+447400123456': {
    valid: true,
    value: '+447400123456',
    country: 'GB',
    type: 'mobile',
    national: '07400 123456',
    international: '+44 7400 123456',
  },
  // One digit short of a Thai mobile, typed on a US address.
  'US|+6683873196': {
    valid: false,
    error: {
      code: 'invalid',
      message: 'Enter a valid phone number, like +66 81 234 5678',
    },
  },
  'TH|0812345678': {
    valid: true,
    value: '+66812345678',
    country: 'TH',
    type: 'mobile',
    national: '081 234 5678',
    international: '+66 81 234 5678',
  },
  'TH|020176091': {
    valid: true,
    value: '+6620176091',
    country: 'TH',
    type: 'fixed_line',
    national: '02 017 6091',
    international: '+66 2 017 6091',
  },
  'TH|00166812345678': {
    valid: true,
    value: '+66812345678',
    country: 'TH',
    type: 'mobile',
    national: '081 234 5678',
    international: '+66 81 234 5678',
  },
  'TH|0066812345678': {
    valid: true,
    value: '+66812345678',
    country: 'TH',
    type: 'mobile',
    national: '081 234 5678',
    international: '+66 81 234 5678',
  },
  'TH|66812345678': {
    valid: true,
    value: '+66812345678',
    country: 'TH',
    type: 'mobile',
    national: '081 234 5678',
    international: '+66 81 234 5678',
  },
  'AR|0111523456789': {
    valid: true,
    value: '+5491123456789',
    country: 'AR',
    type: 'mobile',
    national: '011 15-2345-6789',
    international: '+54 9 11 2345 6789',
  },
};

/**
 * The example the service's English `invalid` message shows, by address country; with
 * none, it shows a number written from abroad.
 */
const PHONE_EXAMPLES: Record<string, string> = {
  AR: '011 15-2345-6789',
  GB: '07400 123456',
  TH: '081 234 5678',
  US: '(201) 555-0123',
};

/**
 * What the service answered for the postcodes the specs type, keyed by the address
 * country, the state sent and the postcode. Anything else is answered `valid: null`, as
 * for a country it checks nothing in, so a spec that does not care sees no message.
 */
const POSTCODE_READINGS: Record<string, unknown> = {
  'US|NY|94103': {
    valid: false,
    error: {
      code: 'not_in_state',
      message: 'Enter a valid ZIP Code for New York',
    },
    state: 'CA',
  },
  'US|NY|10001': { valid: true, value: '10001', state: 'NY' },
};

/** `POST /v1/validate`'s answer for one field, from the readings above. */
function readField(
  name: string,
  value: string,
  country = '',
  fields: Record<string, string> = {}
): unknown {
  if (name === 'postcode') {
    return (
      POSTCODE_READINGS[`${country}|${fields.state ?? ''}|${value}`] ?? {
        valid: null,
      }
    );
  }
  if (name !== 'phone_number') return { valid: null };
  const read = PHONE_READINGS[`${country}|${value.replace(/[^\d+]/g, '')}`];
  const example = PHONE_EXAMPLES[country] ?? '+1 201 555 0123';
  return (
    read ?? {
      valid: false,
      error: {
        code: 'invalid',
        message: `Enter a valid phone number, like ${example}`,
      },
    }
  );
}

/**
 * The countries `/v1/countries` lists, in its order (by English name), each with the one
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

/** Pages whose address-rules service is already answered, so {@link stubCampaign} leaves them be. */
const ADDRESS_STUBBED = new WeakSet<Page>();

/** One country's rules, as geo's `rules` and `/v1/countries/:country` carry them. */
export type CountryAnswer = Record<string, unknown> & { states?: unknown[] };

/** One field of a country's rules, in the service's shape (`docs/http-api.md` there). */
export function ruleField(
  label: string,
  autocomplete: string,
  input: Record<string, unknown> = { type: 'text' },
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    label,
    label_optional: `${label} (optional)`,
    required: true,
    autocomplete,
    input,
    errors: {},
    ...extra,
  };
}

/** A country as the service answers it: its code, and its name in the answer's language. */
function namedCountry(code: string): { code: string; name: string } {
  const name = new Intl.DisplayNames(['en'], { type: 'region' }).of(code);
  return { code, name: name ?? code };
}

/**
 * A country's rules in the service's shape: the `address` rows and the fields named. Only
 * what a spec names is described, as the service does it.
 */
export function countryRules(
  country: string,
  address: string[][],
  fields: Record<string, unknown>,
  extra: Record<string, unknown> = {}
): CountryAnswer {
  return {
    country: namedCountry(country),
    lang: 'en',
    curated: true,
    version: 'e2e',
    address: { layout: address, fixed: {} },
    fields,
    ...extra,
  };
}

/** What a spec's stand-in for the address-rules service answers, route by route. */
export interface AddressServiceAnswers {
  /** The visitor's country, as `/v1/geo` detects it. Defaults to `US`. */
  detected?: string;
  /** Whatever else `/v1/geo` reports: `currency`, `ip`. */
  geo?: Record<string, unknown>;
  /** `/v1/countries`. Each also gets a flag at `/v1/flags/:code.svg`. */
  countries: Array<{ code: string; name: string }>;
  /** A country's rules in the language asked for. May wait, to hold a response back. */
  rules: (
    country: string,
    request: { lang: string; withStates: boolean }
  ) => CountryAnswer | Promise<CountryAnswer>;
  /** `/v1/locales/:lang`. Unset, or nothing for a language, answers `{}`: no templates. */
  locale?: (lang: string) => Record<string, string> | undefined;
}

/**
 * Stands in for the address-rules service on every route the SDK calls, so a spec says
 * what the service knows and this says how it is served:
 *
 * | Route | Answer |
 * |---|---|
 * | `/v1/geo?include=rules,states` | the visitor, and `rules` for `?country=` or the detected one |
 * | `/v1/countries` | `countries` |
 * | `/v1/countries/:country?include=states` | `rules(country)` |
 * | `/v1/locales/:lang` | `locale(lang)`, or `{}` |
 * | `/v1/flags/:code.svg` | a flag for a listed country, or a `404` |
 * | `POST /v1/validate` | each field read from {@link PHONE_READINGS} and `POSTCODE_READINGS` |
 *
 * `states` reaches the page only when the request asked for it, as the service does it.
 * Anything else is a `404`, so a route the SDK should not be calling fails loudly.
 */
export async function routeAddressService(
  page: Page,
  answers: AddressServiceAnswers
): Promise<void> {
  ADDRESS_STUBBED.add(page);
  const notFound = { status: 404, json: { error: 'not_found' } };

  await page.route(ADDRESS_SERVICE_ROUTE, async route => {
    const url = new URL(route.request().url());
    const { pathname, searchParams } = url;
    const lang = searchParams.get('lang') ?? 'en';
    const include = (searchParams.get('include') ?? '').split(',');
    const withStates = include.includes('states');
    const rulesFor = async (country: string): Promise<CountryAnswer> => {
      const { states, ...rest } = await answers.rules(country, {
        lang,
        withStates,
      });
      return withStates && states?.length ? { ...rest, states } : rest;
    };

    if (pathname.startsWith('/v1/flags/')) {
      const flag = pathname.match(/^\/v1\/flags\/([a-z]{2})\.svg$/)?.[1];
      return answers.countries.some(row => row.code.toLowerCase() === flag)
        ? route.fulfill({ contentType: 'image/svg+xml', body: FLAG_SVG })
        : route.fulfill(notFound);
    }
    if (pathname.startsWith('/v1/locales/')) {
      const body = answers.locale?.(pathname.slice('/v1/locales/'.length));
      return route.fulfill({ json: body ?? {} });
    }
    if (pathname === '/v1/countries') {
      return route.fulfill({ json: answers.countries });
    }
    if (pathname === '/v1/validate' && route.request().method() === 'POST') {
      const body = (route.request().postDataJSON() ?? {}) as {
        country?: string;
        fields?: Record<string, string>;
      };
      const fields = Object.fromEntries(
        Object.entries(body.fields ?? {}).map(([name, value]) => [
          name,
          readField(name, value, body.country, body.fields),
        ])
      );
      return route.fulfill({
        json: { lang: 'en', fields },
        headers: {
          'cache-control': 'private, no-store',
          'content-language': 'en',
        },
      });
    }
    const country = pathname.match(/^\/v1\/countries\/([^/]+)$/)?.[1];
    if (country) {
      return route.fulfill({
        json: await rulesFor(decodeURIComponent(country).toUpperCase()),
      });
    }
    if (pathname === '/v1/geo') {
      const detected = answers.detected ?? 'US';
      const asked = searchParams.get('country')?.toUpperCase() ?? detected;
      return route.fulfill({
        json: {
          country: namedCountry(detected),
          ...answers.geo,
          ...(include.includes('rules')
            ? { rules: await rulesFor(asked) }
            : {}),
        },
      });
    }
    return route.fulfill(notFound);
  });
}

export interface AddressServiceOptions {
  /** The visitor's country, as `/v1/geo` detects it. Defaults to `US`. */
  country?: string;
  /** `false` answers as a deployment with no phone data does: no `spec.phone` at all. */
  phoneRules?: boolean;
  /** `/v1/locales/:lang`'s texts, in every language; none by default. */
  texts?: Record<string, string>;
}

/**
 * Stub everything the checkout form fetches from the address-rules service, through
 * {@link routeAddressService}: the country list, each country's rules and states, and the
 * phone field's flags. Every spec that boots a checkout form needs this.
 *
 * The phone half is {@link PHONE_RULES}. `fields.phone_number` carries what the service's
 * does, and nothing the SDK formats or checks with. The
 * address half is the same US layout for every country, because no spec using this stub
 * asserts on another country's address fields. `spec.layout` is what decides which fields
 * a country collects; a layout that omits `state` produces a config with no state label
 * however `spec.fields` reads, so it has to name every field the assertions expect.
 */
export async function stubCountryService(
  page: Page,
  {
    country = 'US',
    phoneRules: withPhone = true,
    texts,
  }: AddressServiceOptions = {}
): Promise<void> {
  const rulesFor = (code: string) => {
    const phone = withPhone ? PHONE_RULES[code] : undefined;
    return countryRules(
      code,
      [['country'], ['line1'], ['city', 'state', 'postcode']],
      {
        state: ruleField('State', 'address-level1', {
          type: 'select',
          options: 'states',
        }),
        postcode: ruleField(
          'ZIP Code',
          'postal-code',
          { type: 'text' },
          {
            format: { example: '10001' },
          }
        ),
        ...(phone
          ? {
              phone_number: ruleField(
                'Phone number',
                'tel',
                { type: 'tel', input_mode: 'tel' },
                { required: false, format: phone }
              ),
            }
          : {}),
      }
    );
  };

  await routeAddressService(page, {
    detected: country,
    ...(texts ? { locale: () => texts } : {}),
    countries: COUNTRIES.map(({ code, name }) => ({ code, name })),
    rules: code => ({
      ...rulesFor(code),
      states: COUNTRIES.filter(row => row.code === code).map(row => row.state),
    }),
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
