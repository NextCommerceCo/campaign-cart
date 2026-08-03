import { test, expect } from '@playwright/test';
import { MINIMAL_CAMPAIGN } from './fixtures/campaign';
import { stubCampaign, stubCart, bootSdk, captureEvents } from './fixtures/routes';

/**
 * QuantityControlEnhancer — increase/decrease buttons that adjust the cart
 * quantity of a fixed package. Requires the item to already be in the cart.
 */

const FIXTURE = '/e2e/fixtures/quantity-control.html';

test.beforeEach(async ({ page }) => {
  await stubCampaign(page, MINIMAL_CAMPAIGN);
  await stubCart(page);
});

test('increase raises the cart quantity and emits cart:quantity-changed', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  // Seed the cart with one unit.
  await page.click('[data-next-action="add-to-cart"]');
  await expect(
    page.locator('[data-next-display="cart.totalQuantity"]')
  ).toHaveText('1');

  const qtyChanged = await captureEvents(page, 'cart:quantity-changed');

  await page.click('[data-next-quantity="increase"]');

  await expect(
    page.locator('[data-next-display="cart.totalQuantity"]')
  ).toHaveText('2');

  await expect.poll(() => qtyChanged.count()).toBeGreaterThan(0);
  const evt = (await qtyChanged.all()).at(-1);
  expect(evt.packageId).toBe(1);
  expect(evt.quantity).toBe(2);
  expect(evt.oldQuantity).toBe(1);
});

test('decrease lowers the cart quantity', async ({ page }) => {
  await bootSdk(page, FIXTURE);

  await page.click('[data-next-action="add-to-cart"]');
  await page.click('[data-next-quantity="increase"]');
  await expect(
    page.locator('[data-next-display="cart.totalQuantity"]')
  ).toHaveText('2');

  const qtyChanged = await captureEvents(page, 'cart:quantity-changed');
  await page.click('[data-next-quantity="decrease"]');

  await expect(
    page.locator('[data-next-display="cart.totalQuantity"]')
  ).toHaveText('1');

  const evt = (await qtyChanged.all()).at(-1);
  expect(evt.packageId).toBe(1);
  expect(evt.quantity).toBe(1);
  expect(evt.oldQuantity).toBe(2);
});
