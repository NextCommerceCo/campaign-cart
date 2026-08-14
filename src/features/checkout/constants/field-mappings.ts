/**
 * Field mapping constants for checkout form.
 *
 * Four more maps once lived here — `COMMON_FIELD_PATTERNS`, `FIELD_NAME_MAP`,
 * `BILLING_FIELD_MAPPING` and `PAYMENT_METHOD_MAP` — none with an importer.
 * `validation/field-labels.ts` owns the field-label wording, so keeping the
 * copies here only invited them to drift (finding 158's shape). Removed; this
 * file's history has them.
 *
 * A payment method is spelled two ways — the page's word on the radio, and the
 * orders API's word, which the store and the order request both use as well.
 * {@link toCheckoutPaymentMethod} is the single hop between them.
 *
 * **It substitutes nothing.** A name that is not in the table comes out
 * unchanged and is sent to the API as the page wrote it, because the API is the
 * authority on what it can charge and this SDK release may simply be older than
 * the method. Substituting a card is what issue #74 was: an iDEAL radio was read
 * as a card, so the order went out as a card, was refused for having no card
 * token, and the shopper was never sent to iDEAL to pay.
 */

import type { PaymentMethod } from '@/types/api';
import type { CheckoutPaymentMethod } from '@/types/global';

/**
 * The page's word for a payment method → the one name the rest of the SDK uses.
 *
 * This is the **only** translation left. Past it, the store, the order request
 * and the API all say `card_token`, so the four card spellings a page may carry
 * (`card`, `credit`, `credit-card`, `card_token`) converge here and nothing
 * downstream has a second word for a card.
 *
 * Keys are normalised (lower case, `_` for `-`) so `apple-pay` and `apple_pay`
 * are the same key — a template that picks the other spelling still selects the
 * method the shopper pressed. `sepa` and `sepa_debit` are accepted alongside
 * `sepa_direct`, which is the one name the orders API takes; `sepa_debit` is
 * what this SDK's own type called it until 2026-08-14.
 */
const RADIO_PAYMENT_METHOD_MAP: Record<string, CheckoutPaymentMethod> = {
  card: 'card_token',
  card_token: 'card_token',
  credit: 'card_token',
  credit_card: 'card_token',
  paypal: 'paypal',
  apple_pay: 'apple_pay',
  google_pay: 'google_pay',
  klarna: 'klarna',
  affirm: 'affirm',
  bancontact: 'bancontact',
  ideal: 'ideal',
  link: 'link',
  sepa: 'sepa_direct',
  sepa_debit: 'sepa_direct',
  sepa_direct: 'sepa_direct',
  swish: 'swish',
  twint: 'twint',
};

/**
 * Reads a `[data-next-payment-method]` value or a radio's `value` as a payment
 * method.
 *
 * A name the SDK knows comes back in the store's spelling. Any other name comes
 * back **normalised but otherwise untouched**, so the page can offer a method
 * this release predates and still have it reach the API. `undefined` means the
 * page named nothing at all — an empty or missing value.
 *
 * @example
 * ```ts
 * toCheckoutPaymentMethod('apple-pay'); // 'apple_pay'
 * toCheckoutPaymentMethod('credit');    // 'card_token'
 * toCheckoutPaymentMethod('Pix');       // 'pix' — unknown here, the API decides
 * toCheckoutPaymentMethod('');          // undefined
 * ```
 */
export function toCheckoutPaymentMethod(
  value: string | null | undefined
): CheckoutPaymentMethod | undefined {
  const normalized = value?.trim().toLowerCase().replace(/-/g, '_');
  if (!normalized) return undefined;
  return RADIO_PAYMENT_METHOD_MAP[normalized] ?? normalized;
}

/**
 * Every method this SDK release knows how to name.
 *
 * There is no map from these to what the API is sent, because there is nothing
 * to map: a chosen method **is** the value that goes on the order. The set only
 * answers "have I heard of this one", which decides whether to warn.
 */
const KNOWN_PAYMENT_METHODS: ReadonlySet<string> = new Set<PaymentMethod>([
  'card_token',
  'paypal',
  'apple_pay',
  'google_pay',
  'klarna',
  'affirm',
  'bancontact',
  'ideal',
  'link',
  'sepa_direct',
  'swish',
  'twint',
]);

/**
 * Whether the orders API is known to take this method.
 *
 * `false` is not a refusal — an unknown method is still sent, because the API
 * may have gained it since this SDK release. It is what turns the console
 * warning on, so a typo is visible before a shopper meets a refused order.
 *
 * @example
 * ```ts
 * isKnownPaymentMethod('ideal'); // true
 * isKnownPaymentMethod('pix');   // false — sent anyway
 * ```
 */
export function isKnownPaymentMethod(
  method: CheckoutPaymentMethod
): method is PaymentMethod {
  return KNOWN_PAYMENT_METHODS.has(method);
}

export const EXPRESS_PAYMENT_METHOD_MAP: Record<
  string,
  'paypal' | 'apple_pay' | 'google_pay'
> = {
  paypal: 'paypal',
  'apple-pay': 'apple_pay',
  'google-pay': 'google_pay',
};
