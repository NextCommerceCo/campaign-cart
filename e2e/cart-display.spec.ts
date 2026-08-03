import { test, expect } from '@playwright/test';
import { stubAll, bootSdk } from './fixtures/routes';

/**
 * E2E for the cart display enhancer (`data-next-display="cart.*"`).
 *
 * Verifies the CartDisplayEnhancer resolves live cart values (subtotal,
 * totalQuantity, currency) and re-renders when the cart changes. Uses the RICH
 * campaign (package 1 = $29.99, qty 1) via the shared `stubAll` helper.
 */

const FIXTURE = '/e2e/fixtures/cart-display.html';

test.beforeEach(async ({ page }) => {
  await stubAll(page); // RICH_CAMPAIGN + cart calculate stub
});

test('renders empty-cart values on boot', async ({ page }) => {
  await bootSdk(page, FIXTURE);

  await expect(page.locator('#subtotal')).toHaveText('$0.00');
  await expect(page.locator('#qty')).toHaveText('0');
  // Cart currency is seeded from the campaign currency on load.
  await expect(page.locator('#currency')).toHaveText('USD');
});

test('reflects an added package in subtotal and totalQuantity', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  await page.click('[data-next-action="add-to-cart"]');

  // Package 1 is $29.99 at qty 1.
  await expect(page.locator('#subtotal')).toHaveText('$29.99');
  await expect(page.locator('#qty')).toHaveText('1');
});
