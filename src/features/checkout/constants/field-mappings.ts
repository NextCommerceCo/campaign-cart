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
 * translations between them live here so a method can be added in one place.
 *
 * **Neither translation substitutes anything.** A name that is not in the table
 * comes out unchanged and is sent to the API as the page wrote it, because the
 * API is the authority on what it can charge and this SDK release may simply be
 * older than the method. Substituting a card is what issue #74 was: an iDEAL
 * radio was read as a card, so the order went out as a card, was refused for
 * having no card token, and the shopper was never sent to iDEAL to pay.
 */

import type { Payment, PaymentMethod } from '@/types/api';
import type { CheckoutPaymentMethod } from '@/types/global';

/**
 * The page's word for a payment method → the checkout store's.
 *
 * Keys are written with underscores, and a value is normalised (lower case, `_`
 * for `-`) before it is looked up — so `apple_pay`, `apple-pay` and `APPLE_PAY`
 * are one key. Underscore is the spelling the docs give, because it is the one
 * the store and the API use too; a template carrying the kebab form keeps
 * working rather than falling back to the card form.
 *
 * A card answers to two names and no more: `credit`, which is what shipped
 * templates carry, and `card_token`, the orders API's own name, for a caller that
 * has the API value in hand. `card` and `credit-card` are not among them.
 *
 * SEPA Direct Debit answers to exactly one, `sepa_debit`, which is the name the
 * orders API field takes. The platform's payment-methods guide calls the same
 * method `sepa_direct`; that name is deliberately absent, so a page carrying it
 * is warned about and refused by the API rather than quietly working under a
 * second identifier. No shipped page could pay by SEPA before this, so there was
 * nothing to keep compatible (issue #74 asked for the one name).
 */
const RADIO_PAYMENT_METHOD_MAP: Record<string, CheckoutPaymentMethod> = {
  credit: 'credit-card',
  card_token: 'credit-card',
  paypal: 'paypal',
  apple_pay: 'apple_pay',
  google_pay: 'google_pay',
  klarna: 'klarna',
  affirm: 'affirm',
  bancontact: 'bancontact',
  giropay: 'giropay',
  ideal: 'ideal',
  link: 'link',
  sepa_debit: 'sepa_debit',
  sofort: 'sofort',
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
 * toCheckoutPaymentMethod('apple_pay');  // 'apple_pay'
 * toCheckoutPaymentMethod('apple-pay');  // 'apple_pay' — same key
 * toCheckoutPaymentMethod('credit');     // 'credit-card'
 * toCheckoutPaymentMethod('Pix');        // 'pix' — unknown here, the API decides
 * toCheckoutPaymentMethod('');           // undefined
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
 * The names a **card** is held under in the checkout store: its own word, and the
 * API's word for a caller that wrote that one in. Not the same list as the card's
 * radio names — `credit` is a page word and never reaches the store.
 */
const STORED_CARD_METHODS = new Set(['credit-card', 'card_token']);

/**
 * Whether a `[data-next-payment-method]` value names the method the checkout store
 * is currently holding.
 *
 * The two arguments come from **different vocabularies** — the page's word and the
 * store's — so only the page's is translated. Putting the store's word through
 * {@link toCheckoutPaymentMethod} as well looks equivalent and is not: that table
 * is keyed by page words, and `credit-card` is deliberately not one of them, so the
 * store's own word for a card came back as `credit_card` and matched nothing. That
 * is what stopped the card being selected by default in 0.4.35 — the shopper opened
 * a checkout with no method chosen and the card fields collapsed, and a radio the
 * markup shipped `checked` was actively unchecked.
 *
 * A card is the one method with two stored spellings, which is why it is folded
 * here rather than compared directly.
 *
 * @example
 * ```ts
 * namesStoredPaymentMethod('credit', 'credit-card'); // true
 * namesStoredPaymentMethod('credit', 'card_token');  // true — same method
 * namesStoredPaymentMethod('ideal', 'credit-card');  // false
 * namesStoredPaymentMethod('pix', 'pix');            // true — unknown, still matched
 * namesStoredPaymentMethod('', 'credit-card');       // false — names nothing
 * ```
 */
export function namesStoredPaymentMethod(
  markupValue: string | null | undefined,
  storedMethod: string
): boolean {
  const offered = toCheckoutPaymentMethod(markupValue);
  if (!offered) return false;

  return STORED_CARD_METHODS.has(offered)
    ? STORED_CARD_METHODS.has(storedMethod)
    : offered === storedMethod;
}

/** Whether {@link toCheckoutPaymentMethod} recognised this method by name. */
export function isKnownPaymentMethod(method: string): boolean {
  return method in API_PAYMENT_METHOD_MAP;
}

/**
 * The checkout store's payment method -> the `payment_detail.payment_method` the
 * orders API is sent. The one translation for every order path.
 *
 * A method that is not in {@link API_PAYMENT_METHOD_MAP} is sent as it stands.
 * The API answers that with either an order — carrying a `payment_complete_url`
 * for the shopper to finish paying at — or a 400 naming the method, and both of
 * those are more useful than the SDK quietly charging a card instead.
 *
 * @example
 * ```ts
 * toApiPaymentMethod('credit-card'); // 'card_token'
 * toApiPaymentMethod('ideal');       // 'ideal'
 * toApiPaymentMethod('pix');         // 'pix'
 * ```
 */
export function toApiPaymentMethod(method: string): Payment['payment_method'] {
  return API_PAYMENT_METHOD_MAP[method] ?? method;
}

/**
 * Selected payment method -> the `payment_detail.payment_method` the orders API
 * expects. Not exported: {@link toApiPaymentMethod} owns what happens to a
 * method that is not listed, and reading the table directly is how a second
 * fallback rule gets invented.
 *
 * Only the card entry translates — every other method is already spelled the way
 * the API wants it.
 */
const API_PAYMENT_METHOD_MAP: Record<string, PaymentMethod> = {
  'credit-card': 'card_token',
  card_token: 'card_token',
  paypal: 'paypal',
  apple_pay: 'apple_pay',
  google_pay: 'google_pay',
  klarna: 'klarna',
  affirm: 'affirm',
  bancontact: 'bancontact',
  giropay: 'giropay',
  ideal: 'ideal',
  link: 'link',
  sepa_debit: 'sepa_debit',
  sofort: 'sofort',
  swish: 'swish',
  twint: 'twint',
};

/**
 * The methods `ExpressCheckoutProcessor` can drive from a button of its own.
 *
 * Keyed by the checkout store's names, which is what it is handed. It used to be
 * keyed `apple-pay`/`google-pay`, spellings that never arrive, so both resolved
 * through the `|| method` fallback rather than through the table.
 *
 * Link is here **and** offerable as a radio: it is the one method the platform
 * gives both ways. The two paths are separate — a button runs express checkout
 * with no form, a radio goes through the form and its validation first — so
 * adding it here does not make a Link *radio* skip the form.
 */
export const EXPRESS_PAYMENT_METHOD_MAP: Record<
  string,
  'paypal' | 'apple_pay' | 'google_pay' | 'link'
> = {
  paypal: 'paypal',
  apple_pay: 'apple_pay',
  google_pay: 'google_pay',
  link: 'link',
};
