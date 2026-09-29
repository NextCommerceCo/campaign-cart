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
  type AddressServiceOptions,
} from './routes';

/** The checkout fixture both specs boot. */
export const CARD_CHECKOUT = '/e2e/fixtures/card-purchase.html';

/** What the NextPayment stand-in does when the form tokenizes a card. */
export type NextPaymentOutcome = 'tokenize' | 'reject-number';

export interface NextPaymentOptions {
  outcome?: NextPaymentOutcome;
  /**
   * Whether the number the shopper types passes the fields' own check. `false` is a
   * number the form stops before tokenizing; `outcome: 'reject-number'` is one the
   * fields accepted and NextPayment then refused on submit.
   */
  numberValid?: boolean;
  /**
   * Keep the fields from reporting ready until the spec calls
   * `window.__releaseNextPayment()`, for a spec that has to listen before they are.
   */
  holdReady?: boolean;
}

/**
 * A stand-in for NextPayment, installed before `/src/index.ts` runs: it is an off-site
 * iframe that cannot run headless.
 *
 * It answers the way the real script does, which is the part worth testing: the token
 * a card order needs is `tokenResponse.payment_method.token`, and the response also
 * carries a transaction `token` that must not be used; a rejected number arrives as
 * `onValidation` errors and then an `onError` string repeating them; and each field's
 * length and validity arrive on `onFieldStateChange`, the way the live demo showed.
 *
 * The SDK loads `payment.js` itself, and the route for `payments.29next.com` answers
 * with a script that defines the stand-in, so the live host is never reached and every
 * load is counted in `scriptRequests`. Every `submit()` is handed back in `submits`,
 * which outlives the redirect an order causes.
 */
export interface NextPaymentStub {
  /** Every request for `payment.js`: one per load, and one more per refresh. */
  scriptRequests: string[];
  /** The cardholder data of every `submit()`. */
  submits: unknown[];
  /** The second argument of every `submit()`: the metadata stored with the token. */
  submitParams: unknown[];
}

export async function stubNextPayment(
  page: Page,
  {
    outcome = 'tokenize',
    holdReady = false,
    numberValid = true,
  }: NextPaymentOptions = {}
): Promise<NextPaymentStub> {
  const scriptRequests: string[] = [];
  const submits: unknown[] = [];
  const submitParams: unknown[] = [];
  await page.exposeFunction(
    '__recordNextPaymentSubmit',
    (data: unknown, params: unknown) => {
      submits.push(data);
      submitParams.push(params);
    }
  );
  // The SDK loads `payment.js` for real, from this route, so the stand-in class is
  // defined by the script the way the live one is, and a refresh gets it again.
  await page.route('https://payments.29next.com/**', route => {
    scriptRequests.push(route.request().url());
    return route.fulfill({
      contentType: 'application/javascript',
      body: 'window.NextPayment = window.__NextPaymentStub;',
    });
  });

  await page.addInitScript(
    ({ outcome, holdReady, numberValid }) => {
      (window as any).__NextPaymentStub = class {
        onReady = (): void => {};
        onValidation = (_: unknown): void => {};
        onError = (_: unknown): void => {};
        onTokenized = (_: unknown): void => {};
        onFieldStateChange = (_: unknown): void => {};

        constructor() {
          const ready = (): void => {
            this.onReady();
            // Then the shopper types a card: the fields are iframes, so a `fill()`
            // cannot reach them. The payload is the shape the live script sends.
            for (const field of ['number', 'cvv']) {
              this.onFieldStateChange({
                cardType: 'visa',
                numberLength: 16,
                validNumber: numberValid,
                luhnValid: numberValid,
                cvvLength: 3,
                validCvv: true,
                action: 'input',
                field,
                focused: true,
                hovered: false,
              });
            }
          };
          if (holdReady) (window as any).__releaseNextPayment = ready;
          else setTimeout(ready, 0);
        }

        setFocus(): void {}
        destroy(): void {}

        submit(formData: unknown, params: unknown): void {
          (window as any).__recordNextPaymentSubmit(formData, params);
          setTimeout(() => {
            if (outcome === 'reject-number') {
              this.onValidation({
                errors: [
                  {
                    attribute: 'number',
                    key: 'errors.invalid',
                    message: 'Card number is invalid',
                  },
                ],
              });
              this.onError('Invalid card number');
              return;
            }
            this.onTokenized({
              message: 'Token generated',
              tokenResponse: {
                token: 'e2e-transaction-token',
                payment_method: {
                  token: 'e2e-payment-method-token',
                  last_four_digits: '1111',
                  card_type: 'visa',
                },
              },
            });
          }, 0);
        }
      };
    },
    { outcome, holdReady, numberValid }
  );

  return { scriptRequests, submits, submitParams };
}

/**
 * Campaign, cart, tokenizer, country lists and prospect carts — everything
 * except the orders endpoint, which each spec answers its own way. `card` is how the
 * tokenizer behaves.
 *
 * A non-empty `payment_env_key` is what makes the SDK build its
 * `CreditCardService` at all; `MINIMAL_CAMPAIGN` ships an empty one, and without
 * it the form refuses to submit with "the payment system is not ready".
 *
 * `address` goes to {@link stubCountryService}: the visitor's country, and whether
 * the service sends phone rules.
 */
export async function stubCardCheckout(
  page: Page,
  address: AddressServiceOptions = {},
  card: NextPaymentOptions = {}
): Promise<NextPaymentStub> {
  await stubCampaign(page, {
    ...MINIMAL_CAMPAIGN,
    payment_env_key: 'e2e-env-key',
    // The API sends the campaign's id; `Campaign` does not type it.
    ...{ id: 7 },
  });
  await stubCart(page);
  const nextPayment = await stubNextPayment(page, card);
  await stubCountryService(page, address);
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
  return nextPayment;
}

/**
 * Adds `config` to the `window.nextConfig` the fixture sets. The fixture assigns it in
 * an inline script, after any init script, which would replace an object set here; the
 * setter merges each assignment into the last instead.
 */
export async function addNextConfig(
  page: Page,
  config: Record<string, unknown>
): Promise<void> {
  await page.addInitScript(config => {
    let merged: Record<string, unknown> = { ...config };
    Object.defineProperty(window, 'nextConfig', {
      configurable: true,
      get: () => merged,
      set: (value: Record<string, unknown>) => {
        merged = { ...merged, ...value };
      },
    });
  }, config);
}

/**
 * Fills every field the form requires, then submits.
 *
 * `phone` defaults to a number valid under the US phone rules the address-rules
 * stub serves, which the form validates against. It and `address` are parameters so
 * `phone-validation.spec.ts` can drive the same form with a number that must be
 * refused, or in another country, without restating the other ten fields.
 * `address` names a country and state the address-rules stub lists.
 */
export async function submitCard(
  page: Page,
  phone: string = '4155552671',
  {
    country = 'US',
    province = 'NY',
  }: { country?: string; province?: string } = {}
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
  await page.selectOption('[data-next-checkout-field="country"]', country);
  await page.selectOption('[data-next-checkout-field="province"]', province);
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
