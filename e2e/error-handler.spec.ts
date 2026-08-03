import { test, expect } from '@playwright/test';
import { MINIMAL_CAMPAIGN } from './fixtures/campaign';
import { stubCampaign, stubCart, bootSdk } from './fixtures/routes';

/**
 * Monitoring: an enhancer that throws during `initialize()` is caught by the
 * scanner (logged + `destroy()`ed) and never crashes the page; the global
 * error handler is installed and turns window errors into an `error:occurred`
 * event rather than letting them break the page.
 *
 * The fixture includes a malformed `data-next-quantity="increase"` with no
 * `data-package-id`, so QuantityControlEnhancer.initialize() throws
 * (src/features/cart/quantity-control/quantity-control.enhancer.ts) — the
 * scanner's per-enhancer try/catch handles it
 * (src/core/attribute-scanner.ts enhanceElement). Handler:
 * src/core/monitoring/error-handler.ts.
 */

const FIXTURE = '/e2e/fixtures/error-handler.html';

test.beforeEach(async ({ page }) => {
  await stubCampaign(page, MINIMAL_CAMPAIGN);
  await stubCart(page);
});

test('a throwing enhancer does not break the page or other enhancers', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', e => pageErrors.push(e.message));

  await bootSdk(page, FIXTURE);

  // Boot still completed despite the malformed enhancer.
  await expect(page.locator('html')).toHaveClass(/next-display-ready/);

  // The healthy enhancers still work: add-to-cart updates the cart display.
  await page.click('[data-next-action="add-to-cart"]');
  await expect(
    page.locator('[data-next-display="cart.totalQuantity"]')
  ).toHaveText('1');

  // The facade is still responsive.
  const campaignName = await page.evaluate(
    () => (window as any).next.getCampaignData()?.name
  );
  expect(campaignName).toBe(MINIMAL_CAMPAIGN.name);

  // The enhancer's initialize() throw was caught by the scanner — it must not
  // have surfaced as an uncaught page error.
  expect(pageErrors).toEqual([]);
});

test('global error handler turns window errors into error:occurred (page survives)', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  // Subscribe to the SDK error event, then dispatch a window error. The
  // installed handler should capture it and emit error:occurred.
  const captured = await page.evaluate(async () => {
    return await new Promise<any>(resolve => {
      const timer = setTimeout(() => resolve(null), 2000);
      (window as any).next.on('error:occurred', (d: any) => {
        clearTimeout(timer);
        resolve(d);
      });
      window.dispatchEvent(
        new ErrorEvent('error', {
          error: new Error('e2e-boom'),
          message: 'e2e-boom',
        })
      );
    });
  });

  expect(captured).not.toBeNull();
  expect(captured.message).toContain('e2e-boom');

  // Page is still alive after the error.
  const alive = await page.evaluate(() =>
    Boolean((window as any).next?.getCampaignData())
  );
  expect(alive).toBe(true);
});
