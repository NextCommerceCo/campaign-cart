import { test, expect } from '@playwright/test';
import { MINIMAL_CAMPAIGN } from './fixtures/campaign';
import { stubCampaign, stubCart, bootSdk, captureEvents } from './fixtures/routes';

/**
 * CouponEnhancer — applies a voucher code to the checkout store.
 *
 * NOTE on validation: cartOperations.applyCoupon (src/state/cart/operations/
 * apply-coupon.ts) does NOT validate the code against campaign offers/vouchers.
 * It normalizes the code to upper-case and succeeds for any code that is not
 * already applied; re-applying an already-applied code is the only path that
 * returns { success: false }, which the enhancer surfaces as
 * coupon:validation-failed. The tests below assert that actual behavior.
 */

const FIXTURE = '/e2e/fixtures/coupon.html';

test.beforeEach(async ({ page }) => {
  await stubCampaign(page, MINIMAL_CAMPAIGN);
  await stubCart(page);
});

test('applying a code emits coupon:applied with the code', async ({ page }) => {
  await bootSdk(page, FIXTURE);

  await page.click('[data-next-action="add-to-cart"]');

  const applied = await captureEvents(page, 'coupon:applied');

  await page.fill('input[data-next-coupon="input"]', 'SAVE10');
  await page.click('[data-next-coupon="apply"]');

  await expect.poll(() => applied.count()).toBeGreaterThan(0);
  expect((await applied.all()).at(-1).code).toBe('SAVE10');
});

test('re-applying the same code emits coupon:validation-failed', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  await page.click('[data-next-action="add-to-cart"]');

  const applied = await captureEvents(page, 'coupon:applied');
  const failed = await captureEvents(page, 'coupon:validation-failed');

  // First apply succeeds; the enhancer clears the input on success.
  await page.fill('input[data-next-coupon="input"]', 'SAVE10');
  await page.click('[data-next-coupon="apply"]');
  await expect.poll(() => applied.count()).toBeGreaterThan(0);

  // Second apply of the same (normalized) code is rejected as already applied.
  await page.fill('input[data-next-coupon="input"]', 'save10');
  await page.click('[data-next-coupon="apply"]');

  await expect.poll(() => failed.count()).toBeGreaterThan(0);
  const evt = (await failed.all()).at(-1);
  expect(evt.code).toBe('save10');
  expect(evt.message).toMatch(/already applied/i);
});
