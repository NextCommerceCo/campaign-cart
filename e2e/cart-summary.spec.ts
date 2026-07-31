import { test, expect } from '@playwright/test';
import { RICH_CAMPAIGN } from './fixtures/campaign';
import { stubCampaign, stubCart, bootSdk } from './fixtures/routes';

/**
 * CartSummaryEnhancer — renders a totals block from a custom <template>,
 * re-rendering on every cart store update. Host state classes reflect emptiness.
 */

const FIXTURE = '/e2e/fixtures/cart-summary.html';

test.beforeEach(async ({ page }) => {
  await stubCampaign(page, RICH_CAMPAIGN);
  await stubCart(page);
});

test('empty cart carries next-cart-empty; adding an item recomputes totals', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  const host = page.locator('[data-next-cart-summary]');
  await expect(host).toHaveClass(/next-cart-empty/);

  // Package 1 (RICH) costs 29.99.
  await page.click('[data-next-action="add-to-cart"]');

  await expect(host).toHaveClass(/next-cart-has-items/);
  await expect(host).not.toHaveClass(/next-cart-empty/);

  await expect(page.locator('#item-count')).toHaveText('1');
  await expect(page.locator('#subtotal')).toContainText('29.99');
  await expect(page.locator('#total')).toContainText('29.99');
});
