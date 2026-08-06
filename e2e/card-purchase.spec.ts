import { test, expect, type Page } from '@playwright/test';
import type { Order } from '../src/types/api';
import { MINIMAL_CAMPAIGN } from './fixtures/campaign';
import { TEST_ORDER } from './fixtures/order';
import { stubCampaign, stubCart, bootSdk } from './fixtures/routes';

/**
 * `dl_purchase` on the **card** path, which is how most shoppers pay —
 * [issue #71](https://github.com/NextCommerceCo/campaign-cart/issues/71).
 *
 * The express spec covers PayPal. This covers the two card journeys:
 *
 * - a card charged on the checkout page, which redirects straight to the
 *   thank-you page; and
 * - a card the bank sends to 3-D Secure first, which is the express-checkout
 *   shape wearing a card's clothes — the order exists before any money moves.
 *
 * Why this cannot be a unit test: the thing being proved is that the *redirect*
 * carries the order reference and that the page it lands on reports the purchase
 * exactly once. That needs a real form submit, a real navigation, and a second
 * SDK boot. happy-dom has one document and no history.
 *
 * Spreedly is stubbed rather than loaded: it is an off-site iframe tokenizer that
 * cannot run headless, and `CreditCardService.loadSpreedlyScript` skips fetching
 * the real script when `window.Spreedly` already exists. Everything after the
 * token — order creation, redirect, landing page — is the real SDK.
 */

const CHECKOUT = '/e2e/fixtures/card-purchase.html';
/** What the fixture names in its `next-failure-url` meta tag. */
const FAILED = '/e2e/fixtures/express-purchase-failed.html';

/** A card order the gateway charged outright: paid, nothing left to do. */
const PAID_ORDER: Order = { ...TEST_ORDER, number: 'E2E-CARD-1' };

/**
 * A card order the bank wants a 3-D Secure step for. `payment_complete_url` is
 * the bank's page — pointed at the local stand-in so the redirect stays in the
 * test — and its presence is what says the money has not moved.
 */
const THREE_DS_ORDER: Order = {
  ...TEST_ORDER,
  number: 'E2E-CARD-3DS',
  payment_complete_url: '/e2e/fixtures/express-gateway.html',
};

/** Every `dl_purchase` currently in the page's canonical data layer. */
const purchases = (page: Page) =>
  page.evaluate(() =>
    ((window as any).NextDataLayer ?? []).filter(
      (e: any) => e.event === 'dl_purchase'
    )
  );

/** Waits until analytics has booted AND replayed its queue. */
async function afterQueueReplay(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(() =>
        ((window as any).NextDataLayer ?? []).some(
          (e: any) => e.event === 'dl_user_data'
        )
      )
    )
    .toBe(true);
  await page.waitForTimeout(1500);
}

/**
 * A stand-in for the Spreedly tokenizer, installed before `/src/index.ts` runs.
 *
 * A Proxy answers every method the SDK calls — there are fourteen today — so a
 * new one added later is a no-op rather than a `TypeError` that reads like an SDK
 * defect. Only the three that carry the flow are real: `on` records handlers,
 * `init` announces readiness, and `tokenizeCreditCard` hands back a token.
 */
async function stubSpreedly(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const handlers: Record<string, Function[]> = {};
    const fire = (name: string, ...args: unknown[]): void => {
      setTimeout(() => (handlers[name] ?? []).forEach(cb => cb(...args)), 0);
    };
    const impl: Record<string, Function> = {
      on: (event: string, cb: Function) => {
        (handlers[event] ??= []).push(cb);
      },
      init: () => {
        fire('ready');
        // Then the shopper types a card. Without these the SDK considers the
        // number and cvv fields untouched and refuses to submit — the fields are
        // Spreedly iframes, so a `fill()` cannot reach them.
        fire('fieldEvent', 'number', 'input', null, {
          validNumber: true,
          numberLength: 16,
          cardType: 'visa',
          iin: '411111',
        });
        fire('fieldEvent', 'cvv', 'input', null, {
          validCvv: true,
          cvvLength: 3,
        });
      },
      tokenizeCreditCard: () =>
        fire('paymentMethod', 'e2e-card-token', {
          card_type: 'visa',
          last_four_digits: '1111',
        }),
    };
    (window as any).Spreedly = new Proxy(impl, {
      get: (target, key: string) => target[key] ?? (() => {}),
    });
  });
}

/** Fills every field the form requires, then submits. */
async function submitCard(page: Page): Promise<void> {
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
  await page.selectOption('[data-next-checkout-field="cc-month"]', '12');
  await page.selectOption('[data-next-checkout-field="cc-year"]', '2030');
  await page.click('[data-next-checkout-submit]');
}

test.beforeEach(async ({ page }) => {
  // A non-empty `payment_env_key` is what makes the SDK build its CreditCardService
  // at all; MINIMAL_CAMPAIGN ships an empty one, and without it the form refuses to
  // submit with "the payment system is not ready".
  await stubCampaign(page, {
    ...MINIMAL_CAMPAIGN,
    payment_env_key: 'e2e-env-key',
  });
  await stubCart(page);
  await stubSpreedly(page);
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

test('a card charged on the checkout page reports one purchase, on the thank-you page', async ({
  page,
}) => {
  await page.route('**/api/v1/orders/**', route =>
    route.fulfill({ json: PAID_ORDER })
  );

  await bootSdk(page, CHECKOUT);
  await page.evaluate(() => (window as any).next.addItem({ packageId: 1 }));
  await submitCard(page);

  // The SDK builds the success URL itself and appends the order reference. That
  // is the whole reason the landing page can report anything, so it is asserted
  // rather than assumed.
  await page.waitForURL(
    url => url.searchParams.get('ref_id') === PAID_ORDER.ref_id
  );
  await page.waitForFunction(() => Boolean((window as any).next?.on));
  await afterQueueReplay(page);

  const events = await purchases(page);
  expect(events).toHaveLength(1);
  expect(events[0].ecommerce.transaction_id).toBe('E2E-CARD-1');
  expect(events[0].ecommerce.transaction_id).not.toMatch(/^order_\d+$/);
});

test('a card sent to 3-D Secure reports nothing until the bank returns', async ({
  page,
}) => {
  // POST creates the order the bank still has to approve; the GET the landing
  // page makes answers with that same order, finished.
  await page.route('**/api/v1/orders/**', route =>
    route.fulfill({
      json: route.request().method() === 'POST' ? THREE_DS_ORDER : PAID_ORDER,
    })
  );

  await bootSdk(page, CHECKOUT);
  await page.evaluate(() => (window as any).next.addItem({ packageId: 1 }));
  await submitCard(page);

  // Off to the bank, which is off our site.
  await page.waitForURL('**/e2e/fixtures/express-gateway.html');
  await expect(page.locator('#gateway')).toBeVisible();

  // Standing at the bank, nothing about this order is parked for the next page.
  // This is the deterministic half: the shopper has not paid, and before the fix
  // the whole `dl_purchase` was waiting here for wherever they went next.
  const queued = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('next_v2_pending_events') ?? '[]')
  );
  expect(queued.filter((q: any) => q.event?.event === 'dl_purchase')).toEqual(
    []
  );

  // The bank approves and sends them to the success page, exactly as the SDK
  // asked it to.
  await page.goto(`${CHECKOUT}?ref_id=${PAID_ORDER.ref_id}`);
  await page.waitForFunction(() => Boolean((window as any).next?.on));
  await afterQueueReplay(page);

  const events = await purchases(page);
  expect(events).toHaveLength(1);
  expect(events[0].ecommerce.transaction_id).toBe('E2E-CARD-1');
});

test('a card declined at 3-D Secure reports no purchase', async ({ page }) => {
  // The negative control for the journey above, and the worst case: the GET on
  // the failure page answers with an order that looks entirely paid, so the
  // paid-or-not check cannot see anything wrong with it. What saves it is that
  // this page is the `payment_failed_url` the checkout page sent with the order.
  await page.route('**/api/v1/orders/**', route =>
    route.fulfill({
      json: route.request().method() === 'POST' ? THREE_DS_ORDER : PAID_ORDER,
    })
  );

  await bootSdk(page, CHECKOUT);
  await page.evaluate(() => (window as any).next.addItem({ packageId: 1 }));
  await submitCard(page);
  await page.waitForURL('**/e2e/fixtures/express-gateway.html');

  await page.goto(`${FAILED}?ref_id=${PAID_ORDER.ref_id}`);
  await page.waitForFunction(() => Boolean((window as any).next?.on));
  await afterQueueReplay(page);

  // The order really did load here, so "no purchase" is the gate's decision and
  // not a page that never got as far as having an order.
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          sessionStorage.getItem('next-order')?.includes('E2E-CARD-1') ?? false
      )
    )
    .toBe(true);

  expect(await purchases(page)).toEqual([]);
});
