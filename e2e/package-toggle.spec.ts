import { test, expect } from '@playwright/test';
import { RICH_CAMPAIGN } from './fixtures/campaign';
import { stubCampaign, stubCart, bootSdk, captureEvents } from './fixtures/routes';

/**
 * PackageToggleEnhancer — independently add/remove a single package by clicking
 * its card. Unlike the selector, nothing is auto-added on boot (no card is
 * pre-selected in the fixture).
 */

const FIXTURE = '/e2e/fixtures/package-toggle.html';

test.beforeEach(async ({ page }) => {
  await stubCampaign(page, RICH_CAMPAIGN);
  await stubCart(page);
});

test('toggles a package into and out of the cart', async ({ page }) => {
  await bootSdk(page, FIXTURE);

  const toggled = await captureEvents(page, 'toggle:toggled');
  const card = page.locator('[data-next-toggle-card][data-next-package-id="1"]');

  // First click → added.
  await card.click();
  await expect.poll(() => toggled.count()).toBeGreaterThan(0);
  await expect(card).toHaveClass(/next-in-cart/);

  const firstAdded = (await toggled.all()).at(-1);
  expect(firstAdded.packageId).toBe(1);
  expect(firstAdded.added).toBe(true);

  // Second click → removed.
  await card.click();
  await expect(card).toHaveClass(/next-not-in-cart/);
  await expect(card).not.toHaveClass(/next-in-cart/);

  const lastToggle = (await toggled.all()).at(-1);
  expect(lastToggle.packageId).toBe(1);
  expect(lastToggle.added).toBe(false);
});
