import { test, expect, type Page } from '@playwright/test';
import { TEST_ORDER } from './fixtures/order';
import { bootSdk, captureEvents } from './fixtures/routes';
import {
  CARD_CHECKOUT,
  addNextConfig,
  addOnePackage,
  stubCardCheckout,
  submitCard,
} from './fixtures/card-checkout';

/**
 * The card form's contract with NextPayment, which draws the hosted number and CVV.
 *
 * Two things only a full submit shows: that the order is created with the payment
 * method's token — NextPayment's response carries a transaction token beside it, and
 * posting that one fails every card order at the gateway — and that a rejected card
 * ends the submit with a message the shopper reads, in the page's words, rather than
 * leaving the form waiting for a token that is never coming.
 *
 * NextPayment is stubbed, as in every card spec (`fixtures/card-checkout.ts`): it is
 * an off-site iframe that cannot run headless. From the token on, the order request is
 * the real SDK's.
 */

/** Every order the SDK posts, as the orders API receives it. */
async function captureOrders(page: Page): Promise<unknown[]> {
  const orders: unknown[] = [];
  await page.route('**/api/v1/orders/**', route => {
    orders.push(route.request().postDataJSON());
    return route.fulfill({ json: { ...TEST_ORDER, number: 'E2E-NP-1' } });
  });
  return orders;
}

/** `console.error` and uncaught errors, which the SDK's own catch blocks hide. */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', m => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', e => errors.push(String(e)));
  return errors;
}

test.use({ locale: 'en-US' });

test("creates the card order with the payment method's token", async ({
  page,
}) => {
  const { scriptRequests, submits, submitParams } =
    await stubCardCheckout(page);
  const orders = await captureOrders(page);
  const errors = collectErrors(page);

  await bootSdk(page, CARD_CHECKOUT);
  await addOnePackage(page);
  await submitCard(page);

  await expect.poll(() => orders.length).toBe(1);
  expect(orders[0]).toMatchObject({
    payment_detail: {
      payment_method: 'card_token',
      card_token: 'e2e-payment-method-token',
    },
  });

  expect(submits).toEqual([
    {
      full_name: 'Ada Lovelace',
      first_name: 'Ada',
      last_name: 'Lovelace',
      month: '12',
      year: '2030',
    },
  ]);
  expect(submitParams).toEqual([
    {
      metadata: {
        source: 'next-campaign-cart',
        sdk_version: expect.stringMatching(/^\d+\.\d+\.\d+/),
        campaign_id: '7',
        page: expect.stringMatching(/\/e2e\/fixtures\/card-purchase\.html$/),
      },
    },
  ]);
  expect(scriptRequests).toEqual([
    'https://payments.29next.com/js/v1/payment.js?env_key=e2e-env-key',
  ]);
  expect(errors).toEqual([]);
});

test('a rejected card number ends the submit with the page’s own message, and no order', async ({
  page,
}) => {
  await stubCardCheckout(page, {}, { outcome: 'reject-number' });
  await addNextConfig(page, {
    translations: {
      en: { 'payment.card.number.errors.invalid': 'Check the card number' },
    },
  });
  const orders = await captureOrders(page);

  await bootSdk(page, CARD_CHECKOUT);
  const paymentErrors = await captureEvents(page, 'payment:error');
  await addOnePackage(page);
  await submitCard(page);

  await expect.poll(() => paymentErrors.count()).toBeGreaterThan(0);
  const [first] = (await paymentErrors.all()) as unknown[];
  expect(JSON.stringify(first)).toContain('Check the card number');
  expect(JSON.stringify(first)).not.toContain('Invalid card number');

  // The submit is over: the button takes a second attempt.
  await expect(page.locator('[data-next-checkout-submit]')).toBeEnabled();
  expect(orders).toEqual([]);
});

test('a number the fields report invalid is stopped before NextPayment, with the page’s own message', async ({
  page,
}) => {
  const { submits } = await stubCardCheckout(page, {}, { numberValid: false });
  await addNextConfig(page, {
    translations: {
      en: { 'payment.card.number.errors.invalid': 'Check the card number' },
    },
  });
  const orders = await captureOrders(page);

  await bootSdk(page, CARD_CHECKOUT);
  await addOnePackage(page);
  await submitCard(page);

  await expect(page.locator('[data-next-error-for="cc-number"]')).toHaveText(
    'Check the card number'
  );
  expect(submits).toEqual([]);
  expect(orders).toEqual([]);
});

test('card fields older than their credentials are rebuilt from a fresh script, and ask for the card again', async ({
  page,
}) => {
  await page.clock.install();
  const { scriptRequests, submits } = await stubCardCheckout(page);
  const orders = await captureOrders(page);

  await bootSdk(page, CARD_CHECKOUT);
  const paymentErrors = await captureEvents(page, 'payment:error');
  await addOnePackage(page);
  await page.clock.fastForward('01:01:00');
  await submitCard(page);

  await expect.poll(() => paymentErrors.count()).toBeGreaterThan(0);
  expect(JSON.stringify(await paymentErrors.at(0))).toContain(
    'Your card details timed out'
  );
  await expect.poll(() => scriptRequests.length).toBe(2);
  // A URL of its own, or the browser could answer it with the expired script.
  expect(scriptRequests[1]).not.toBe(scriptRequests[0]);
  expect(scriptRequests[1]).toContain('env_key=e2e-env-key');
  expect(submits).toEqual([]);

  // The rebuilt fields take the card, and the order goes out.
  await page.click('[data-next-checkout-submit]');
  await expect.poll(() => orders.length).toBe(1);
  expect(submits).toHaveLength(1);
});

test('fresh card fields are not rebuilt when the shopper comes back to the tab', async ({
  page,
}) => {
  await page.clock.install();
  const { scriptRequests } = await stubCardCheckout(page);

  await bootSdk(page, CARD_CHECKOUT);
  await page.clock.fastForward('10:00');
  await page.evaluate(() =>
    document.dispatchEvent(new Event('visibilitychange'))
  );
  await page.clock.fastForward('55:00');

  // Sixty-five minutes in, but the tab came back at ten; nothing asked for new fields.
  expect(scriptRequests).toHaveLength(1);

  await page.evaluate(() =>
    document.dispatchEvent(new Event('visibilitychange'))
  );
  await expect.poll(() => scriptRequests.length).toBe(2);
});

test('announces the card fields ready under the new name and the deprecated one', async ({
  page,
}) => {
  await stubCardCheckout(page, {}, { holdReady: true });
  await bootSdk(page, CARD_CHECKOUT);

  const payment = await captureEvents(page, 'checkout:payment-ready');
  const spreedly = await captureEvents(page, 'checkout:spreedly-ready');
  expect(await payment.count()).toBe(0);

  await page.evaluate(() =>
    (
      window as unknown as { __releaseNextPayment: () => void }
    ).__releaseNextPayment()
  );

  await expect.poll(() => payment.count()).toBe(1);
  await expect.poll(() => spreedly.count()).toBe(1);
});
