import { test, expect } from '@playwright/test';
import { MINIMAL_CAMPAIGN } from './fixtures/campaign';
import { stubCampaign, stubCart, bootSdk, captureEvents } from './fixtures/routes';

/**
 * E2E for the ExitIntentEnhancer (behavior/, "simple-exit-intent").
 *
 * ACTIVATION PATH: not DOM-scanned. It is constructed on document.body and
 * driven through the public SDK API `window.next.exitIntent(options)`
 * (src/core/next-commerce.ts:770 → lazy-imports the enhancer, calls
 * initialize() then setup(options)). We pass useSessionStorage:false so a prior
 * dismissal can't block the trigger, and showCloseButton:true so the close
 * button (`[data-exit-intent="close"]`) is rendered.
 *
 * TRIGGER: on desktop the enhancer listens for `mouseout` on
 * document.documentElement and fires when relatedTarget is null/HTML and
 * clientY <= 10 (simple-exit-intent.enhancer.ts:147-158). We dispatch that
 * synthetic mouseout to simulate the pointer leaving toward the top.
 */

const FIXTURE = '/e2e/fixtures/simple-exit-intent.html';

const IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='200'%3E%3Crect width='300' height='200' fill='%2300f'/%3E%3C/svg%3E";

test.beforeEach(async ({ page, isMobile }) => {
  // Exit intent is desktop-only by design: `disableOnMobile` defaults to true
  // and the mouse-out trigger is wired only when !isMobileDevice()
  // (simple-exit-intent.enhancer.ts:22,146). On mobile the overlay never shows
  // for the mouse-out path, so these desktop-trigger tests don't apply.
  test.skip(!!isMobile, 'exit-intent mouse-out trigger is desktop-only');
  await stubCampaign(page, MINIMAL_CAMPAIGN);
  await stubCart(page);
});

async function setupExitIntent(page: import('@playwright/test').Page) {
  await page.evaluate(
    ({ image }) =>
      (window as any).next.exitIntent({
        image,
        useSessionStorage: false,
        showCloseButton: true,
        disableOnMobile: true,
      }),
    { image: IMAGE }
  );
}

async function triggerExitIntent(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const evt = new MouseEvent('mouseout', {
      bubbles: true,
      cancelable: true,
      clientY: 0,
      relatedTarget: null,
    });
    document.documentElement.dispatchEvent(evt);
  });
}

test('exit intent shows an overlay + popup and emits exit-intent:shown', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);
  await setupExitIntent(page);

  const shown = await captureEvents(page, 'exit-intent:shown');

  await triggerExitIntent(page);

  await expect.poll(async () => (await shown.all()).length).toBeGreaterThan(0);
  expect(await shown.at(0)).toMatchObject({ imageUrl: IMAGE });

  await expect(
    page.locator('.exit-intent-overlay[data-exit-intent="overlay"]')
  ).toHaveCount(1);
  await expect(page.locator('.exit-intent-popup')).toHaveCount(1);
});

test('clicking the close button emits exit-intent:closed and removes the overlay', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);
  await setupExitIntent(page);

  const closed = await captureEvents(page, 'exit-intent:closed');

  await triggerExitIntent(page);
  await expect(page.locator('.exit-intent-popup')).toHaveCount(1);

  await page.locator('[data-exit-intent="close"]').click();

  await expect.poll(async () => (await closed.all()).length).toBeGreaterThan(0);
  // Overlay + popup are removed from the DOM after the hide animation.
  await expect(
    page.locator('.exit-intent-overlay[data-exit-intent="overlay"]')
  ).toHaveCount(0);
  await expect(page.locator('.exit-intent-popup')).toHaveCount(0);
});
