import { test, expect, type Page } from '@playwright/test';
import { MINIMAL_CAMPAIGN } from './fixtures/campaign';
import { stubCampaign, stubCart, bootSdk } from './fixtures/routes';
import { CHECKOUT_KEY } from './fixtures/storage-keys';

/**
 * E2E for `[data-next-address]`.
 *
 * The half only a browser proves: the fields are built after the checkout form has
 * scanned for them and bound its per-field listeners, so without the re-scan a shopper
 * fills a form that reaches nothing.
 */

const FIXTURE = '/e2e/fixtures/address-form.html';

const US_SPEC = {
  country: 'US',
  layout: [['country'], ['line1'], ['city', 'state', 'postcode']],
  fields: {
    country: { name: 'country', label: 'Country', required: true, autocomplete: 'country', control: 'select' },
    line1: { name: 'line1', label: 'Address', required: true, autocomplete: 'address-line1', control: 'text' },
    city: { name: 'city', label: 'City', required: true, autocomplete: 'address-level2', control: 'text' },
    state: { name: 'state', label: 'State', required: true, autocomplete: 'address-level1', control: 'select', optionsSource: 'states' },
    postcode: { name: 'postcode', label: 'ZIP Code', required: true, autocomplete: 'postal-code', control: 'text' },
  },
};

const JP_SPEC = {
  country: 'JP',
  layout: [['country'], ['postcode', 'state'], ['city'], ['line1']],
  fields: {
    country: { name: 'country', label: 'Country', required: true, autocomplete: 'country', control: 'select' },
    postcode: { name: 'postcode', label: 'Postal code', required: true, autocomplete: 'postal-code', control: 'text' },
    state: { name: 'state', label: 'Prefecture', required: true, autocomplete: 'address-level1', control: 'select' },
    city: { name: 'city', label: 'City', required: true, autocomplete: 'address-level2', control: 'text' },
    line1: { name: 'line1', label: 'Street', required: true, autocomplete: 'address-line1', control: 'text' },
  },
};

async function stubAddressLayouts(page: Page): Promise<void> {
  await page.route('**/next-address*/**', route => {
    const country = route.request().url().match(/\/v1\/layout\/([A-Z]{2})/)?.[1];
    return route.fulfill({ json: { spec: country === 'JP' ? JP_SPEC : US_SPEC } });
  });
}

async function stubCountryService(page: Page): Promise<void> {
  await page.route('**/cdn-countries.muddy-wind-c7ca.workers.dev/**', route => {
    const url = route.request().url();
    if (url.includes('/location')) {
      return route.fulfill({
        json: {
          detectedCountryCode: 'US',
          countries: [
            { code: 'US', name: 'United States' },
            { code: 'JP', name: 'Japan' },
          ],
        },
      });
    }
    return route.fulfill({
      json: {
        countryConfig: {
          stateLabel: 'State',
          stateRequired: true,
          postcodeLabel: 'ZIP Code',
          postcodeRegex: '',
          postcodeExample: '10001',
        },
        states: [{ code: 'NY', name: 'New York' }],
      },
    });
  });
}

test.beforeEach(async ({ page }) => {
  await stubCampaign(page, MINIMAL_CAMPAIGN);
  await stubCart(page);
  await stubCountryService(page);
  await stubAddressLayouts(page);
});

const FIELD = (name: string) => `[data-next-checkout-field="${name}"]`;

test('builds the fields the country collects, in the order it writes them', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  const block = page.locator('[data-next-address]');
  await expect(block.locator('[data-next-checkout-field]')).toHaveCount(5);

  const order = await block
    .locator('[data-next-checkout-field]')
    .evaluateAll(els => els.map(el => el.getAttribute('data-next-checkout-field')));
  expect(order).toEqual(['country', 'address1', 'city', 'province', 'postal']);
});

test('the checkout form adopts the built fields and reads them into the store', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  await page.fill(FIELD('address1'), '1 Test Street');
  await page.fill(FIELD('city'), 'Testville');
  await page.locator(FIELD('city')).blur();

  await expect
    .poll(() =>
      page.evaluate(key => {
        const raw = sessionStorage.getItem(key);
        return raw ? JSON.parse(raw)?.state?.formData?.address1 : undefined;
      }, CHECKOUT_KEY)
    )
    .toBe('1 Test Street');
});

test('the province dropdown is filled by the checkout form', async ({ page }) => {
  await bootSdk(page, FIXTURE);

  await expect(page.locator(`${FIELD('province')} option`)).not.toHaveCount(0);
  await expect(page.locator(`${FIELD('province')} option[value="NY"]`)).toHaveCount(1);
});

test('every built input names the form it belongs to for autofill', async ({ page }) => {
  await bootSdk(page, FIXTURE);

  await expect(page.locator(FIELD('address1'))).toHaveAttribute(
    'autocomplete',
    'shipping address-line1'
  );
});

test('choosing another country rebuilds the form in that country’s shape', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);
  await expect(page.locator('[data-next-address] [data-next-checkout-field]')).toHaveCount(5);

  await page.selectOption(FIELD('country'), 'JP');

  await expect
    .poll(async () =>
      page
        .locator('[data-next-address] [data-next-checkout-field]')
        .evaluateAll(els => els.map(el => el.getAttribute('data-next-checkout-field')))
    )
    .toEqual(['country', 'postal', 'province', 'city', 'address1']);
});

test('an address typed after a country change still reaches the store', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);
  await page.selectOption(FIELD('country'), 'JP');
  await expect(page.locator(FIELD('postal'))).toBeVisible();

  await page.fill(FIELD('address1'), '2 Rebuilt Road');
  await page.locator(FIELD('address1')).blur();

  await expect
    .poll(() =>
      page.evaluate(key => {
        const raw = sessionStorage.getItem(key);
        return raw ? JSON.parse(raw)?.state?.formData?.address1 : undefined;
      }, CHECKOUT_KEY)
    )
    .toBe('2 Rebuilt Road');
});

test('a typed address survives the rebuild', async ({ page }) => {
  await bootSdk(page, FIXTURE);

  await page.fill(FIELD('address1'), '1 Test Street');
  await page.selectOption(FIELD('country'), 'JP');

  await expect(page.locator(FIELD('address1'))).toHaveValue('1 Test Street');
});

test('a failed layout lookup leaves the page usable', async ({ page }) => {
  await page.route('**/next-address*/**', route =>
    route.fulfill({ status: 503, json: { error: 'unavailable' } })
  );

  const errors: string[] = [];
  page.on('pageerror', error => errors.push(String(error)));

  await bootSdk(page, FIXTURE);

  await expect(page.locator(FIELD('email'))).toBeVisible();
  expect(errors).toEqual([]);
});
