import { test, expect, type Page, type Request } from '@playwright/test';
import { TEST_ORDER } from './fixtures/order';
import { CHECKOUT_KEY } from './fixtures/storage-keys';
import {
  blockLiveNetwork,
  bootSdk,
  countryRules,
  routeAddressService,
  ruleField,
} from './fixtures/routes';
import {
  CARD_CHECKOUT,
  addOnePackage,
  stubCardCheckout,
} from './fixtures/card-checkout';

/**
 * A country that fixes part of every address in it: Vatican City has one city and one
 * postcode, and the address-rules service sends them as `address.fixed` instead of
 * asking. Proved here: the order carries them though the shopper typed neither, and
 * moving to a country that fixes nothing takes them back out, so they cannot ride along
 * into a US order.
 *
 * Why not only a unit test: `fixedValuesPatch` is pure and has one. What it cannot prove
 * is the wiring, the checkout form writing the values as the country select changes and
 * the order POST that leaves with them.
 */

let escaped: string[] = [];

const VA = countryRules(
  'VA',
  [['country'], ['line1'], ['line2']],
  {},
  {
    address: {
      layout: [['country'], ['line1'], ['line2']],
      fixed: { city: 'Vatican City', postcode: '00120' },
    },
  }
);
const US = countryRules(
  'US',
  [['country'], ['line1'], ['city', 'state', 'postcode']],
  {
    state: ruleField('State', 'address-level1', {
      type: 'select',
      options: 'states',
    }),
    postcode: ruleField('ZIP Code', 'postal-code'),
  }
);

test.beforeEach(async ({ page }) => {
  escaped = await blockLiveNetwork(page);
  await stubCardCheckout(page);
  await routeAddressService(page, {
    countries: [
      { code: 'US', name: 'United States' },
      { code: 'VA', name: 'Vatican City' },
    ],
    rules: code =>
      code === 'VA'
        ? VA
        : { ...US, states: [{ code: 'NY', name: 'New York' }] },
  });
});

test.afterEach(() => {
  expect(escaped, 'requests no stub answered').toEqual([]);
});

/** The shipping city the checkout store holds, read from its persisted copy. */
function storedCity(page: Page): Promise<string | undefined> {
  return page.evaluate(key => {
    const raw = sessionStorage.getItem(key);
    const persisted = raw
      ? (JSON.parse(raw) as { state?: { formData?: { city?: string } } })
      : undefined;
    return persisted?.state?.formData?.city;
  }, CHECKOUT_KEY);
}

async function recordOrders(page: Page): Promise<Request[]> {
  const posts: Request[] = [];
  await page.route('**/api/v1/orders/**', route => {
    if (route.request().method() === 'POST') posts.push(route.request());
    return route.fulfill({ json: TEST_ORDER });
  });
  return posts;
}

/** Everything but the city, postcode and state, which a Vatican address never asks for. */
async function fillContactAndStreet(page: Page): Promise<void> {
  await page.fill('[data-next-checkout-field="email"]', 'ada@example.test');
  await page.fill('[data-next-checkout-field="fname"]', 'Ada');
  await page.fill('[data-next-checkout-field="lname"]', 'Lovelace');
  await page.fill(
    '[data-next-checkout-field="address1"]',
    'Via del Pellegrino 1'
  );
  await page.selectOption('[data-next-checkout-field="cc-month"]', '12');
  await page.selectOption('[data-next-checkout-field="cc-year"]', '2030');
}

test('a Vatican order carries the city and postcode the shopper was never asked for', async ({
  page,
}) => {
  const posts = await recordOrders(page);
  await bootSdk(page, CARD_CHECKOUT);
  await addOnePackage(page);

  await page.selectOption('[data-next-checkout-field="country"]', 'VA');
  await fillContactAndStreet(page);
  await page.click('[data-next-checkout-submit]');

  await page.waitForURL(url => url.searchParams.has('ref_id'));
  expect(posts).toHaveLength(1);
  const body = posts[0]?.postDataJSON() as {
    shipping_address: { line4: string; postcode: string; country: string };
  };
  expect(body.shipping_address).toMatchObject({
    country: 'VA',
    line4: 'Vatican City',
    postcode: '00120',
  });
});

/** The negative control: the values do not follow the shopper to another country. */
test('leaving Vatican City takes its city back out, so a US order asks for one', async ({
  page,
}) => {
  const posts = await recordOrders(page);
  await bootSdk(page, CARD_CHECKOUT);
  await addOnePackage(page);

  await page.selectOption('[data-next-checkout-field="country"]', 'VA');
  await expect.poll(() => storedCity(page)).toBe('Vatican City');

  await page.selectOption('[data-next-checkout-field="country"]', 'US');
  await fillContactAndStreet(page);
  await page.click('[data-next-checkout-submit]');

  await expect(
    page.locator('[data-next-checkout-field="city"].next-error-field')
  ).toHaveCount(1);
  expect(posts).toHaveLength(0);
});
