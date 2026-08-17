import { test, expect, type Request } from '@playwright/test';
import type { Campaign } from '../src/types/campaign';
import { MINIMAL_CAMPAIGN } from './fixtures/campaign';
import { TEST_ORDER } from './fixtures/order';
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

/**
 * The fallback path: the campaign lists no express methods, so the buttons come
 * from `window.nextConfig.paymentConfig.expressCheckout.methods`.
 *
 * Google Pay drives it because it is the one method available on every project —
 * `isGooglePayAvailable()` is unconditional, where Apple Pay is hidden on Android
 * and so would not render on Pixel 5.
 */
const CONFIGURED_METHODS = [
  ['google_pay', 'the spelling to write'],
  ['googlePay', 'the older camelCase spelling'],
] as const;

for (const [key, description] of CONFIGURED_METHODS) {
  test(`turns on a configured button named with ${description}`, async ({
    page,
  }) => {
    // Overrides the campaign stubbed in beforeEach: this one offers no express
    // methods of its own, which is what hands the decision to the config.
    await stubCampaign(page, MINIMAL_CAMPAIGN);
    await page.addInitScript(methodKey => {
      (window as any).nextConfig = {
        paymentConfig: {
          expressCheckout: { enabled: true, methods: { [methodKey]: true } },
        },
      };
    }, key);

    await bootSdk(page, FIXTURE);

    await expect(
      page.locator(
        '[data-next-express-checkout="buttons"] [data-next-express-checkout="google_pay"]'
      )
    ).toHaveCount(1);
  });
}

/**
 * Link is the one method the platform offers **both** ways — as an express button
 * here and as a radio in the checkout form. This covers the button: it renders
 * like the other three, and pressing it creates the order with `link` on it and
 * sends the shopper to Link to pay.
 */
test('renders a Link button and pays with it', async ({ page }) => {
  await stubCampaign(page, {
    ...MINIMAL_CAMPAIGN,
    available_express_payment_methods: [{ code: 'link', label: 'Link' }],
  });

  const posted: Request[] = [];
  await page.route('**/api/v1/orders/**', route => {
    if (route.request().method() === 'POST') posted.push(route.request());
    return route.fulfill({
      json: {
        ...TEST_ORDER,
        number: 'E2E-LINK-1',
        payment_complete_url: '/e2e/fixtures/express-gateway.html',
      },
    });
  });

  await bootSdk(page, FIXTURE);

  const button = page.locator(
    '[data-next-express-checkout="buttons"] [data-next-express-checkout="link"]'
  );
  await expect(button).toHaveCount(1);

  // The button has no text of its own, so the logo has to carry its name.
  await expect(button.locator('svg title')).toHaveText('Link');

  await page.evaluate(() => (window as any).next.addItem({ packageId: 1 }));
  await expect(button).not.toHaveClass(/next-cart-empty/);
  await button.click();

  await page.waitForURL('**/e2e/fixtures/express-gateway.html');
  expect(posted[0]?.postDataJSON().payment_detail).toEqual({
    payment_method: 'link',
  });
});
