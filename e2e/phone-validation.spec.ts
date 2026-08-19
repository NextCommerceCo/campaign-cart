import { test, expect, type Page, type Request } from '@playwright/test';
import { TEST_ORDER } from './fixtures/order';
import { bootSdk } from './fixtures/routes';
import {
  CARD_CHECKOUT,
  addOnePackage,
  stubCardCheckout,
  submitCard,
} from './fixtures/card-checkout';

/**
 * What the checkout does with a phone number —
 * [issue #58](https://github.com/NextCommerceCo/campaign-cart/issues/58).
 *
 * Two things are proved here, and neither can be proved anywhere else:
 *
 * - **a number nobody holds does not reach the orders API.** `0000000000` is ten
 *   digits, which is the right length for a US number, so every length-based
 *   check accepts it — including `intl-tel-input`'s own `isValidNumber()`, whose
 *   name says validity and whose implementation says length. It reached the API
 *   with a 201 for months.
 * - **what is sent is E.164.** The API converts a national number, but a
 *   conversion the SDK did not make is one nobody here can see, so the SDK is
 *   expected to send `+14155552671` rather than `4155552671`.
 *
 * Why this cannot be a unit test: the number is assembled by `intl-tel-input`
 * from a utils script it fetches at runtime, and the verdict comes from
 * libphonenumber inside that script. happy-dom neither loads it nor runs it, so
 * a unit test can only ever check the code around a stub of the thing being
 * tested. The whole class of bug lives in the stub's blind spot.
 *
 * The Spreedly tokenizer is stubbed by the shared card harness, which is why the
 * form can be submitted at all. Everything about the phone — the widget, its
 * utils script, the validation, the E.164 assembly — is the real thing.
 */

const CHECKOUT = CARD_CHECKOUT;
const PHONE = '[data-next-checkout-field="phone"]';

/** Answers the orders endpoint and hands back every POST it saw. */
async function recordOrders(page: Page): Promise<Request[]> {
  const posts: Request[] = [];
  await page.route('**/api/v1/orders/**', route => {
    if (route.request().method() === 'POST') posts.push(route.request());
    return route.fulfill({ json: TEST_ORDER });
  });
  return posts;
}

test.beforeEach(async ({ page }) => {
  await stubCardCheckout(page);
});

test('a junk phone is refused, shown, and never sent', async ({ page }) => {
  const posts = await recordOrders(page);

  await bootSdk(page, CHECKOUT);
  await addOnePackage(page);
  await submitCard(page, '0000000000');

  // Shown: the shopper is told which field is wrong.
  await expect(page.locator(`${PHONE}.next-error-field`)).toHaveCount(1);
  await expect(page.locator('.next-error-label')).toContainText(
    'valid phone number'
  );

  // Never sent: no order, and the page has not moved on.
  await expect(page).toHaveURL(new RegExp('card-purchase'));
  expect(posts).toHaveLength(0);
});

test('a sequential phone is refused too', async ({ page }) => {
  const posts = await recordOrders(page);

  await bootSdk(page, CHECKOUT);
  await addOnePackage(page);
  await submitCard(page, '1234567890');

  await expect(page.locator(`${PHONE}.next-error-field`)).toHaveCount(1);
  expect(posts).toHaveLength(0);
});

/**
 * The negative control, and the reason the two tests above mean anything: a
 * checkout that refuses every phone would pass them both.
 */
test('a real phone is accepted and sent in E.164', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', e => errors.push(e.message));

  const posts = await recordOrders(page);

  await bootSdk(page, CHECKOUT);
  await addOnePackage(page);
  await submitCard(page, '4155552671');

  await page.waitForURL(url => url.searchParams.has('ref_id'));

  expect(posts).toHaveLength(1);
  const body = posts[0]?.postDataJSON() as {
    shipping_address: { phone_number: string };
    user: { phone_number: string };
  };

  // Typed nationally, sent internationally. Both places the order carries it.
  expect(body.shipping_address.phone_number).toBe('+14155552671');
  expect(body.user.phone_number).toBe('+14155552671');

  // A caught error is invisible to every assertion above — the cart and order
  // paths both swallow their own failures.
  expect(errors).toEqual([]);
});
