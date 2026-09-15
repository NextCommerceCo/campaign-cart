import { test, expect, type Page } from '@playwright/test';
import { MINIMAL_CAMPAIGN } from './fixtures/campaign';
import {
  stubCampaign,
  stubCart,
  stubAddressAutocomplete,
  bootSdk,
} from './fixtures/routes';
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
  layout: [['country'], ['first_name', 'last_name'], ['line1'], ['city', 'state', 'postcode']],
  fields: {
    country: { name: 'country', label: 'Country', required: true, autocomplete: 'country', control: 'select' },
    first_name: { name: 'first_name', label: 'First name', required: true, autocomplete: 'given-name', control: 'text' },
    last_name: { name: 'last_name', label: 'Last name', required: true, autocomplete: 'family-name', control: 'text' },
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

/**
 * One stub for both callers: the checkout form's `CountryService` and this feature read
 * the same service, `/v1/bootstrap` for the country list and `/v1/layout/:country` for
 * one country's rules.
 */
async function stubAddressService(page: Page): Promise<void> {
  await page.route('**/next-address*/**', route => {
    const url = route.request().url();
    const country = url.match(/\/v1\/layout\/([A-Z]{2})/)?.[1];
    const spec = country === 'JP' ? JP_SPEC : US_SPEC;

    if (country) {
      return route.fulfill({
        json: { spec, states: [{ code: 'NY', name: 'New York' }] },
      });
    }
    return route.fulfill({
      json: {
        geo: { country: 'US', currency: 'USD', ip: '203.0.113.7' },
        spec: US_SPEC,
        countries: [
          { code: 'US', name: 'United States' },
          { code: 'JP', name: 'Japan' },
        ],
        states: [{ code: 'NY', name: 'New York' }],
      },
    });
  });
}

test.beforeEach(async ({ page }) => {
  await stubCampaign(page, MINIMAL_CAMPAIGN);
  await stubCart(page);
  await stubAddressService(page);
});

const FIELD = (name: string) => `[data-next-checkout-field="${name}"]`;

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

/**
 * Address suggestions attach to the address input. The provider loads on the first focus
 * of it, and that input is built by this feature — it does not exist when the provider is
 * wired, and it is replaced by a different element every time the country changes.
 */
async function withAutocomplete(page: Page): Promise<void> {
  await stubAddressAutocomplete(page, [SUGGESTION]);
  await page.addInitScript(() => {
    (window as any).nextConfig = {
      addressConfig: { enableAutocomplete: true },
    };
  });
}

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

test('a field the country requires shows its error on submit', async ({ page }) => {
  await bootSdk(page, FIXTURE);
  await expect(page.locator(FIELD('address1'))).toBeVisible();

  await page.click('button[type="submit"]');

  await expect(page.locator(FIELD('address1'))).toHaveClass(/next-error-field/);
  await expect(
    page.locator('[data-next-address-field="address1"] .next-error-label')
  ).toBeVisible();
});

/**
 * The real ordering, which an instant stub hides.
 *
 * The checkout form fills the country and province dropdowns during its own boot. When
 * the layout arrives after that — which is the ordinary case on a real connection — those
 * two elements did not exist yet, so nothing had been filled and nothing would refill
 * them: an empty country select and a province stuck on "Select Country First".
 */
test('the dropdowns are filled even when the layout arrives after boot', async ({
  page,
}) => {
  await page.route('**/next-address*/v1/layout/**', async route => {
    await new Promise(resolve => setTimeout(resolve, 600));
    const country = route.request().url().match(/\/v1\/layout\/([A-Z]{2})/)?.[1];
    return route.fulfill({
      json: {
        spec: country === 'JP' ? JP_SPEC : US_SPEC,
        states: [{ code: 'NY', name: 'New York' }],
      },
    });
  });

  await bootSdk(page, FIXTURE);
  await expect(page.locator(FIELD('country'))).toBeVisible();

  await expect(page.locator(`${FIELD('country')} option`)).not.toHaveCount(0);
  await expect(
    page.locator(`${FIELD('country')} option[value="US"]`)
  ).toHaveCount(1);
  await expect(page.locator(FIELD('province'))).not.toHaveValue(
    /Select Country First/
  );
  await expect(
    page.locator(`${FIELD('province')} option[value="NY"]`)
  ).toHaveCount(1);
});

/**
 * A country's layout describes a whole address form, name included, but this page
 * collects the name in a step of its own. Building it again would put two elements under
 * `fname` on the page, and the order is assembled from whichever the form scanned last —
 * so what the shopper typed in the first step is dropped.
 */
test('a field the page already collects is not built a second time', async ({ page }) => {
  await bootSdk(page, FIXTURE);
  await expect(page.locator(FIELD('address1'))).toBeVisible();

  await expect(page.locator(FIELD('fname'))).toHaveCount(1);
  await expect(
    page.locator(`[data-next-address] ${FIELD('fname')}`)
  ).toHaveCount(0);

  await page.fill(FIELD('fname'), 'Gwen');
  await page.locator(FIELD('fname')).blur();

  await expect
    .poll(() =>
      page.evaluate(key => {
        const raw = sessionStorage.getItem(key);
        return raw ? JSON.parse(raw)?.state?.formData?.fname : undefined;
      }, CHECKOUT_KEY)
    )
    .toBe('Gwen');
});

test('suggestions load on an address field this feature built', async ({ page }) => {
  await withAutocomplete(page);
  await bootSdk(page, FIXTURE);

  await page.locator(FIELD('address1')).click();
  await page.fill(FIELD('address1'), '123 Main');

  const suggestion = page.locator('.pac-item-nextcommerce').first();
  await expect(suggestion).toBeVisible();
  await suggestion.click();

  await expect(page.locator(FIELD('city'))).toHaveValue('Testville');
});

test('suggestions still load after a country change replaces the field', async ({
  page,
}) => {
  await withAutocomplete(page);
  await bootSdk(page, FIXTURE);

  // Load the provider against the first country's field.
  await page.locator(FIELD('address1')).click();
  await page.fill(FIELD('address1'), '123 Main');
  await expect(page.locator('.pac-item-nextcommerce').first()).toBeVisible();

  // The field it attached to is replaced by a different element.
  const queried: string[] = [];
  page.on('request', r => {
    if (r.url().includes('/addresses/autocomplete/')) queried.push(r.url());
  });
  await page.selectOption(FIELD('country'), 'JP');
  await expect(page.locator(FIELD('postal'))).toBeVisible();

  await page.locator(FIELD('address1')).click();
  await page.fill(FIELD('address1'), '456 Second');

  await expect.poll(() => queried.length).toBeGreaterThan(0);
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
