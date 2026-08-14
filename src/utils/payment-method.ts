/**
 * The one name to show a shopper for each way of paying.
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
 * `card_token` is the one deliberate difference from the API's own wording: it
 * calls that "Card Token", which is a word about plumbing, and a shopper reading
 * their own receipt is being told how they paid.
 *
 * `iDEAL` and `PayPal` keep their house capitalisation, which is the reason this
 * is a table and not a title-case function over the code.
 *
 * `sepa_direct` is here for reading only. The SDK sends SEPA Direct Debit as
 * `sepa_debit` and accepts no other name for it, but the platform's own
 * payment-methods guide calls it `sepa_direct`, so an order recorded through
 * another integration can come back under that name and still has to print.
 */
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  card_token: 'Credit Card',
  credit_card: 'Credit Card',
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
  sepa_direct: 'SEPA Direct Debit',
  sofort: 'Sofort',
  swish: 'Swish',
  twint: 'Twint',
};

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
