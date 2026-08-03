import { test, expect } from '@playwright/test';
import { RICH_CAMPAIGN } from './fixtures/campaign';
import { stubCampaign, stubCart, bootSdk } from './fixtures/routes';

/**
 * CartItemListEnhancer — renders the cart lines into a host by replacing its
 * innerHTML on every cart store update. It self-enhances the per-row
 * data-next-quantity / data-next-remove-item buttons in the default template.
 *
 * Re-render safety: adding a second package must re-render the list so it holds
 * exactly the current cart lines — no stale or duplicated rows.
 */

const FIXTURE = '/e2e/fixtures/cart-item-list.html';

test.beforeEach(async ({ page }) => {
  await stubCampaign(page, RICH_CAMPAIGN);
  await stubCart(page);
});

test('renders cart rows and re-renders on add without duplicates', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  const host = page.locator('[data-next-cart-items]');

  // Add package 1 → host flips to has-items and one row appears.
  await page.click('#add-1');
  await expect(host).toHaveClass(/cart-has-items/);
  await expect(
    host.locator('.cart-item[data-package-id="1"]')
  ).toHaveCount(1);

  // Add package 2 → list re-renders with exactly two distinct rows.
  await page.click('#add-2');
  await expect(host.locator('.cart-item')).toHaveCount(2);
  await expect(host.locator('.cart-item[data-package-id="1"]')).toHaveCount(1);
  await expect(host.locator('.cart-item[data-package-id="2"]')).toHaveCount(1);
});

test('self-enhanced in-list remove button removes the row', async ({ page }) => {
  await bootSdk(page, FIXTURE);

  const host = page.locator('[data-next-cart-items]');

  await page.click('#add-1');
  await page.click('#add-2');
  await expect(host.locator('.cart-item')).toHaveCount(2);

  // Click the remove button rendered inside package 1's row.
  await host
    .locator('.cart-item[data-package-id="1"] [data-next-remove-item]')
    .click();

  // Row 1 is gone; row 2 remains — proving the in-list button was live and the
  // re-render reflects the current cart.
  await expect(host.locator('.cart-item[data-package-id="1"]')).toHaveCount(0);
  await expect(host.locator('.cart-item[data-package-id="2"]')).toHaveCount(1);
});

test('self-enhanced in-list quantity button changes the row quantity', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  const host = page.locator('[data-next-cart-items]');
  await page.click('#add-1');
  await expect(host.locator('.cart-item[data-package-id="1"]')).toHaveCount(1);

  await host
    .locator('.cart-item[data-package-id="1"] [data-next-quantity="increase"]')
    .click();

  // The list re-renders with the new quantity in the row's quantity display.
  await expect(
    host.locator('.cart-item[data-package-id="1"] .quantity-display')
  ).toHaveText('2');
});
