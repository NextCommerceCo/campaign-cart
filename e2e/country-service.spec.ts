import { test, expect } from '@playwright/test';
import type { Campaign } from '../src/types/campaign';
import { RICH_CAMPAIGN } from './fixtures/campaign';
import { stubCampaign, stubCart, bootSdk } from './fixtures/routes';
import type { Page } from '@playwright/test';

/**
 * CountryService drives the checkout form's country/state dropdowns. It fetches
 * the country list + geo from the countries CDN, filters the list to the
 * campaign's `available_shipping_countries`, and — when a country is picked —
 * fetches and renders that country's states.
 *
 * It also owns the postcode rules, which is the second half of this file:
 * [issue #92](https://github.com/NextCommerceCo/campaign-cart/issues/92), where
 * `CR2 6XH` was rewritten to `CR26 XH` and then failed the SDK's own check. A
 * country's `postcodeFormat` puts its literals at fixed offsets from the *start*,
 * which only fits a fixed-length postcode; GB outward codes run 2 to 4 characters,
 * so anchoring the pattern from the start moved the space for every length but
 * one. What is proved here is the pair: the value the field ends up showing, and
 * that the same value then passes the form's postcode validation. Either one alone
 * can be green while a shopper is still blocked.
 *
 * Why not a unit test: the formatter runs from the checkout form's `input`
 * handler on every keystroke and writes back into the live field, restoring the
 * caret. A unit test can call `formatPostalCode('m11ae')` once; only a browser
 * types the fifth character into a field the fourth one already rewrote.
 *
 * The CDN (cdn-countries.muddy-wind-c7ca.workers.dev) is stubbed here so the
 * test is deterministic. Endpoints: `/location` and `/countries/{CODE}/states`
 * (src/core/country-service.ts).
 */

const FIXTURE = '/e2e/fixtures/country-service.html';

const COUNTRY = '[data-next-checkout-field="country"]';
const PROVINCE = '[data-next-checkout-field="province"]';
const POSTAL = '[data-next-checkout-field="postal"]';

const US_AND_CA = [
  { code: 'US', label: 'United States' },
  { code: 'CA', label: 'Canada' },
];

// RICH_CAMPAIGN ships to US + CA; force auto currency so the SDK also loads geo.
const CAMPAIGN: Campaign = {
  ...RICH_CAMPAIGN,
  available_shipping_countries: US_AND_CA,
};

/** The postcode tests need GB offered, which the filtering test needs it not to be. */
const GB_CAMPAIGN: Campaign = {
  ...CAMPAIGN,
  available_shipping_countries: [
    ...US_AND_CA,
    { code: 'GB', label: 'United Kingdom' },
  ],
};

const US_CONFIG = {
  stateLabel: 'State',
  stateRequired: true,
  postcodeLabel: 'ZIP Code',
  postcodeRegex: null,
  postcodeMinLength: 5,
  postcodeMaxLength: 10,
  postcodeExample: null,
  postcodeFormat: null,
  currencyCode: 'USD',
  currencySymbol: '$',
};

/**
 * Canada: fixed length, so its pattern fits from the start. Kept alongside GB so
 * that anchoring the pattern from the end cannot quietly break the case that
 * already worked. These values mirror the SDK's own fallback for CA
 * (`getDefaultCountryConfig`), plus the format the CDN serves.
 */
const CA_CONFIG = {
  ...US_CONFIG,
  stateLabel: 'Province',
  postcodeLabel: 'Postal Code',
  postcodeRegex: '^[A-Z]\\d[A-Z] ?\\d[A-Z]\\d$',
  postcodeMinLength: 6,
  postcodeMaxLength: 7,
  postcodeExample: 'K1A 0B1',
  postcodeFormat: 'ANA NAN',
  currencyCode: 'CAD',
};

/** The live CDN's GB entry, verbatim. */
const GB_CONFIG = {
  stateLabel: 'County',
  stateRequired: false,
  postcodeLabel: 'Postcode',
  postcodeRegex: '^[A-Za-z]{1,2}\\d[A-Za-z\\d]? ?\\d[A-Za-z]{2}$',
  postcodeMinLength: 5,
  postcodeMaxLength: 8,
  postcodeExample: 'SW1A 0AA',
  postcodeFormat: 'AANN NAA',
  currencyCode: 'GBP',
  currencySymbol: '£',
};

/** What `/countries/{CODE}/states` answers, per country. GB has no states. */
const STATES: Record<string, { countryConfig: unknown; states: unknown[] }> = {
  US: {
    countryConfig: US_CONFIG,
    states: [
      { code: 'CA', name: 'California' },
      { code: 'NY', name: 'New York' },
    ],
  },
  CA: {
    countryConfig: CA_CONFIG,
    states: [
      { code: 'ON', name: 'Ontario' },
      { code: 'QC', name: 'Quebec' },
      { code: 'BC', name: 'British Columbia' },
    ],
  },
  GB: { countryConfig: GB_CONFIG, states: [] },
};

/** Stub the countries CDN: geo/location + per-country states. */
async function stubCountriesCdn(page: Page): Promise<void> {
  await page.route('**/cdn-countries.muddy-wind-c7ca.workers.dev/**', route => {
    const url = route.request().url();
    if (url.endsWith('/location')) {
      return route.fulfill({
        json: {
          detectedCountryCode: 'US',
          detectedCountryConfig: US_CONFIG,
          detectedStates: [],
          countries: [
            {
              code: 'US',
              name: 'United States',
              phonecode: '+1',
              currencyCode: 'USD',
              currencySymbol: '$',
            },
            {
              code: 'CA',
              name: 'Canada',
              phonecode: '+1',
              currencyCode: 'CAD',
              currencySymbol: '$',
            },
            {
              code: 'GB',
              name: 'United Kingdom',
              phonecode: '+44',
              currencyCode: 'GBP',
              currencySymbol: '£',
            },
          ],
        },
      });
    }
    const code = url.match(/\/countries\/([A-Z]{2})\/states/)?.[1] ?? 'US';
    return route.fulfill({ json: STATES[code] ?? STATES.US });
  });
}

test.beforeEach(async ({ page }) => {
  await stubCampaign(page, CAMPAIGN);
  await stubCart(page);
  await stubCountriesCdn(page);
});

test('populates the country dropdown, filtered to campaign shipping countries', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  const countrySelect = page.locator(COUNTRY);

  // Options land asynchronously after the CDN fetch.
  await expect
    .poll(() =>
      page.$$eval(
        `${COUNTRY} option`,
        opts => opts.filter(o => (o as HTMLOptionElement).value).length
      )
    )
    .toBeGreaterThan(0);

  const values = await countrySelect
    .locator('option')
    .evaluateAll(opts =>
      opts.map(o => (o as HTMLOptionElement).value).filter(Boolean)
    );

  // US + CA present (campaign ships to them); GB filtered out.
  expect(values).toContain('US');
  expect(values).toContain('CA');
  expect(values).not.toContain('GB');
});

test('selecting a country populates its state/province options', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  // Wait for the default country (US) states to load first.
  await expect
    .poll(() =>
      page.$$eval(`${PROVINCE} option`, opts =>
        opts.map(o => (o as HTMLOptionElement).textContent)
      )
    )
    .toContain('California');

  // Switch to Canada and confirm CA provinces render.
  await page.selectOption(COUNTRY, 'CA');

  await expect
    .poll(() =>
      page.$$eval(`${PROVINCE} option`, opts =>
        opts.map(o => (o as HTMLOptionElement).value)
      )
    )
    .toContain('ON');

  const provinceLabels = await page.$$eval(`${PROVINCE} option`, opts =>
    opts.map(o => (o as HTMLOptionElement).textContent)
  );
  expect(provinceLabels).toContain('Ontario');
  // US states are gone after the swap.
  expect(provinceLabels).not.toContain('California');
});

test.describe('postcode formatting', () => {
  test.beforeEach(async ({ page }) => {
    // Registered after the outer stub, and Playwright checks routes in reverse
    // registration order, so this one answers.
    await stubCampaign(page, GB_CAMPAIGN);
  });

  /**
   * Picks a country and waits for its config to arrive. The postcode placeholder
   * is written from that config (`updateFormLabels`), so it is the first thing on
   * the page that shows the formatter has a rule to work with.
   */
  async function chooseCountry(
    page: Page,
    code: string,
    postcodeLabel: string
  ): Promise<void> {
    await page.selectOption(COUNTRY, code);
    await expect(page.locator(POSTAL)).toHaveAttribute(
      'placeholder',
      postcodeLabel
    );
  }

  test('spaces a GB postcode where the country writes it, at every outward length', async ({
    page,
  }) => {
    await bootSdk(page, FIXTURE);
    await chooseCountry(page, 'GB', 'Postcode');

    const postal = page.locator(POSTAL);

    // Two-character outward code. This is what issue #92 showed as `M11A E`.
    await postal.pressSequentially('m11ae');
    await expect(postal).toHaveValue('M1 1AE');

    // Three characters, the code from the issue itself, previously `CR26 XH`.
    await postal.fill('');
    await postal.pressSequentially('cr26xh');
    await expect(postal).toHaveValue('CR2 6XH');

    // Four characters: the one length the start-anchored pattern already fitted.
    await postal.fill('');
    await postal.pressSequentially('sw1a1aa');
    await expect(postal).toHaveValue('SW1A 1AA');
  });

  /**
   * The negative control. Every assertion above is "a space appears"; a formatter
   * that inserted one on every keystroke would pass them and still make the field
   * unusable, because a half-typed value cannot be told apart from a finished one
   * by length alone.
   */
  test('leaves a half-typed GB postcode exactly as typed', async ({ page }) => {
    await bootSdk(page, FIXTURE);
    await chooseCountry(page, 'GB', 'Postcode');

    const postal = page.locator(POSTAL);
    await postal.pressSequentially('M11A');

    await expect(postal).toHaveValue('M11A');
  });

  test('a formatted GB postcode passes the form validation', async ({
    page,
  }) => {
    await bootSdk(page, FIXTURE);
    await chooseCountry(page, 'GB', 'Postcode');

    const postal = page.locator(POSTAL);
    await postal.pressSequentially('m11ae');
    await expect(postal).toHaveValue('M1 1AE');

    await page.click('button[type="submit"]');

    // The submit really validated: the empty required fields are flagged.
    await expect(
      page.locator('[data-next-checkout-field="fname"]')
    ).toHaveClass(/next-error-field/);
    // The postcode is not among them.
    await expect(postal).not.toHaveClass(/next-error-field/);
    await expect(
      page.locator('.next-error-label', { hasText: 'postcode' })
    ).toHaveCount(0);
  });

  test('still formats a fixed-length postal code', async ({ page }) => {
    await bootSdk(page, FIXTURE);
    await chooseCountry(page, 'CA', 'Postal Code');

    const postal = page.locator(POSTAL);
    await postal.pressSequentially('k1a0b1');

    await expect(postal).toHaveValue('K1A 0B1');
  });
});
