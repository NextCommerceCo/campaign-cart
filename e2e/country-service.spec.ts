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
 * The CDN (cdn-countries.muddy-wind-c7ca.workers.dev) is stubbed here so the
 * test is deterministic. Endpoints: `/location` and `/countries/{CODE}/states`
 * (src/core/country-service.ts).
 */

const FIXTURE = '/e2e/fixtures/country-service.html';

// RICH_CAMPAIGN ships to US + CA; force auto currency so the SDK also loads geo.
const CAMPAIGN: Campaign = {
  ...RICH_CAMPAIGN,
  available_shipping_countries: [
    { code: 'US', label: 'United States' },
    { code: 'CA', label: 'Canada' },
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

const CA_CONFIG = { ...US_CONFIG, stateLabel: 'Province', currencyCode: 'CAD' };

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
            { code: 'US', name: 'United States', phonecode: '+1', currencyCode: 'USD', currencySymbol: '$' },
            { code: 'CA', name: 'Canada', phonecode: '+1', currencyCode: 'CAD', currencySymbol: '$' },
            { code: 'GB', name: 'United Kingdom', phonecode: '+44', currencyCode: 'GBP', currencySymbol: '£' },
          ],
        },
      });
    }
    if (url.includes('/countries/CA/states')) {
      return route.fulfill({
        json: {
          countryConfig: CA_CONFIG,
          states: [
            { code: 'ON', name: 'Ontario' },
            { code: 'QC', name: 'Quebec' },
            { code: 'BC', name: 'British Columbia' },
          ],
        },
      });
    }
    // Default: US states.
    return route.fulfill({
      json: {
        countryConfig: US_CONFIG,
        states: [
          { code: 'CA', name: 'California' },
          { code: 'NY', name: 'New York' },
        ],
      },
    });
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

  const countrySelect = page.locator('[data-next-checkout-field="country"]');

  // Options land asynchronously after the CDN fetch.
  await expect
    .poll(() =>
      page.$$eval(
        '[data-next-checkout-field="country"] option',
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
      page.$$eval(
        '[data-next-checkout-field="province"] option',
        opts => opts.map(o => (o as HTMLOptionElement).textContent)
      )
    )
    .toContain('California');

  // Switch to Canada and confirm CA provinces render.
  await page.selectOption('[data-next-checkout-field="country"]', 'CA');

  await expect
    .poll(() =>
      page.$$eval(
        '[data-next-checkout-field="province"] option',
        opts => opts.map(o => (o as HTMLOptionElement).value)
      )
    )
    .toContain('ON');

  const provinceLabels = await page.$$eval(
    '[data-next-checkout-field="province"] option',
    opts => opts.map(o => (o as HTMLOptionElement).textContent)
  );
  expect(provinceLabels).toContain('Ontario');
  // US states are gone after the swap.
  expect(provinceLabels).not.toContain('California');
});
