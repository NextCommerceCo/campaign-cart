import { test, expect, type Page } from '@playwright/test';
import { MINIMAL_CAMPAIGN } from './fixtures/campaign';
import { stubCampaign, stubCart, bootSdk } from './fixtures/routes';
import { CHECKOUT_KEY } from './fixtures/storage-keys';

/**
 * E2E for the address-form enhancer (`[data-next-address]`).
 *
 * The behaviour worth a browser is the handover: this feature builds inputs *after* the
 * checkout form has already scanned the page for its fields, and they only reach an order
 * because the form is told to scan again. A unit test can prove the right elements are
 * built; only a real boot proves the form then picks them up — which is the half that
 * would silently collect nothing.
 *
 * Both backends are stubbed: the layout service this feature calls, and the country CDN
 * the checkout form calls. A spec that reaches either is non-deterministic.
 */

const FIXTURE = '/e2e/fixtures/address-form.html';

/** The US: city, state and ZIP share a row, and the postcode comes last. */
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

/** Japan leads with the postcode and collects no second address line. */
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

/** Stub the layout service, and count the requests so a re-render is observable. */
async function stubAddressLayouts(page: Page): Promise<void> {
  await page.route('**/next-address*/**', route => {
    const country = route.request().url().match(/\/v1\/layout\/([A-Z]{2})/)?.[1];
    return route.fulfill({ json: { spec: country === 'JP' ? JP_SPEC : US_SPEC } });
  });
}

/** Stub the country/states CDN the checkout form's CountryService calls. */
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

/**
 * The handover this spec exists for. The form scanned the page before these inputs
 * existed; typing into one has to reach the checkout store anyway.
 */
test('the checkout form adopts the built fields and reads them into the store', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  await page.fill(FIELD('address1'), '1 Test Street');
  await page.fill(FIELD('city'), 'Testville');
  await page.locator(FIELD('city')).blur();

  // The checkout store persists what it holds, so what reached it is observable.
  await expect
    .poll(() =>
      page.evaluate(key => {
        const raw = sessionStorage.getItem(key);
        return raw ? JSON.parse(raw)?.state?.formData?.address1 : undefined;
      }, CHECKOUT_KEY)
    )
    .toBe('1 Test Street');
});

/** The checkout form fills the province dropdown it did not build, as it does any other. */
test('the province dropdown is filled by the checkout form', async ({ page }) => {
  await bootSdk(page, FIXTURE);

  await expect(page.locator(`${FIELD('province')} option`)).not.toHaveCount(0);
  await expect(page.locator(`${FIELD('province')} option[value="NY"]`)).toHaveCount(1);
});

/** Browsers autofill one address form from the other's data without this prefix. */
test('every built input names the form it belongs to for autofill', async ({ page }) => {
  await bootSdk(page, FIXTURE);

  await expect(page.locator(FIELD('address1'))).toHaveAttribute(
    'autocomplete',
    'shipping address-line1'
  );
});

/**
 * The negative control: changing the country must actually change the form, not merely
 * re-render the same fields. Japan's postcode leads and its second address line is gone.
 */
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

/**
 * The handover, after the fields have been replaced.
 *
 * A country change builds a whole new set of inputs; the ones the checkout form scanned
 * and bound its listeners to are detached by then. If it is not told to look again, a
 * shopper fills in a form that reaches nothing and the order goes out with no address.
 */
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

/** What the shopper already typed survives a country change. */
test('a typed address survives the rebuild', async ({ page }) => {
  await bootSdk(page, FIXTURE);

  await page.fill(FIELD('address1'), '1 Test Street');
  await page.selectOption(FIELD('country'), 'JP');

  await expect(page.locator(FIELD('address1'))).toHaveValue('1 Test Street');
});

/**
 * A layout that never arrives must not empty the page. Without this the container is
 * cleared and the shopper has no address form at all.
 */
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
