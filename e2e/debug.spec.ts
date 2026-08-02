import { test, expect } from '@playwright/test';
import { MINIMAL_CAMPAIGN } from './fixtures/campaign';
import { stubCampaign, stubCart, bootSdk } from './fixtures/routes';

/**
 * Debug overlay: mounts a fixed host element (`#next-debug-overlay-host`, a
 * Shadow-DOM overlay) when debug mode is on.
 *
 * FINDING: the overlay mounts on `?debugger=true` (or meta `next-debug` /
 * `window.nextConfig.debugger`), NOT on `?debug=true`. `?debug=true` only turns
 * on AttributeScanner performance logging and does not set `configStore.debug`,
 * so `SDKInitializer.initializeDebugMode()` never runs and
 * `DebugOverlay.initialize()` early-returns. Verified against
 * src/core/sdk-initializer.ts (loadConfiguration reads `debugger`) and
 * src/core/debug/debug-overlay.ts (initialize gates on `debugger`).
 */

const FIXTURE = '/e2e/fixtures/debug.html';

test.beforeEach(async ({ page }) => {
  await stubCampaign(page, MINIMAL_CAMPAIGN);
  await stubCart(page);
});

test('mounts the debug overlay host with ?debugger=true', async ({ page }) => {
  await bootSdk(page, `${FIXTURE}?debugger=true`);

  // The overlay host is appended asynchronously (styles are imported), so poll.
  await expect(page.locator('#next-debug-overlay-host')).toHaveCount(1, {
    timeout: 5000,
  });

  // It is a Shadow-DOM host carrying the overlay root.
  const hasOverlay = await page.evaluate(() => {
    const host = document.getElementById('next-debug-overlay-host');
    return Boolean(host?.shadowRoot?.querySelector('.debug-overlay'));
  });
  expect(hasOverlay).toBe(true);
});

test('?debug=true alone does NOT mount the debug overlay', async ({ page }) => {
  await bootSdk(page, `${FIXTURE}?debug=true`);
  await expect(page.locator('html')).toHaveClass(/next-display-ready/);

  await expect(page.locator('#next-debug-overlay-host')).toHaveCount(0);
});

test('the overlay can be unmounted', async ({ page }) => {
  await bootSdk(page, `${FIXTURE}?debugger=true`);
  await expect(page.locator('#next-debug-overlay-host')).toHaveCount(1, {
    timeout: 5000,
  });

  // Use the SDK's own overlay handle (window.nextDebug, set up in debug mode)
  // so we act on the exact singleton it mounted, not a duplicate module copy.
  await page.evaluate(async () => {
    const overlay = await (window as any).nextDebug.overlay();
    overlay.hide();
  });

  await expect(page.locator('#next-debug-overlay-host')).toHaveCount(0);
});
