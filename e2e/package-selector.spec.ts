import { test, expect } from '@playwright/test';
import { RICH_CAMPAIGN } from './fixtures/campaign';
import { stubCampaign, stubCart, bootSdk, captureEvents } from './fixtures/routes';

/**
 * PackageSelectorEnhancer (swap mode) — mutually-exclusive package cards.
 *
 * On boot in swap mode with an empty cart the enhancer auto-selects the first
 * card and adds it to the cart; that auto-selection happens before the spec
 * subscribes to events, so only the explicit card click below is captured.
 */

const FIXTURE = '/e2e/fixtures/package-selector.html';

test.beforeEach(async ({ page }) => {
  await stubCampaign(page, RICH_CAMPAIGN);
  await stubCart(page);
});

test('clicking a card selects it and emits selector events with its packageId', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  const selected = await captureEvents(page, 'selector:item-selected');
  const changed = await captureEvents(page, 'selector:selection-changed');

  // Card 1 is auto-selected on boot; click card 2 to trigger an explicit swap.
  await page.click('[data-next-selector-card][data-next-package-id="2"]');

  await expect.poll(() => selected.count()).toBeGreaterThan(0);
  await expect.poll(() => changed.count()).toBeGreaterThan(0);

  const itemSelected = (await selected.all()).find((e: any) => e.packageId === 2);
  expect(itemSelected).toBeTruthy();
  expect(itemSelected.selectorId).toBe('main');
  expect(itemSelected.previousPackageId).toBe(1);
  expect(itemSelected.mode).toBe('swap');

  expect(
    (await changed.all()).some((e: any) => e.packageId === 2)
  ).toBe(true);
});

test('selected card carries the managed class and attributes', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  const card2 = page.locator('[data-next-selector-card][data-next-package-id="2"]');
  await card2.click();

  await expect(card2).toHaveClass(/next-selected/);
  await expect(card2).toHaveAttribute('data-next-selected', 'true');
  await expect(
    page.locator('[data-next-package-selector]')
  ).toHaveAttribute('data-selected-package', '2');

  // Selecting card 2 deselects card 1.
  await expect(
    page.locator('[data-next-selector-card][data-next-package-id="1"]')
  ).toHaveAttribute('data-next-selected', 'false');
});
