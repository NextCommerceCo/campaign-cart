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
 * - **the phone library's verdict reaches the shopper.** A number it refuses is
 *   shown as an error on the field and blocks the submit, wherever the check
 *   runs. That is the half of #58 the SDK owns.
 * - **what is sent is E.164.** The API converts a national number, but a
 *   conversion the SDK did not make is one nobody here can see, so the SDK is
 *   expected to send `+14155552671` rather than `4155552671`.
 *
 * What the SDK asks is the phone library's `isValidNumber()` — whether a number
 * is well formed for its country, not whether it is in service. `0000000000` and
 * `1234567890` pass that and go through. The stricter `isValidNumberPrecise()`
 * would refuse both and is deliberately not used: refusing a real number loses a
 * sale for good, while accepting an unreachable one costs a server-side rejection
 * we can see. This test pins that, so re-adding a stricter client-side rule turns
 * red rather than passing quietly.
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

test('a number the library refuses is shown and never sent', async ({
  page,
}) => {
  const posts = await recordOrders(page);

  await bootSdk(page, CHECKOUT);
  await addOnePackage(page);
  // Nine digits where the US wants ten. This is what the library refuses, and
  // before the fix its refusal was set on the store and never rendered.
  await submitCard(page, '415555267');

  // Shown: the shopper is told which field is wrong.
  await expect(page.locator(`${PHONE}.next-error-field`)).toHaveCount(1);
  await expect(page.locator('.next-error-label')).toContainText(
    'valid phone number'
  );

  // Never sent: no order, and the page has not moved on.
  await expect(page).toHaveURL(new RegExp('card-purchase'));
  expect(posts).toHaveLength(0);
});

/**
 * The case the old digit-count rule let through.
 *
 * `isValidPhone` accepted any ten-or-more-digit string, so a number that is *too
 * long* for its country passed it, the widget's `false` was stored and never
 * rendered, and the order went out. Eleven digits is the smallest number that
 * shows it: nine would have been caught by the count alone, which is why a
 * nine-digit test proves nothing about this.
 */
test('a number too long for its country is refused, not just a short one', async ({
  page,
}) => {
  const posts = await recordOrders(page);

  await bootSdk(page, CHECKOUT);
  await addOnePackage(page);
  await submitCard(page, '41555526712');

  await expect(page.locator(`${PHONE}.next-error-field`)).toHaveCount(1);
  await expect(page.locator('.next-error-label')).toContainText(
    'valid phone number'
  );

  await expect(page).toHaveURL(new RegExp('card-purchase'));
  expect(posts).toHaveLength(0);
});

/**
 * The handoff, stated as a test so that re-adding a client-side shape rule turns
 * it red rather than passing quietly.
 */
test('a placeholder of the right length is left to the server', async ({
  page,
}) => {
  const posts = await recordOrders(page);

  await bootSdk(page, CHECKOUT);
  await addOnePackage(page);
  await submitCard(page, '0000000000');

  await page.waitForURL(url => url.searchParams.has('ref_id'));

  await expect(page.locator(`${PHONE}.next-error-field`)).toHaveCount(0);
  expect(posts).toHaveLength(1);
  const body = posts[0]?.postDataJSON() as {
    shipping_address: { phone_number: string };
  };
  // As typed: libphonenumber will not render this one internationally, so there
  // is no E.164 to send and the SDK logs that it could not make one.
  expect(body.shipping_address.phone_number).toBe('0000000000');
});

/**
 * A shopper reachable in one country and shipping to another.
 *
 * `intl-tel-input` re-bases the field on the address country when that `<select>`
 * changes, keeping the national digits and swapping the dial code in front of
 * them. On a number the shopper wrote internationally that produces one that is
 * not theirs: `+66 81 234 5678` became `+1 81 234 5678`, which is what the field
 * then showed them, with no message to explain it.
 */
test('a number written internationally survives choosing another country', async ({
  page,
}) => {
  await bootSdk(page, CHECKOUT);
  await addOnePackage(page);

  await page.fill(PHONE, '+66812345678');
  await page.selectOption('[data-next-checkout-field="country"]', 'US');

  await expect(page.locator(PHONE)).toHaveValue(/^\+66/);
});

/**
 * A shopper who gave a landline.
 *
 * `intl-tel-input` defaults `validationNumberTypes` to `["MOBILE"]`, which makes
 * `isValidNumber()` answer "is this a valid *mobile* number". In a country where
 * a landline is not the length of a mobile, that refuses a real number with
 * nothing the shopper can do about it. Berlin `030 1234567` is nine national
 * digits; a German mobile is ten or eleven.
 *
 * Verified against the live widget: with the default the library answers
 * `false` for this number and `true` with the filter off.
 */
test('a landline is accepted where a mobile would be a different length', async ({
  page,
}) => {
  const posts = await recordOrders(page);

  await bootSdk(page, CHECKOUT);
  await addOnePackage(page);
  await submitCard(page, '+49301234567');

  await page.waitForURL(url => url.searchParams.has('ref_id'));

  await expect(page.locator(`${PHONE}.next-error-field`)).toHaveCount(0);
  expect(posts).toHaveLength(1);
  const body = posts[0]?.postDataJSON() as {
    shipping_address: { phone_number: string };
  };
  expect(body.shipping_address.phone_number).toBe('+49301234567');
});

/**
 * The negative control, and the reason the two tests above mean anything: a
 * checkout that refuses every phone would pass them both.
 */
test('a real phone is accepted and sent in E.164', async ({ page }) => {
  const errors: string[] = [];
  const collect = (text: string): void => {
    // The dev server's own hot-reload socket is not the SDK. It fails loudly whenever
    // Vite is served on a port other than the one `vite.config.ts` names for the HMR
    // client, which is nothing to do with what this spec is watching for.
    if (/\[vite\]|WebSocket/i.test(text)) return;
    errors.push(text);
  };
  page.on('console', m => m.type() === 'error' && collect(m.text()));
  page.on('pageerror', e => collect(e.message));

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
