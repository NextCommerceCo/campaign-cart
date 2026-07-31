import { test, expect } from '@playwright/test';
import { stubAll, bootSdk } from './fixtures/routes';

/**
 * E2E for the shipping display enhancer (`data-next-display="shipping.*"`).
 *
 * Each display resolves against the shipping method named by its ancestor
 * `[data-next-shipping-id]`. RICH_CAMPAIGN ships two methods: ref_id 1
 * (code "standard", $5.99) and ref_id 2 (code "free", $0.00).
 */

const FIXTURE = '/e2e/fixtures/shipping-display.html';

test.beforeEach(async ({ page }) => {
  await stubAll(page);
});

test('renders the standard (paid) shipping method', async ({ page }) => {
  await bootSdk(page, FIXTURE);

  await expect(page.locator('#s1-cost')).toHaveText('$5.99');
  await expect(page.locator('#s1-name')).toHaveText('standard');
  await expect(page.locator('#s1-free')).toHaveText('No');
});

test('renders the free shipping method', async ({ page }) => {
  await bootSdk(page, FIXTURE);

  await expect(page.locator('#s2-cost')).toHaveText('$0.00');
  await expect(page.locator('#s2-name')).toHaveText('free');
  await expect(page.locator('#s2-free')).toHaveText('Yes');
});
