import { test, expect } from '@playwright/test';
import { RICH_CAMPAIGN } from './fixtures/campaign';
import { stubCampaign, stubCart, bootSdk, captureEvents } from './fixtures/routes';

/**
 * BundleSelectorEnhancer (swap mode) — pick one named bundle; its packages
 * atomically replace the previously selected bundle's items in the cart.
 *
 * Bundle A (packages [1]) is the pre-selected default and is applied to the
 * cart on boot. Clicking Bundle B ([1,3]) swaps the cart to B's items.
 */

const FIXTURE = '/e2e/fixtures/bundle-selector.html';

test.beforeEach(async ({ page }) => {
  await stubCampaign(page, RICH_CAMPAIGN);
  await stubCart(page);
});

test('selecting a bundle emits bundle events and swaps the cart contents', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  const host = page.locator('[data-next-cart-items]');

  // Bundle A applied on boot → cart holds exactly package 1.
  await expect(host.locator('.cart-item')).toHaveCount(1);
  await expect(host.locator('.cart-item[data-package-id="1"]')).toHaveCount(1);

  const selectedEvt = await captureEvents(page, 'bundle:selected');
  const changedEvt = await captureEvents(page, 'bundle:selection-changed');

  const bundleB = page.locator('[data-next-bundle-card][data-next-bundle-id="bundle-b"]');
  await bundleB.click();

  // Both events fire, carrying the bundle's effective items.
  await expect.poll(() => selectedEvt.count()).toBeGreaterThan(0);
  await expect.poll(() => changedEvt.count()).toBeGreaterThan(0);

  const selected = (await selectedEvt.all()).at(-1);
  expect(selected.selectorId).toBe('bundles');
  expect(selected.items.map((i: any) => i.packageId).sort()).toEqual([1, 3]);

  // Card gets the selected class + attribute.
  await expect(bundleB).toHaveClass(/next-selected/);
  await expect(bundleB).toHaveAttribute('data-next-selected', 'true');

  // Cart now reflects Bundle B's packages (1 and 3), not Bundle A's.
  await expect(host.locator('.cart-item')).toHaveCount(2);
  await expect(host.locator('.cart-item[data-package-id="1"]')).toHaveCount(1);
  await expect(host.locator('.cart-item[data-package-id="3"]')).toHaveCount(1);
});
