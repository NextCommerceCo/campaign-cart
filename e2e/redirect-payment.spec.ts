import {
  test,
  expect,
  type Locator,
  type Page,
  type Request,
} from '@playwright/test';
import type { Order } from '../src/types/api';
import { MINIMAL_CAMPAIGN } from './fixtures/campaign';
import { TEST_ORDER } from './fixtures/order';
import {
  stubCampaign,
  stubCart,
  stubCountryService,
  bootSdk,
} from './fixtures/routes';

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

/**
 * Whether a shopper could actually read this element: it has a rendered box, and
 * the point at its centre really paints it rather than something clipping or
 * covering it.
 *
 * Polled rather than measured once, because the loading overlay covers the whole
 * page until the failed submit tears it down, and a single measurement taken in
 * that window says "unreadable" about markup that is fine.
 */
async function expectReadable(locator: Locator): Promise<void> {
  await expect
    .poll(() =>
      locator.evaluate(el => {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return false;
        const hit = document.elementFromPoint(
          r.left + r.width / 2,
          r.top + r.height / 2
        );
        return Boolean(hit && (el === hit || el.contains(hit)));
      })
    )
    .toBe(true);
}

test.beforeEach(async ({ page }) => {
  await stubCampaign(page, MINIMAL_CAMPAIGN);
  await stubCart(page);
  await stubCountryService(page);
});

/**
 * The card is what the checkout store starts on, so a shopper who has just
 * arrived must find it already chosen and its fields already open.
 *
 * This stopped happening in 0.4.35. The startup pass compared the markup's word
 * for a method with the store's by putting **both** through the radio table, and
 * the store's own word for a card, `credit-card`, is deliberately not a radio
 * name — so it came back as `credit_card` and matched nothing. Every radio was
 * unchecked, including the one this fixture ships `checked`, and the card form
 * stayed collapsed until the shopper clicked it.
 *
 * Why this cannot be a unit test alone: the symptom is a radio the browser had
 * already checked from markup being unchecked by the SDK afterwards. That is the
 * page's real initial state, not a constructed one.
 */
test('the card is chosen and open before the shopper touches anything', async ({
  page,
}) => {
  await bootSdk(page, CHECKOUT);

  const cardForm = page.locator(
    '[data-next-payment-method="credit"] [data-next-payment-form]'
  );
  await expect(page.locator('#pm-credit')).toBeChecked();
  await expect(cardForm).toHaveAttribute('data-next-payment-state', 'expanded');
  await expect(page.locator('[data-next-payment-method="credit"]')).toHaveClass(
    /next-selected/
  );

  // The negative control: choosing the card is not the same as choosing
  // everything, so the methods beside it must be shut.
  const idealForm = page.locator(
    '[data-next-payment-method="ideal"] [data-next-payment-form]'
  );
  await expect(page.locator('#pm-ideal')).not.toBeChecked();
  await expect(idealForm).toHaveAttribute(
    'data-next-payment-state',
    'collapsed'
  );
});

/**
 * A refusal has to be readable, and for every method — not only the two the SDK
 * used to name.
 *
 * The message was always written. It went into `credit-error`, which the starter
 * templates put inside the card's own `data-next-payment-form`, and that form is
 * collapsed to `height: 0; overflow: hidden` whenever a card is not the chosen
 * method. Measured in Chromium before the fix: text present, `display: flex`,
 * 18px tall, clipped out of existence by a parent of height 0. The shopper saw an
 * idle page and no reason for it.
 *
 * Why this cannot be a unit test: the defect is a rendered box of zero height
 * clipping its own content. happy-dom does no layout, so every measurement it
 * offers here is zero whether the bug is present or not.
 */
test('a refused iDEAL order is readable, in iDEAL’s own container', async ({
  page,
}) => {
  await page.route('**/api/v1/orders/**', route =>
    route.fulfill({
      status: 400,
      json: { payment_details: 'Your iDEAL payment was refused.' },
    })
  );

  await bootSdk(page, CHECKOUT);
  await page.evaluate(() => (window as any).next.addItem({ packageId: 1 }));
  await submitWith(page, 'ideal');

  const error = page.locator('[data-next-component="ideal-error"]');
  await expect(error).toContainText('Your iDEAL payment was refused.');

  // Readable, not merely present: the box has height, and the point at its
  // centre really paints it rather than whatever was clipping it.
  await expectReadable(error);

  // The negative control: the card's container is not where this went, and it
  // stays empty rather than quietly collecting every method's failures.
  await expect(
    page.locator('[data-next-component="credit-error-text"]')
  ).toHaveText('');
});

/**
 * The shipped-page case: a checkout whose only error slot is the card's. Nobody
 * has to add `<method>-error` for a decline to become readable again.
 */
test('a refusal is readable even when the card owns the only container', async ({
  page,
}) => {
  await page.route('**/api/v1/orders/**', route =>
    route.fulfill({
      status: 400,
      json: { payment_details: 'That account was refused.' },
    })
  );

  await bootSdk(page, CHECKOUT);
  // Take iDEAL's own slot away, leaving the markup every live page has today.
  await page.evaluate(() =>
    document.querySelector('[data-next-component="ideal-error"]')?.remove()
  );
  await page.evaluate(() => (window as any).next.addItem({ packageId: 1 }));
  await submitWith(page, 'ideal');

  const error = page.locator('[data-next-component="credit-error"]');
  await expect(error).toContainText('That account was refused.');

  await expectReadable(error);
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

test('SEPA answers to one name, not to the guide\u2019s other one', async ({
  page,
}) => {
  // The platform's payment-methods guide calls this method `sepa_direct` and the
  // orders API field calls it `sepa_debit`. Only `sepa_debit` is accepted, so the
  // other name must **not** be translated into it: it goes out as written and the
  // API refuses it. Asserting the accepted name alone would prove nothing, since
  // an unrecognised name reaches the API under its own spelling anyway.
  const posted = await stubOrderCreate(page, AWAITING_PAYMENT);

  await bootSdk(page, CHECKOUT);
  await page.evaluate(() => (window as any).next.addItem({ packageId: 1 }));
  await submitWith(page, 'sepa_debit');
  await page.waitForURL(`**${GATEWAY}`);
  expect(posted[0]?.postDataJSON().payment_detail.payment_method).toBe(
    'sepa_debit'
  );

  await bootSdk(page, CHECKOUT);
  await page.evaluate(() => (window as any).next.addItem({ packageId: 1 }));
  await submitWith(page, 'sepa_direct');
  await page.waitForURL(`**${GATEWAY}`);
  expect(posted[1]?.postDataJSON().payment_detail.payment_method).toBe(
    'sepa_direct'
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

test('hides the methods the campaign cannot charge', async ({ page }) => {
  // What a real campaign answers with: the card (as `bankcard`), Apple Pay,
  // iDEAL and PayPal. Every other radio on the page is a dead end, because an
  // order naming it would be refused.
  await stubCampaign(page, {
    ...MINIMAL_CAMPAIGN,
    available_payment_methods: [
      { code: 'apple_pay', label: 'Apple Pay' },
      { code: 'bankcard', label: 'Bankcard' },
      { code: 'ideal', label: 'iDEAL' },
      { code: 'paypal', label: 'PayPal' },
    ],
  });

  await bootSdk(page, CHECKOUT);

  const wrapper = (method: string) =>
    page.locator(`[data-next-payment-method="${method}"]`);

  // Offered by this campaign, so still on the page.
  await expect(wrapper('credit')).toBeVisible();
  await expect(wrapper('ideal')).toBeVisible();

  // Not offered, so gone. `toBeHidden` is the assertion that matters: the
  // wrapper is still in the DOM, and what must be true is that nobody can see
  // or press it.
  await expect(wrapper('sepa_debit')).toBeHidden();
  await expect(wrapper('pix')).toBeHidden();
});

test('leaves every method visible when the campaign lists none', async ({
  page,
}) => {
  // The negative control for the test above, and the safe default: MINIMAL_CAMPAIGN
  // carries no `available_payment_methods`, and not knowing what a campaign
  // supports must not empty the page of ways to pay.
  await bootSdk(page, CHECKOUT);

  await expect(
    page.locator('[data-next-payment-method="sepa_debit"]')
  ).toBeVisible();
  await expect(page.locator('[data-next-payment-method="pix"]')).toBeVisible();
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
