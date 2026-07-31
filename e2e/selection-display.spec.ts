import { test, expect } from '@playwright/test';
import { stubAll, bootSdk } from './fixtures/routes';

/**
 * E2E for the selection display enhancer
 * (`data-next-display="selection.{selectorId}.*"`).
 *
 * A package selector with two cards drives a selection display. Values come
 * from RICH_CAMPAIGN (package 1 = "Single Widget" $29.99, package 2 = "Triple
 * Widget Pack" $24.99).
 *
 * NOTE: PackageSelectorEnhancer auto-selects the first card on boot
 * (`this.items.find(isPreSelected) ?? this.items[0]`), so the selection display
 * renders package 1 immediately even though no card carries data-next-selected.
 */

const FIXTURE = '/e2e/fixtures/selection-display.html';

test.beforeEach(async ({ page }) => {
  await stubAll(page);
});

test('renders the auto-selected first card on boot', async ({ page }) => {
  await bootSdk(page, FIXTURE);

  // Selector auto-selects the first card (package 1).
  await expect(page.locator('#sel-name')).toHaveText('Single Widget');
  await expect(page.locator('#sel-price')).toHaveText('$29.99');
});

test('reflects the selected package name and price', async ({ page }) => {
  await bootSdk(page, FIXTURE);

  // Switch to the second card.
  await page.click('[data-next-selector-card][data-next-package-id="2"]');
  await expect(page.locator('#sel-name')).toHaveText('Triple Widget Pack');
  await expect(page.locator('#sel-price')).toHaveText('$24.99');

  // Switch back to the first card.
  await page.click('[data-next-selector-card][data-next-package-id="1"]');
  await expect(page.locator('#sel-name')).toHaveText('Single Widget');
  await expect(page.locator('#sel-price')).toHaveText('$29.99');
});
