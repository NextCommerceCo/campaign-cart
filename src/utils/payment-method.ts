/**
 * What the SDK knows about a way of paying that is not about charging it: the one
 * name to show a shopper, and whether paying that way leaves the page.
 *
 * Three places used to answer this, each with its own table: the order display
 * (18 methods), the `add_payment_info` analytics event (4), and the express
 * error message (2, as an `apple_pay ? … : 'Google Pay'` ternary that would have
 * called a Link failure a Google Pay one). They agreed on the four they
 * overlapped on, which is why nothing looked wrong — the cost was that adding a
 * method meant remembering all three, and the smallest table decided what a
 * shopper actually read.
 *
 * It lives in `utils/` rather than beside either caller because a checkout
 * feature and a display feature both need it, and neither should import from the
 * other.
 */

/**
 * The platform's own labels, keyed by the code the orders API uses.
 *
 * One entry per {@link PaymentMethod} and no others, which
 * `utils/tests/payment-method.test.ts` asserts: a method added to the API union
 * without a label here, or a label for a code the API cannot send, both fail.
 *
 * `card_token` is the one deliberate difference from the API's own wording: it
 * calls that "Card Token", which is a word about plumbing, and a shopper reading
 * their own receipt is being told how they paid.
 *
 * `iDEAL` and `PayPal` keep their house capitalisation, which is the reason this
 * is a table and not a title-case function over the code.
 */
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  card_token: 'Credit Card',
  saved_card: 'Saved Card',
  apple_pay: 'Apple Pay',
  google_pay: 'Google Pay',
  paypal: 'PayPal',
  affirm: 'Affirm',
  bancontact: 'Bancontact',
  external: 'External',
  giropay: 'Giropay',
  ideal: 'iDEAL',
  klarna: 'Klarna',
  link: 'Link',
  sepa_debit: 'SEPA Direct Debit',
  sofort: 'Sofort',
  swish: 'Swish',
  twint: 'Twint',
};

/**
 * The methods an express *button* starts, which are the ones that leave this page
 * to be paid for.
 *
 * Four places asked this question with a list of their own — the checkout store's
 * `partialize`, the bfcache restore, the window-focus reset, and the submit path
 * that routes to `ExpressCheckoutProcessor` — and all four have to agree, because
 * three of them undo what the fourth started.
 *
 * Link is deliberately **not** here, though `EXPRESS_PAYMENT_METHOD_MAP` lists it:
 * the platform offers Link both as an express button and as a radio on the form,
 * and the store holds `link` either way. Answering `true` would reset a shopper's
 * Link *radio* to a card behind their back, which is issue #74 again.
 */
const EXPRESS_PAYMENT_METHODS = ['paypal', 'apple_pay', 'google_pay'];

/**
 * Whether paying by this method sends the shopper off the checkout page.
 *
 * The question behind it is "does anything that happens in this tab still tell us
 * about this payment": for an express method the answer is no, so a return to the
 * page means the shopper came back without paying. For a card it is yes, the
 * request is in flight here, and a page event says nothing about it.
 *
 * @example
 * ```ts
 * isExpressPaymentMethod('paypal');      // true
 * isExpressPaymentMethod('credit-card'); // false
 * isExpressPaymentMethod('ideal');       // false — a redirect method, but the
 *                                        //   order is created here first
 * ```
 */
export function isExpressPaymentMethod(method: string): boolean {
  return EXPRESS_PAYMENT_METHODS.includes(method);
}

/**
 * Turns a payment-method code into the name to show a shopper.
 *
 * A code this build has no label for is returned **unchanged** rather than
 * prettified by a rule: guessing would print a plausible wrong name for a method
 * the platform has just added, and a raw `pix` on a receipt is a bug someone
 * reports, where "Pix Payments" is one nobody notices.
 *
 * @example
 * ```ts
 * paymentMethodLabel('sepa_debit');  // 'SEPA Direct Debit'
 * paymentMethodLabel('Apple Pay');   // 'Apple Pay' — spacing and case ignored
 * paymentMethodLabel('pix');         // 'pix' — no label for it yet
 * ```
 */
export function paymentMethodLabel(method: string): string {
  if (!method) return '';

  // The same normalisation the payment-method radios get: an order fetched from
  // an older API, or hand-written test data, may carry `Apple Pay` or `apple-pay`.
  const code = method
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  // The original, not the normalised code, so an unlabelled method is shown
  // exactly as it arrived.
  return PAYMENT_METHOD_LABELS[code] ?? method;
}
