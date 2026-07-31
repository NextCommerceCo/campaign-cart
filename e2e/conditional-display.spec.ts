import { test, expect } from '@playwright/test';
import { stubAll, bootSdk } from './fixtures/routes';

/**
 * E2E for the conditional display enhancer (`data-next-show` / `data-next-hide`).
 *
 * One element shows when `cart.hasItems`, another hides when `cart.hasItems`.
 * On an empty cart the first is hidden and the second visible; adding a package
 * flips both. Visibility is asserted via the managed `next-visible` /
 * `next-hidden` classes and the inline `display` style.
 */

const FIXTURE = '/e2e/fixtures/conditional-display.html';

test.beforeEach(async ({ page }) => {
  await stubAll(page);
});

test('shows/hides based on the empty cart on boot', async ({ page }) => {
  await bootSdk(page, FIXTURE);

  // data-next-show="cart.hasItems": empty cart => not met => hidden.
  await expect(page.locator('#show-when-items')).toHaveClass(
    /next-condition-not-met/
  );
  await expect(page.locator('#show-when-items')).toHaveClass(/next-hidden/);
  await expect(page.locator('#show-when-items')).toHaveCSS('display', 'none');

  // data-next-hide="cart.hasItems": empty cart => shown.
  await expect(page.locator('#hide-when-items')).toHaveClass(/next-visible/);
  await expect(page.locator('#hide-when-items')).not.toHaveCSS(
    'display',
    'none'
  );
});

test('toggles both elements when a package is added', async ({ page }) => {
  await bootSdk(page, FIXTURE);

  await page.click('[data-next-action="add-to-cart"]');

  // Now the cart has items: show-element becomes visible.
  await expect(page.locator('#show-when-items')).toHaveClass(
    /next-condition-met/
  );
  await expect(page.locator('#show-when-items')).toHaveClass(/next-visible/);
  await expect(page.locator('#show-when-items')).not.toHaveCSS(
    'display',
    'none'
  );

  // And the hide-element becomes hidden.
  await expect(page.locator('#hide-when-items')).toHaveClass(/next-hidden/);
  await expect(page.locator('#hide-when-items')).toHaveCSS('display', 'none');
});
