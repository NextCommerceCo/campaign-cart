import { test, expect, type Page, type Request } from '@playwright/test';
import type { Order } from '../src/types/api';
import { MINIMAL_CAMPAIGN } from './fixtures/campaign';
import { TEST_ORDER } from './fixtures/order';
import { stubCampaign, stubCart, bootSdk } from './fixtures/routes';

/**
 * Paying by a method that has no form and no express button — iDEAL, Bancontact,
 * SEPA, TWINT, Affirm, Link — which is
 * [issue #74](https://github.com/NextCommerceCo/campaign-cart/issues/74).
 *
 * The shopper picks the radio, fills the same checkout form as everyone else, and
 * the order is created with that method on it. The API answers with a
 * `payment_complete_url`, and the SDK's job is to send them there to pay. Two
 * things can silently go wrong, and both did before this: the radio can be read
 * as a card, so the order goes out as a card; and the redirect can go to the
 * thank-you page, so the shopper never pays at all.
 *
 * Why this cannot be a unit test: what is being proved is the whole journey — a
 * real radio, a real form submit, the request the SDK actually posted, and the
 * URL the browser actually ended up at. happy-dom has one document and does not
 * navigate.
 *
 * Nothing here needs Spreedly: a redirect method collects no card, so the SDK
 * never builds its tokenizer (MINIMAL_CAMPAIGN ships an empty `payment_env_key`,
 * which is what decides that).
 */

const CHECKOUT = '/e2e/fixtures/redirect-payment.html';
/** Stands in for the bank's own page — off our site, but still local. */
const GATEWAY = '/e2e/fixtures/express-gateway.html';

/** An order nobody has paid for yet: `payment_complete_url` is where they pay. */
const AWAITING_PAYMENT: Order = {
  ...TEST_ORDER,
  number: 'E2E-IDEAL-1',
  payment_complete_url: GATEWAY,
};

/** The same order after the money moved — no `payment_complete_url` on it. */
const PAID: Order = { ...TEST_ORDER, number: 'E2E-IDEAL-1' };

/**
 * Answers `POST /api/v1/orders/` with `order`, and records what was posted so a
 * test can assert on the payment method that actually reached the API.
 */
async function stubOrderCreate(page: Page, order: Order): Promise<Request[]> {
  const posted: Request[] = [];
  await page.route('**/api/v1/orders/**', route => {
    if (route.request().method() === 'POST') posted.push(route.request());
    return route.fulfill({ json: order });
  });
  return posted;
}

/** Fills every field the form requires, picks `method`, and submits. */
async function submitWith(page: Page, method: string): Promise<void> {
  await page.fill('[data-next-checkout-field="email"]', 'ada@example.test');
  await page.fill('[data-next-checkout-field="fname"]', 'Ada');
  await page.fill('[data-next-checkout-field="lname"]', 'Lovelace');
  await page.fill('[data-next-checkout-field="address1"]', '1 Test Street');
  await page.fill('[data-next-checkout-field="city"]', 'New York');
  await page.fill('[data-next-checkout-field="postal"]', '10001');
  // A number libphonenumber accepts — the form runs intl-tel-input, and a
  // 555-01xx placeholder is rejected as invalid.
  await page.fill('[data-next-checkout-field="phone"]', '4155552671');
  await page.selectOption('[data-next-checkout-field="country"]', 'US');
  await page.selectOption('[data-next-checkout-field="province"]', 'NY');
  await page.check(`input[name="payment_method"][value="${method}"]`);
  await page.click('[data-next-checkout-submit]');
}

test.beforeEach(async ({ page }) => {
  await stubCampaign(page, MINIMAL_CAMPAIGN);
  await stubCart(page);
  // The form's CountryService reaches an external CDN. Two endpoints, two
  // shapes — only /states carries countryConfig, and answering both with the
  // location shape makes updateFormLabels throw.
  await page.route('**/cdn-countries*/**', route => {
    const config = {
      stateLabel: 'State',
      stateRequired: true,
      postcodeLabel: 'ZIP Code',
      postcodeRegex: '',
      postcodeExample: '10001',
      stateExample: 'NY',
    };
    if (route.request().url().includes('/states')) {
      return route.fulfill({
        json: {
          countryConfig: config,
          states: [{ code: 'NY', name: 'New York' }],
        },
      });
    }
    return route.fulfill({
      json: {
        detectedCountryCode: 'US',
        detectedCountryConfig: config,
        detectedStates: [{ code: 'NY', name: 'New York' }],
        countries: [{ code: 'US', name: 'United States' }],
      },
    });
  });
});

test('an iDEAL order goes out as iDEAL and sends the shopper to the payment page', async ({
  page,
}) => {
  const posted = await stubOrderCreate(page, AWAITING_PAYMENT);

  await bootSdk(page, CHECKOUT);
  await page.evaluate(() => (window as any).next.addItem({ packageId: 1 }));
  await submitWith(page, 'ideal');

  await page.waitForURL(`**${GATEWAY}`);
  await expect(page.locator('#gateway')).toBeVisible();

  expect(posted).toHaveLength(1);
  expect(posted[0]?.postDataJSON().payment_detail).toEqual({
    payment_method: 'ideal',
  });
});

test('a SEPA radio is posted under the name the orders API uses', async ({
  page,
}) => {
  // The platform's payment-methods guide calls SEPA `sepa_direct`; the orders
  // API field lists `sepa_debit`. A template may carry either, and only one of
  // them is valid on an order.
  const posted = await stubOrderCreate(page, AWAITING_PAYMENT);

  await bootSdk(page, CHECKOUT);
  await page.evaluate(() => (window as any).next.addItem({ packageId: 1 }));
  await submitWith(page, 'sepa_direct');

  await page.waitForURL(`**${GATEWAY}`);

  expect(posted[0]?.postDataJSON().payment_detail.payment_method).toBe(
    'sepa_debit'
  );
});

test('a method this build has no name for still reaches the API and redirects', async ({
  page,
}) => {
  // The store can be given a new way to pay before the SDK learns its name. As
  // long as the API creates the order, the shopper must still be sent to pay —
  // the SDK is not the authority on what can be charged.
  const posted = await stubOrderCreate(page, AWAITING_PAYMENT);

  await bootSdk(page, CHECKOUT);
  await page.evaluate(() => (window as any).next.addItem({ packageId: 1 }));
  await submitWith(page, 'pix');

  await page.waitForURL(`**${GATEWAY}`);

  expect(posted[0]?.postDataJSON().payment_detail).toEqual({
    payment_method: 'pix',
  });
});

/** Every `dl_add_payment_info` currently on the page's canonical data layer. */
const paymentInfoEvents = (page: Page) =>
  page.evaluate(() =>
    ((window as any).NextDataLayer ?? []).filter(
      (e: any) => e.event === 'dl_add_payment_info'
    )
  );

test('reports add_payment_info once, named for the method', async ({
  page,
}) => {
  // A redirect method enters no payment details on this page, so submitting is
  // the moment it can be reported — and the card and express paths, which report
  // their own, are both out of this journey.
  //
  // The order is refused so the page stays put and the data layer survives long
  // enough to read. The event goes out before the order call, so a refusal does
  // not change whether it fired — only whether a second attempt repeats it.
  await page.route('**/api/v1/orders/**', route =>
    route.fulfill({ status: 400, json: { message: 'Refused by the test' } })
  );

  await bootSdk(page, CHECKOUT);
  await page.evaluate(() => (window as any).next.addItem({ packageId: 1 }));
  await submitWith(page, 'ideal');

  await expect.poll(() => paymentInfoEvents(page)).toHaveLength(1);
  const [event] = await paymentInfoEvents(page);
  expect(event.ecommerce.payment_type).toBe('iDEAL');

  // The negative control: a second attempt after a refusal is the same funnel
  // step, not another one.
  await page.click('[data-next-checkout-submit]');
  await page.waitForTimeout(1000);
  expect(await paymentInfoEvents(page)).toHaveLength(1);
});

test('an order that came back paid goes to the thank-you page, not to a gateway', async ({
  page,
}) => {
  // The negative control. Both journeys start with the same radio and the same
  // form, so if this one also landed on the gateway the assertion above would be
  // proving nothing about `payment_complete_url`.
  await stubOrderCreate(page, PAID);

  await bootSdk(page, CHECKOUT);
  await page.evaluate(() => (window as any).next.addItem({ packageId: 1 }));
  await submitWith(page, 'ideal');

  await page.waitForURL(url => url.searchParams.get('ref_id') === PAID.ref_id, {
    timeout: 10_000,
  });
  expect(page.url()).not.toContain('express-gateway');
});
