import { test, expect } from '@playwright/test';
import { blockLiveNetwork, bootSdk } from './fixtures/routes';
import {
  CARD_CHECKOUT,
  addNextConfig,
  addOnePackage,
  stubCardCheckout,
  submitCard,
} from './fixtures/card-checkout';

/**
 * What a shopper reads when the Campaigns API declines their card.
 *
 * The API answers `payment_response_code` and `payment_details`, the gateway's own English
 * wording. The address-rules service has a sentence for every code at
 * `payment.errors.<code>`. Proved here:
 *
 * - **the code's sentence is shown, not the gateway's words.** `3005` reads
 *   `Check your card number and try again.`, never `Invalid Card Number`.
 * - **a code with no sentence falls back to the gateway's words**, so a code the service
 *   does not know yet still says something specific.
 * - **a page's own generic sentence goes ahead of the gateway's words**, for a page that
 *   would rather the shopper never read the gateway's English.
 *
 * Why not a unit test: `payment-decline-message.test.ts` proves the order of the lookup.
 * What it cannot prove is the wiring: the order POST's 400 reaching the card form, the
 * service's texts fetched for the form's language, and the sentence landing in the
 * container the shopper sees.
 */

const ERROR = '[data-next-component="credit-error"]';
const TEXTS = {
  'payment.errors.3005': 'Check your card number and try again.',
  'payment.errors.generic': "Your card couldn't be processed. Try again.",
};

let escaped: string[] = [];
let errors: string[] = [];

test.beforeEach(async ({ page }) => {
  escaped = await blockLiveNetwork(page);
  errors = [];
  const collect = (text: string): void => {
    // The dev server's own hot-reload socket is not the SDK.
    if (/\[vite\]|WebSocket/i.test(text)) return;
    errors.push(text);
  };
  page.on('console', m => m.type() === 'error' && collect(m.text()));
  page.on('pageerror', e => collect(e.message));
});

test.afterEach(() => {
  expect(escaped, 'requests no stub answered').toEqual([]);
  // The API client and the form log a declined order at error level on its way
  // through, and the error monitor echoes each one (Firefox prints that echo as
  // `Error JSHandle@object`). Nothing else may reach the console; an uncaught error
  // still arrives through `pageerror`.
  const declineLogs =
    /400 \(?Bad Request|Failed to create order|Failed to process tokenized payment|^\[ErrorHandler\] Captured error/;
  expect(
    errors.filter(text => !declineLogs.test(text)),
    'console errors and page errors'
  ).toEqual([]);
});

/** Declines every order with this answer. */
async function declineOrders(
  page: import('@playwright/test').Page,
  json: Record<string, unknown>
): Promise<void> {
  await page.route('**/api/v1/orders/**', route =>
    route.fulfill({ status: 400, json })
  );
}

test('a declined card shows the service’s sentence for its code', async ({
  page,
}) => {
  await stubCardCheckout(page, { texts: TEXTS });
  await declineOrders(page, {
    payment_details: 'Invalid Card Number',
    payment_method: { card_token: 'e2e-card-token' },
    payment_response_code: '3005',
    ref_id: 'e2e-declined',
  });

  await bootSdk(page, CARD_CHECKOUT);
  await addOnePackage(page);
  await submitCard(page);

  await expect(page.locator(ERROR)).toContainText(
    'Check your card number and try again.'
  );
  await expect(page.locator(ERROR)).not.toContainText('Invalid Card Number');
});

test('a code with no sentence shows the gateway’s words', async ({ page }) => {
  await stubCardCheckout(page, { texts: TEXTS });
  await declineOrders(page, {
    payment_details: 'A reason the service has no sentence for',
    payment_response_code: '9999',
  });

  await bootSdk(page, CARD_CHECKOUT);
  await addOnePackage(page);
  await submitCard(page);

  await expect(page.locator(ERROR)).toContainText(
    'A reason the service has no sentence for'
  );
});

test('a page’s own generic sentence goes ahead of the gateway’s words', async ({
  page,
}) => {
  await stubCardCheckout(page, { texts: TEXTS });
  await addNextConfig(page, {
    translations: {
      en: { 'payment.errors.generic': 'Payment failed. Try another card.' },
    },
  });
  await declineOrders(page, {
    payment_details: 'A reason the service has no sentence for',
    payment_response_code: '9999',
  });

  await bootSdk(page, CARD_CHECKOUT);
  await addOnePackage(page);
  await submitCard(page);

  await expect(page.locator(ERROR)).toContainText(
    'Payment failed. Try another card.'
  );
  await expect(page.locator(ERROR)).not.toContainText(
    'A reason the service has no sentence for'
  );
});
