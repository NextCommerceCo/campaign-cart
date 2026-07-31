import { test, expect } from '@playwright/test';
import type { Campaign } from '../src/types/campaign';
import { MINIMAL_CAMPAIGN } from './fixtures/campaign';
import { stubCampaign, stubCart, bootSdk } from './fixtures/routes';

/**
 * E2E for the express-checkout container (`data-next-express-checkout="container"`).
 *
 * The container injects one button per method in the campaign's
 * `available_express_payment_methods` into the `[buttons]` child, but only for
 * methods available on the device. In Chromium PayPal is always available
 * (`isPayPalAvailable()` returns true), so we drive PayPal.
 *
 * `express-checkout:initialized` fires during the DOM scan, before window.next
 * exists, so the fixture buffers it from the shared EventBus (see the fixture's
 * inline module).
 */

// MINIMAL_CAMPAIGN + one express method. Built inline (shared fixtures stay
// untouched) so the container has exactly one method to render.
const CAMPAIGN_WITH_PAYPAL: Campaign = {
  ...MINIMAL_CAMPAIGN,
  available_express_payment_methods: [{ code: 'paypal', label: 'PayPal' }],
};

const FIXTURE = '/e2e/fixtures/express-checkout-container.html';

test.beforeEach(async ({ page }) => {
  await stubCampaign(page, CAMPAIGN_WITH_PAYPAL);
  await stubCart(page);
});

test('injects a PayPal button and emits express-checkout:initialized', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  // A button carrying data-next-express-checkout="paypal" is injected into the
  // buttons container.
  const button = page.locator(
    '[data-next-express-checkout="buttons"] [data-next-express-checkout="paypal"]'
  );
  await expect(button).toHaveCount(1);

  // The initialized event fired for the paypal method with its button element.
  const events = await page.evaluate(
    () => (window as any).__capturedEvents['express-checkout:initialized']
  );
  expect(events.some((e: any) => e.method === 'paypal' && e.hasElement)).toBe(
    true
  );
});

test('buttons get next-cart-empty when the cart becomes empty', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  const button = page.locator(
    '[data-next-express-checkout="buttons"] [data-next-express-checkout="paypal"]'
  );
  await expect(button).toHaveCount(1);

  // handleCartUpdate only runs on cart-store changes. Add an item so the
  // buttons reflect a non-empty cart (no next-cart-empty), then empty it.
  await page.evaluate(() => (window as any).next.addItem({ packageId: 1 }));
  await expect(button).not.toHaveClass(/next-cart-empty/);

  await page.evaluate(() => (window as any).next.clearCart());
  await expect(button).toHaveClass(/next-cart-empty/);
  await expect(button).toHaveAttribute('disabled', 'true');
});
