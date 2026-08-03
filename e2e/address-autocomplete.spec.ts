import { test, expect, type Page } from '@playwright/test';
import { MINIMAL_CAMPAIGN } from './fixtures/campaign';
import { stubCampaign, stubCart, stubAddressAutocomplete, bootSdk, captureEvents } from './fixtures/routes';

/**
 * E2E for the address-autocomplete enhancer.
 *
 * address-autocomplete is not DOM-scanned; it is created inside
 * CheckoutFormEnhancer and lazy-loads a provider on the first focus of the
 * address1 field. Google Maps needs an external SDK/API key that can't load
 * headless, so this drives the NextCommerce provider instead (enabled via
 * `addressConfig.enableAutocomplete` + the api key). Selecting a suggestion
 * fills the address fields and emits `address:autocomplete-filled`.
 */

const FIXTURE = '/e2e/fixtures/address-autocomplete.html';

const SUGGESTION = {
  label: '123 Main St, Testville, NY 10001',
  address: {
    line1: '123 Main St',
    city: 'Testville',
    state: 'New York',
    state_code: 'NY',
    postcode: '10001',
    country: 'United States',
    country_code: 'US',
  },
};

/** Stub the country/states CDN the checkout form's CountryService calls. */
async function stubCountryService(page: Page): Promise<void> {
  await page.route('**/cdn-countries.muddy-wind-c7ca.workers.dev/**', route => {
    const url = route.request().url();
    if (url.includes('/location')) {
      return route.fulfill({
        json: {
          detectedCountryCode: 'US',
          countries: [{ code: 'US', name: 'United States' }],
        },
      });
    }
    return route.fulfill({
      json: {
        countryConfig: { stateLabel: 'State', stateRequired: false, postcodeLabel: 'ZIP' },
        states: [],
      },
    });
  });
}

test.beforeEach(async ({ page }) => {
  await stubCampaign(page, MINIMAL_CAMPAIGN);
  await stubCart(page);
  await stubCountryService(page);
  await stubAddressAutocomplete(page, [SUGGESTION]);

  // Enable the NextCommerce autocomplete provider (Google Maps stays off).
  await page.addInitScript(() => {
    (window as any).nextConfig = {
      addressConfig: { enableAutocomplete: true },
    };
  });
});

test('selecting a NextCommerce suggestion fills fields and emits address:autocomplete-filled', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  const filled = await captureEvents(page, 'address:autocomplete-filled');

  const address1 = page.locator('[data-next-checkout-field="address1"]');

  // First focus lazy-loads the NextCommerce provider and wires the field.
  await address1.click();
  // Two words trigger the provider's search (requires \S\s+\S).
  await address1.fill('123 Main');

  // The suggestion dropdown renders in a body-level container.
  const suggestion = page.locator('.pac-item-nextcommerce').first();
  await expect(suggestion).toBeVisible();
  await suggestion.click();

  // Fields are populated from the selected suggestion.
  await expect(address1).toHaveValue('123 Main St');
  await expect(page.locator('[data-next-checkout-field="city"]')).toHaveValue(
    'Testville'
  );
  await expect(page.locator('[data-next-checkout-field="postal"]')).toHaveValue(
    '10001'
  );

  // The fill event fired for the shipping address with the chosen components.
  await expect.poll(async () => await filled.count()).toBeGreaterThan(0);
  const payload = await filled.at(0);
  expect(payload.type).toBe('shipping');
  expect(payload.components?.label).toBe(SUGGESTION.label);
});
