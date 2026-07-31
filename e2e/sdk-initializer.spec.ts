import { test, expect } from '@playwright/test';
import { MINIMAL_CAMPAIGN } from './fixtures/campaign';
import { stubCampaign, stubCart, bootSdk } from './fixtures/routes';

/**
 * Core boot: SDKInitializer + the NextCommerce (`window.next`) facade.
 *
 * Asserts the facade is exposed and functional (events + campaign read), that
 * the DOM scan completes (the `next:display-ready` signal), and that the boot
 * guard makes a second `initialize()` a no-op (no re-scan, no throw).
 */

const FIXTURE = '/e2e/fixtures/sdk-initializer.html';

test.beforeEach(async ({ page }) => {
  await stubCampaign(page, MINIMAL_CAMPAIGN);
  await stubCart(page);
});

test('exposes window.next with working on/emit and campaign read', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  // Subscribe via the facade `on`, emit via the shared EventBus singleton.
  // FINDING: `window.next` exposes `on`/`off` but NO public `emit`, so an
  // emit-side round-trip must go through the exported EventBus (same instance
  // NextCommerce.on delegates to).
  const received = await page.evaluate(async () => {
    const { EventBus }: any = await import('/src/index.ts');
    return await new Promise<any>(resolve => {
      const sdk = (window as any).next;
      sdk.on('cart:item-added', (d: any) => resolve(d));
      EventBus.getInstance().emit('cart:item-added', {
        packageId: 42,
        quantity: 2,
      });
    });
  });
  expect(received).toMatchObject({ packageId: 42, quantity: 2 });

  // getCampaignData returns the stubbed campaign.
  const campaignName = await page.evaluate(
    () => (window as any).next.getCampaignData()?.name
  );
  expect(campaignName).toBe(MINIMAL_CAMPAIGN.name);
});

test('completes the DOM scan (next-display-ready)', async ({ page }) => {
  await bootSdk(page, FIXTURE);

  await expect(page.locator('html')).toHaveClass(/next-display-ready/);
});

test('double init is guarded: re-initialize does not re-scan or throw', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  // Attach a display-ready listener AFTER the first scan already fired, so any
  // count > 0 here would mean a second scan happened.
  await page.evaluate(() => {
    (window as any).__displayReady = 0;
    window.addEventListener('next:display-ready', () => {
      (window as any).__displayReady++;
    });
  });

  // Call initialize() again via the exported SDKInitializer.
  const result = await page.evaluate(async () => {
    const mod: any = await import('/src/index.ts');
    let threw = false;
    try {
      await mod.SDKInitializer.initialize();
    } catch {
      threw = true;
    }
    return { threw, stillInitialized: mod.SDKInitializer.isInitialized() };
  });

  expect(result.threw).toBe(false);
  expect(result.stillInitialized).toBe(true);

  // No second scan fired, and the facade is still responsive.
  const rescans = await page.evaluate(() => (window as any).__displayReady);
  expect(rescans).toBe(0);

  const campaignName = await page.evaluate(
    () => (window as any).next.getCampaignData()?.name
  );
  expect(campaignName).toBe(MINIMAL_CAMPAIGN.name);
});
