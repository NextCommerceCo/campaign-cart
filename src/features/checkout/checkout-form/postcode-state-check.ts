/**
 * Telling the shopper when their postcode is not one their chosen state uses.
 *
 * The country's pattern is checked here, as they type. Whether `10001` belongs to
 * California is not: the address-rules service knows how each state's postcodes start, so
 * once the postcode passes the pattern, it and the state are sent to `POST /v1/validate`.
 * A `not_in_state` answer is shown under the postcode in the service's own words, in the
 * address language: `Enter a valid ZIP Code for California`.
 *
 * It is shown, never recorded. A few real addresses sit across a state line from their
 * postcode (Texhoma, Texas has an Oklahoma ZIP code), so the message asks the shopper to
 * look again and the order still goes out: `showError` puts it on the page without adding
 * it to the errors a submit is blocked by. No answer, a slow one, or one about a postcode
 * the shopper has since changed shows nothing.
 */

import type { PostcodeResult } from '@/core/i18n-rules';

/** What this module needs from the checkout form. */
export interface PostcodeStateContext {
  /** The service's answer for a postcode in a country and state. */
  readPostcode: (
    postcode: string,
    country: string,
    state?: string
  ) => Promise<PostcodeResult | undefined>;
  /** The form's field of that name, shipping (`postal`) or billing (`billing-postal`). */
  getField: (name: string) => HTMLElement | undefined;
  /** Whether the country's pattern takes the postcode, as the form's own check judges it. */
  passesPattern: (postcode: string, country: string) => boolean;
  /** Puts a message under a field without blocking a submit. */
  showError: (name: string, message: string) => void;
  /** Takes the message away again. */
  clearError: (name: string) => void;
}

/** The fields whose change can make a postcode right or wrong for its state. */
const WATCHED = ['postal', 'province', 'country'];

/** The postcode, state and country fields of one address, by its prefix. */
const namesOf = (prefix: string) => ({
  postal: `${prefix}postal`,
  state: `${prefix}province`,
  country: `${prefix}country`,
});

/** The question last asked for each postcode field; an older answer is dropped. */
const asked = new WeakMap<PostcodeStateContext, Map<string, string>>();
/** The postcode fields showing this module's message, so only that one is cleared. */
const warned = new WeakMap<PostcodeStateContext, Set<string>>();

const valueOf = (field: HTMLElement | undefined): string =>
  field instanceof HTMLInputElement || field instanceof HTMLSelectElement
    ? field.value.trim()
    : '';

/**
 * Whether `fieldName` is one whose change can make its address's postcode right or wrong
 * for the state: the postcode, the state, or the country, shipping or billing.
 */
export function affectsPostcodeState(fieldName: string): boolean {
  return WATCHED.includes(fieldName.replace(/^billing-/, ''));
}

/**
 * Asks the service about the postcode of the address `fieldName` belongs to, and shows or
 * takes away the `not_in_state` message under it.
 *
 * @example
 * ```ts
 * if (affectsPostcodeState(fieldName)) void checkPostcodeState(ctx, fieldName);
 * ```
 */
export async function checkPostcodeState(
  ctx: PostcodeStateContext,
  fieldName: string
): Promise<void> {
  const names = namesOf(fieldName.startsWith('billing-') ? 'billing-' : '');
  const postcode = valueOf(ctx.getField(names.postal));
  const country = valueOf(ctx.getField(names.country));
  const state = valueOf(ctx.getField(names.state)) || undefined;

  const questions = asked.get(ctx) ?? new Map<string, string>();
  asked.set(ctx, questions);
  const shown = warned.get(ctx) ?? new Set<string>();
  warned.set(ctx, shown);
  const question = `${country}|${state ?? ''}|${postcode}`;
  questions.set(names.postal, question);

  const clear = () => {
    if (shown.delete(names.postal)) ctx.clearError(names.postal);
  };
  // A postcode its country refuses already has its own message.
  if (
    !postcode ||
    !country ||
    !state ||
    !ctx.passesPattern(postcode, country)
  ) {
    clear();
    return;
  }

  const answer = await ctx.readPostcode(postcode, country, state);
  if (questions.get(names.postal) !== question) return;
  if (answer?.error?.code === 'not_in_state') {
    shown.add(names.postal);
    ctx.showError(names.postal, answer.error.message);
  } else {
    clear();
  }
}
