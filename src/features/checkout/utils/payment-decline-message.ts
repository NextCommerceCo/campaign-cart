/**
 * The sentence a shopper sees when the Campaigns API declines their payment.
 *
 * The API answers a declined order with `payment_response_code` (`3005`) and
 * `payment_details`, the gateway's own English wording (`Invalid Card Number`). The
 * address-rules service has a sentence for every code, in every language it serves, at
 * `payment.errors.<code>`, worded as what to do next: `Check your card number and try
 * again.` So the shopper sees, in order:
 *
 * 1. `payment.errors.<code>` in the form's language, the page's `translations` first;
 * 2. the page's own `payment.errors.generic`, where it wrote one;
 * 3. `payment_details`, for a code the service has no sentence for yet, or when its texts
 *    could not be loaded;
 * 4. the service's `payment.errors.generic`, and its English wording when even that is
 *    not loaded.
 *
 * A page that writes its own generic sentence wants its own words, so that sentence goes
 * ahead of the gateway's English. It also means a code whose reason is not passed on
 * (`3009`, a decline for fraud) never reaches the shopper as the gateway words it, even
 * while the service's texts cannot be loaded.
 *
 * The card form, the order manager and express checkout all use this one function, so a
 * decline reads the same however the shopper paid.
 */

import {
  addressLang,
  CountryService,
  pageTranslations,
  translatedText,
} from '@/core/country-service';

/** What a declined order answers, as far as the message needs it. */
export interface PaymentDecline {
  payment_response_code?: unknown;
  payment_details?: unknown;
}

/** The service's own English `payment.errors.generic`, for when nothing has loaded. */
const GENERIC = "Your card couldn't be processed. Try again.";

/**
 * How long a decline waits for the service's texts when the page has not loaded them
 * yet. The shopper is already waiting on a failed payment; past this, they see the
 * gateway's wording instead.
 */
const TEXTS_WAIT_MS = 1500;

/** A thrown decline: its message is the sentence the shopper was shown. */
export class PaymentDeclinedError extends Error {
  constructor(
    message: string,
    readonly code?: string
  ) {
    super(message);
    this.name = 'PaymentDeclinedError';
  }
}

/** Whether a failed order was a payment decline: it carries a code or the gateway's words. */
export function isPaymentDecline(answer: unknown): answer is PaymentDecline {
  if (typeof answer !== 'object' || answer === null) return false;
  const { payment_response_code: code, payment_details: details } =
    answer as PaymentDecline;
  return Boolean(code) || Boolean(details);
}

/** The code as a string, whether the API sent `"3005"` or `3005`. */
export function declineCode(answer: PaymentDecline): string | undefined {
  const code = answer.payment_response_code;
  return typeof code === 'string' || typeof code === 'number'
    ? String(code)
    : undefined;
}

/** The service's texts in `lang`, loading them if no element on the page has. */
async function textsIn(
  service: CountryService,
  lang: string
): Promise<Readonly<Record<string, string>> | undefined> {
  const loaded = service.getTexts(lang);
  if (loaded) return loaded;
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    service.loadTexts(lang),
    new Promise<void>(resolve => {
      timer = setTimeout(resolve, TEXTS_WAIT_MS);
    }),
  ]);
  clearTimeout(timer);
  return service.getTexts(lang);
}

/**
 * The sentence to show for a declined order, in the form's language.
 *
 * @example
 * ```ts
 * await paymentDeclineMessage({ payment_response_code: '3005', payment_details: 'Invalid Card Number' });
 * // 'Check your card number and try again.'
 * ```
 */
export async function paymentDeclineMessage(
  answer: PaymentDecline,
  lang: string = addressLang(),
  service: CountryService = CountryService.getInstance()
): Promise<string> {
  const texts = await textsIn(service, lang);
  const code = declineCode(answer);
  const details =
    typeof answer.payment_details === 'string' && answer.payment_details.trim()
      ? answer.payment_details
      : undefined;
  return (
    (code && translatedText(`payment.errors.${code}`, lang, texts)) ??
    pageTranslations(lang)['payment.errors.generic'] ??
    details ??
    texts?.['payment.errors.generic'] ??
    GENERIC
  );
}
