/**
 * Field mapping constants for checkout form.
 *
 * Four more maps once lived here — `COMMON_FIELD_PATTERNS`, `FIELD_NAME_MAP`,
 * `BILLING_FIELD_MAPPING` and `PAYMENT_METHOD_MAP` — none with an importer.
 * `validation/field-labels.ts` owns the field-label wording, so keeping the
 * copies here only invited them to drift (finding 158's shape). Removed; this
 * file's history has them.
 *
 * A payment method is spelled three ways — the page's word on the radio, the
 * SDK's word in the checkout store, the API's word on the order — and the two
 * translations between them live here so a method can be added in one place. A
 * method missing from either map is the shape of issue #74: an iDEAL radio was
 * read as a card, so the order went out as a card and the shopper was never sent
 * to iDEAL to pay.
 */

import type { PaymentMethod } from '@/types/api';
import type { CheckoutPaymentMethod } from '@/types/global';

/**
 * The page's word for a payment method → the checkout store's.
 *
 * Keys are normalised (lower case, `_` for `-`) so `apple-pay` and `apple_pay`
 * are the same key — a template that picks the other spelling still selects the
 * method the shopper pressed instead of silently falling back to the card form.
 * `sepa` and `sepa_debit` are accepted alongside `sepa_direct`, which is the one
 * name the orders API takes; `sepa_debit` is what this SDK's own type called it
 * until 2026-08-14.
 */
const RADIO_PAYMENT_METHOD_MAP: Record<string, CheckoutPaymentMethod> = {
  card: 'credit-card',
  card_token: 'credit-card',
  credit: 'credit-card',
  credit_card: 'credit-card',
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
 * method, or `undefined` when the page names one the SDK does not offer.
 *
 * Undefined rather than a default, because the two callers want different things
 * from an unknown value: the radio handler falls back to the card form so the
 * shopper is not left with no payment fields, while the startup pass leaves the
 * method unselected rather than opening a form the store never chose.
 *
 * @example
 * ```ts
 * toCheckoutPaymentMethod('apple-pay'); // 'apple_pay'
 * toCheckoutPaymentMethod('credit');    // 'credit-card'
 * toCheckoutPaymentMethod('bitcoin');   // undefined
 * ```
 */
export function toCheckoutPaymentMethod(
  value: string | null | undefined
): CheckoutPaymentMethod | undefined {
  if (!value) return undefined;
  return RADIO_PAYMENT_METHOD_MAP[
    value.trim().toLowerCase().replace(/-/g, '_')
  ];
}

/**
 * Selected payment method -> the `payment_detail.payment_method` the orders API
 * expects. The single map for every order path; anything not listed here is
 * submitted as `card_token`.
 *
 * Only the card entry translates — every other method is already spelled the way
 * the API wants it.
 */
export const API_PAYMENT_METHOD_MAP: Record<string, PaymentMethod> = {
  'credit-card': 'card_token',
  card_token: 'card_token',
  paypal: 'paypal',
  apple_pay: 'apple_pay',
  google_pay: 'google_pay',
  klarna: 'klarna',
  affirm: 'affirm',
  bancontact: 'bancontact',
  ideal: 'ideal',
  link: 'link',
  sepa_direct: 'sepa_direct',
  swish: 'swish',
  twint: 'twint',
};

export const EXPRESS_PAYMENT_METHOD_MAP: Record<
  string,
  'paypal' | 'apple_pay' | 'google_pay'
> = {
  paypal: 'paypal',
  'apple-pay': 'apple_pay',
  'google-pay': 'google_pay',
};
