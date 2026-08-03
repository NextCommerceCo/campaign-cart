import { test, expect } from '@playwright/test';
import { MINIMAL_CAMPAIGN } from './fixtures/campaign';
import { stubCampaign, stubCart, bootSdk, captureEvents } from './fixtures/routes';

/**
 * RemoveItemEnhancer — a button that removes a fixed package from the cart.
 */

const FIXTURE = '/e2e/fixtures/remove-item.html';

test.beforeEach(async ({ page }) => {
  await stubCampaign(page, MINIMAL_CAMPAIGN);
  await stubCart(page);
});

test('removes the package from the cart and emits cart:item-removed', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  await page.click('[data-next-action="add-to-cart"]');
  await expect(
    page.locator('[data-next-display="cart.totalQuantity"]')
  ).toHaveText('1');

  const removed = await captureEvents(page, 'cart:item-removed');

  await page.click('[data-next-remove-item]');

  await expect(
    page.locator('[data-next-display="cart.totalQuantity"]')
  ).toHaveText('0');

  await expect.poll(() => removed.count()).toBeGreaterThan(0);
  expect((await removed.all()).some((e: any) => e.packageId === 1)).toBe(true);

  // Cart is empty (no lines left).
  await expect(
    page.locator('[data-next-display="cart.itemCount"]')
  ).toHaveText('0');
});
