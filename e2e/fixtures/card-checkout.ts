/**
 * Everything a spec needs to drive a **card** checkout to the point of submit.
 *
 * Two specs do it — `card-purchase.spec.ts` (what the purchase event reports) and
 * `checkout-overlay.spec.ts` (what the shopper can see and click while the order
 * is in flight) — and they have to fill the same form, in the same way, against
 * the same stand-in tokenizer. Extracted from the first when the second appeared.
 *
 * Only the network and the off-site tokenizer are faked; the SDK is the real one
 * Vite serves.
 */

import { expect, type Page } from '@playwright/test';
import { MINIMAL_CAMPAIGN } from './campaign';
import {
  stubCampaign,
  stubCart,
  stubCountryService,
  stubProspectCart,
} from './routes';

/** The checkout fixture both specs boot. */
export const CARD_CHECKOUT = '/e2e/fixtures/card-purchase.html';

/**
 * A stand-in for the Spreedly tokenizer, installed before `/src/index.ts` runs.
 *
 * A Proxy answers every method the SDK calls — there are fourteen today — so a
 * new one added later is a no-op rather than a `TypeError` that reads like an SDK
 * defect. Only the three that carry the flow are real: `on` records handlers,
 * `init` announces readiness, and `tokenizeCreditCard` hands back a token.
 *
 * `CreditCardService.loadSpreedlyScript` skips fetching the real script when
 * `window.Spreedly` already exists, so the off-site iframe never loads.
 */
export async function stubSpreedly(page: Page): Promise<void> {
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

/**
 * Campaign, cart, tokenizer, country lists and prospect carts — everything
 * except the orders endpoint, which each spec answers its own way.
 *
 * A non-empty `payment_env_key` is what makes the SDK build its
 * `CreditCardService` at all; `MINIMAL_CAMPAIGN` ships an empty one, and without
 * it the form refuses to submit with "the payment system is not ready".
 */
export async function stubCardCheckout(page: Page): Promise<void> {
  await stubCampaign(page, {
    ...MINIMAL_CAMPAIGN,
    payment_env_key: 'e2e-env-key',
  });
  await stubCart(page);
  await stubSpreedly(page);
  await stubCountryService(page);
  // Filling an email and a phone is what a shopper does, and it makes the SDK
  // create a prospect cart. Unstubbed, those calls go to the live API — which
  // `.claude/rules/e2e.md` §4 forbids and which WebKit reports as console
  // errors while Chromium stays silent.
  await stubProspectCart(page);
  // The prospect cart is created through the ordinary cart endpoint, which the
  // `/carts/calculate/` glob does not match. Registered after `stubCart` for
  // that reason.
  await page.route('**/api/v1/carts/', route =>
    route.fulfill({
      json: { checkout_url: 'https://example.test/checkout/prospect-1' },
    })
  );
}

/**
 * Fills every field the form requires, then submits.
 *
 * `phone` defaults to a number libphonenumber accepts — the form runs
 * intl-tel-input, and a 555-01xx placeholder is rejected as invalid. It is a
 * parameter so `phone-validation.spec.ts` can drive the same form with a number
 * that must be refused, without restating the other ten fields.
 */
export async function submitCard(
  page: Page,
  phone: string = '4155552671'
): Promise<void> {
  await page.fill('[data-next-checkout-field="email"]', 'ada@example.test');
  await page.fill('[data-next-checkout-field="fname"]', 'Ada');
  await page.fill('[data-next-checkout-field="lname"]', 'Lovelace');
  await page.fill('[data-next-checkout-field="address1"]', '1 Test Street');
  await page.fill('[data-next-checkout-field="city"]', 'New York');
  await page.fill('[data-next-checkout-field="postal"]', '10001');
  await page.fill('[data-next-checkout-field="phone"]', phone);
  // Blur, because the inline verdict is committed on leaving the field.
  await page.locator('[data-next-checkout-field="phone"]').blur();
  await page.selectOption('[data-next-checkout-field="country"]', 'US');
  await page.selectOption('[data-next-checkout-field="province"]', 'NY');
  await page.selectOption('[data-next-checkout-field="cc-month"]', '12');
  await page.selectOption('[data-next-checkout-field="cc-year"]', '2030');
  await page.click('[data-next-checkout-submit]');
}

/**
 * Puts one package in the cart, which is what makes the form submittable.
 *
 * `getCartCount` rather than `getCartData().cartLines`: the count comes straight from
 * the store, while a line's prices are the campaign's until the calculate API answers.
 */
export async function addOnePackage(page: Page): Promise<void> {
  await page.evaluate(() => (window as any).next.addItem({ packageId: 1 }));
  await expect
    .poll(() => page.evaluate(() => (window as any).next.getCartCount()))
    .toBeGreaterThan(0);
}
