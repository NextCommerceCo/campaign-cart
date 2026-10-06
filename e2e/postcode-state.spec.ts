import { test, expect, type Page, type Request } from '@playwright/test';
import { TEST_ORDER } from './fixtures/order';
import { blockLiveNetwork, bootSdk } from './fixtures/routes';
import {
  CARD_CHECKOUT,
  addOnePackage,
  stubCardCheckout,
  submitCard,
} from './fixtures/card-checkout';

/**
 * The checkout telling a shopper their postcode is not one their state uses.
 *
 * The address-rules service knows how each state's postcodes start, and answers
 * `not_in_state` from `POST /v1/validate` with the sentence to show. Proved here:
 *
 * - **the message reaches the field.** A New York address with `94103`, a San Francisco
 *   ZIP Code, shows the service's `Enter a valid ZIP Code for New York` under the postcode.
 * - **it goes when the postcode is right.** `10001` takes the message away.
 * - **it never blocks the order.** A postcode across a state line is sometimes real, so the
 *   order still goes out with what the shopper typed. A submit clears every message and
 *   checks the postcode by its pattern alone, so this holds however the message was put
 *   on the page; the spec guards that nothing on the submit path asks the service.
 * - **it asks in the page's language.** The request carries `?lang=`.
 *
 * Why not a unit test: `postcode-state-check.test.ts` proves the module with a fake form.
 * What it cannot prove is the wiring: the blur and the state select reaching it, the answer
 * landing under the real field after the blur's own display, and the submit not reading
 * it as a failure.
 *
 * The answers are the service's own, written out in `fixtures/routes.ts`.
 */

const POSTAL = '[data-next-checkout-field="postal"]';
const PROVINCE = '[data-next-checkout-field="province"]';
const COUNTRY = '[data-next-checkout-field="country"]';
const MESSAGE = 'Enter a valid ZIP Code for New York';

let escaped: string[] = [];
let errors: string[] = [];

test.beforeEach(async ({ page }) => {
  escaped = await blockLiveNetwork(page);
  errors = [];
  const collect = (text: string): void => {
    // The dev server's own hot-reload socket is not the SDK.
    if (/\[vite\]|WebSocket/i.test(text)) return;
    errors.push(text);
  };
  page.on('console', m => m.type() === 'error' && collect(m.text()));
  page.on('pageerror', e => collect(e.message));
});

test.afterEach(() => {
  expect(escaped, 'requests no stub answered').toEqual([]);
  expect(errors, 'console errors and page errors').toEqual([]);
});

/** Answers the orders endpoint and hands back every POST it saw. */
async function recordOrders(page: Page): Promise<Request[]> {
  const posts: Request[] = [];
  await page.route('**/api/v1/orders/**', route => {
    if (route.request().method() === 'POST') posts.push(route.request());
    return route.fulfill({ json: TEST_ORDER });
  });
  return posts;
}

/** Every `POST /v1/validate` that asked about a postcode. */
function recordPostcodeChecks(page: Page): Request[] {
  const checks: Request[] = [];
  page.on('request', request => {
    if (request.method() !== 'POST') return;
    if (new URL(request.url()).pathname !== '/v1/validate') return;
    const body = request.postDataJSON() as { fields?: Record<string, string> };
    if (body.fields && 'postcode' in body.fields) checks.push(request);
  });
  return checks;
}

/** A US address in New York, with `postcode` typed and left. */
async function newYorkAddress(page: Page, postcode: string): Promise<void> {
  await page.selectOption(COUNTRY, 'US');
  await page.selectOption(PROVINCE, 'NY');
  await page.fill(POSTAL, postcode);
  await page.locator(POSTAL).blur();
}

test('a postcode its state does not use shows the service’s message under it', async ({
  page,
}) => {
  await stubCardCheckout(page);
  const checks = recordPostcodeChecks(page);
  await bootSdk(page, CARD_CHECKOUT);

  await newYorkAddress(page, '94103');

  await expect(page.locator('.next-error-label')).toContainText(MESSAGE);
  await expect(page.locator(`${POSTAL}.next-error-field`)).toHaveCount(1);
  const asked = checks.at(-1);
  expect(new URL(asked?.url() ?? 'http://x').searchParams.get('lang')).toBe(
    'en'
  );
  expect(asked?.postDataJSON()).toEqual({
    country: 'US',
    fields: { postcode: '94103', state: 'NY' },
  });
});

test('a postcode its state uses shows no message, and takes an old one away', async ({
  page,
}) => {
  await stubCardCheckout(page);
  await bootSdk(page, CARD_CHECKOUT);

  await newYorkAddress(page, '94103');
  await expect(page.locator('.next-error-label')).toContainText(MESSAGE);

  await page.fill(POSTAL, '10001');
  await page.locator(POSTAL).blur();
  await expect(page.getByText(MESSAGE)).toHaveCount(0);
  await expect(page.locator(`${POSTAL}.next-error-field`)).toHaveCount(0);
});

test('the order still goes out with a postcode its state does not use', async ({
  page,
}) => {
  await stubCardCheckout(page);
  const posts = await recordOrders(page);
  await bootSdk(page, CARD_CHECKOUT);
  await addOnePackage(page);

  await newYorkAddress(page, '94103');
  await expect(page.locator('.next-error-label')).toContainText(MESSAGE);
  await submitCard(page, '4155552671', { postcode: '94103' });

  await page.waitForURL(url => url.searchParams.has('ref_id'));
  expect(posts).toHaveLength(1);
  const body = posts[0]?.postDataJSON() as {
    shipping_address: { postcode: string; state: string };
  };
  expect(body.shipping_address).toMatchObject({
    postcode: '94103',
    state: 'NY',
  });
});
