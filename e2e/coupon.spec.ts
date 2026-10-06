import { test, expect, type Page } from '@playwright/test';
import { MINIMAL_CAMPAIGN } from './fixtures/campaign';
import {
  stubCampaign,
  stubI18nRules,
  bootSdk,
  captureEvents,
  EMPTY_CART_SUMMARY,
} from './fixtures/routes';

/**
 * CouponEnhancer — applies a voucher code to the checkout store.
 *
 * `applyCoupon` (src/state/cart/operations/apply-coupon.ts) accepts a code only
 * when the calculate response with it carries a discount the response without
 * it lacks. The live calculate API ignores an unknown voucher without an error
 * (issue #80), and the stub below behaves the same: only SAVE10 earns a
 * discount, every other code comes back with `voucher_discounts: []`.
 */

const FIXTURE = '/e2e/fixtures/coupon.html';

test.beforeEach(async ({ page }) => {
  await stubCampaign(page, MINIMAL_CAMPAIGN);
  await page.route('**/api/v1/carts/calculate/**', route => {
    const vouchers: string[] = route.request().postDataJSON()?.vouchers ?? [];
    route.fulfill({
      json: {
        ...EMPTY_CART_SUMMARY,
        voucher_discounts: vouchers.includes('SAVE10')
          ? [{ offer_id: 7, amount: '1.00', name: 'Save 10%' }]
          : [],
      },
    });
  });
});

async function addToCart(page: Page): Promise<void> {
  await page.click('[data-next-action="add-to-cart"]');
  // An empty cart stores any code unchecked, so wait for the line to land.
  await expect
    .poll(() => page.evaluate(() => (window as any).next.getCartCount()))
    .toBeGreaterThan(0);
}

test('applying a code emits coupon:applied with the code', async ({ page }) => {
  await bootSdk(page, FIXTURE);
  await addToCart(page);

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
  await addToCart(page);

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

test('a code the server gives no discount for emits coupon:validation-failed', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);
  await addToCart(page);

  const applied = await captureEvents(page, 'coupon:applied');
  const failed = await captureEvents(page, 'coupon:validation-failed');

  await page.fill('input[data-next-coupon="input"]', 'primal_5');
  await page.click('[data-next-coupon="apply"]');

  await expect(page.locator('[data-next-coupon="messages"]')).toHaveText(
    "Coupon PRIMAL_5 isn't valid for this order."
  );
  expect(await failed.count()).toBe(1);
  expect(await applied.count()).toBe(0);
  expect(await page.evaluate(() => (window as any).next.getCoupons())).toEqual(
    []
  );
});

test("shows the address service's coupon text in the page's language", async ({
  page,
}) => {
  await stubI18nRules(page, {
    texts: {
      'coupon.errors.invalid': 'คูปอง {{code}} ใช้กับคำสั่งซื้อนี้ไม่ได้',
    },
  });
  await page.addInitScript(() => {
    (window as any).nextConfig = { locale: 'th-TH' };
  });
  await bootSdk(page, FIXTURE);
  await addToCart(page);

  await page.fill('input[data-next-coupon="input"]', 'primal_5');
  await page.click('[data-next-coupon="apply"]');

  await expect(page.locator('[data-next-coupon="messages"]')).toHaveText(
    'คูปอง PRIMAL_5 ใช้กับคำสั่งซื้อนี้ไม่ได้'
  );
});
