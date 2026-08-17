import { test, expect, type Page } from '@playwright/test';
import type { Order } from '../src/types/api';
import { TEST_ORDER } from './fixtures/order';
import { bootSdk } from './fixtures/routes';
import {
  CARD_CHECKOUT,
  addOnePackage,
  stubCardCheckout,
  submitCard,
} from './fixtures/card-checkout';

/**
 * The loading overlay has to stay up for as long as a card order is in flight —
 * [issue #75](https://github.com/NextCommerceCo/campaign-cart/issues/75).
 *
 * The checkout listens for `window` focus and, on hearing it, hid the overlay,
 * cleared `isProcessing` and gave the pay button back. That was built for a
 * shopper cancelling PayPal or Apple Pay, which returns focus without firing
 * `pageshow` — but it ran for every payment method. On a phone, focus fires
 * routinely mid-checkout when the keyboard closes or the page is tapped, so a
 * card order that took 60 to 150 seconds lost its overlay while the request was
 * still open. The page looked idle, the shopper read that as a failure, and
 * pressed Complete Purchase again.
 *
 * Why this cannot be a unit test: the subject is what a shopper can see and
 * click while a request is open. That needs a real form submit, a real in-flight
 * fetch, and a real overlay element in a real layout — happy-dom does no layout,
 * so `toBeVisible` there means nothing.
 *
 * The card harness — the Spreedly stand-in, the country stubs, the form filling
 * — is [`fixtures/card-checkout.ts`](./fixtures/card-checkout.ts), shared with
 * `card-purchase.spec.ts`.
 */

const PAID_ORDER: Order = { ...TEST_ORDER, number: 'E2E-OVERLAY-1' };

const overlay = (page: Page) => page.locator('.next-loading-overlay');
const payButton = (page: Page) => page.locator('[data-next-checkout-submit]');

/**
 * Holds `POST /api/v1/orders/` open until the returned `release` is called, which
 * is what a 60-second gateway looks like from the browser. Counts the POSTs so a
 * second order is detectable, and answers the landing page's `GET` normally.
 */
function holdTheOrder(page: Page): {
  release: () => void;
  posts: () => number;
} {
  let release!: () => void;
  const held = new Promise<void>(resolve => (release = resolve));
  let posts = 0;

  void page.route('**/api/v1/orders/**', async route => {
    if (route.request().method() !== 'POST') {
      return route.fulfill({ json: PAID_ORDER });
    }
    posts += 1;
    await held;
    await route.fulfill({ json: PAID_ORDER });
  });

  return { release, posts: () => posts };
}

/** The mobile symptom: the keyboard closing, a tap on the page. */
async function windowRegainsFocus(page: Page): Promise<void> {
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
}

test.beforeEach(async ({ page }) => {
  await stubCardCheckout(page);
});

test('a card order in flight keeps its overlay when the window regains focus', async ({
  page,
}) => {
  const order = holdTheOrder(page);

  await bootSdk(page, CARD_CHECKOUT);
  await addOnePackage(page);
  await submitCard(page);

  await expect(overlay(page)).toBeVisible();
  await expect(payButton(page)).toBeDisabled();

  // Twice, because the phone fires it more than once per checkout.
  await windowRegainsFocus(page);
  await windowRegainsFocus(page);

  // Nothing about the page says "idle" while the gateway still has the order.
  await expect(overlay(page)).toBeVisible();
  await expect(payButton(page)).toBeDisabled();
  await expect(payButton(page)).toHaveAttribute('aria-busy', 'true');

  // And the shopper cannot buy the same thing twice: one POST, still the only
  // one, after the page had every chance to accept a second submit.
  expect(order.posts()).toBe(1);

  // The gateway finally answers, and the shopper goes where they were going.
  order.release();
  await page.waitForURL(
    url => url.searchParams.get('ref_id') === PAID_ORDER.ref_id
  );
});

/**
 * The negative control. "Overlay stays up" is only worth anything if the overlay
 * can still come down — a fix that left it up forever would pass every assertion
 * above and strand every shopper whose card is declined.
 */
test('a refused card order takes the overlay back down', async ({ page }) => {
  await page.route('**/api/v1/orders/**', route =>
    route.fulfill({
      status: 400,
      json: { payment_details: 'Your card was declined.' },
    })
  );

  await bootSdk(page, CARD_CHECKOUT);
  await addOnePackage(page);
  await submitCard(page);

  await expect(overlay(page)).toHaveCount(0);
  await expect(payButton(page)).toBeEnabled();
});
