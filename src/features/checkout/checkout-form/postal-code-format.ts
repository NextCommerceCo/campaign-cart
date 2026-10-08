/**
 * Rewriting a postal code into the shape its country uses, while the shopper is still
 * typing it.
 *
 * Countries disagree about spacing and case — `K1A0B1` is written `K1A 0B1` in Canada and
 * `SW1A1AA` is written `SW1A 1AA` in the UK — so the value is reformatted in place on every
 * keystroke and the caret is put back where the shopper left it. Without that caret repair
 * the browser drops the cursor to the end of the field the moment a space is inserted, and
 * anyone correcting a character in the middle of their postcode types the rest backwards.
 *
 * Both address forms use it, which is the reason it is a module rather than a method: the
 * shipping and billing branches of `handleFieldChange` ran byte-identical copies that
 * differed only in which `<select>` they read the country from. That country field is now
 * the parameter.
 */

import type { CountryConfig, I18nRules } from '@/core/i18n-rules';

/** The two things this module needs from the checkout form. */
export interface PostalCodeFormatContext {
  /** Owns the per-country formatting rule. */
  i18nRules: I18nRules;
  /** Per-country config cache, filled as each country's data resolves. */
  countryConfigs: Map<string, CountryConfig>;
}

/**
 * Reformats the postal code in `target` for the country selected in `countryField`,
 * preserving the caret.
 *
 * Does nothing when no country is chosen yet, when that country's config has not been
 * fetched, or when the value is already correctly formatted — a no-op write would move the
 * caret for no reason.
 *
 * @example
 * ```ts
 * formatPostalCodeInPlace(
 *   { i18nRules, countryConfigs },
 *   postalInput,
 *   fields.get('country')
 * );
 * ```
 */
export function formatPostalCodeInPlace(
  ctx: PostalCodeFormatContext,
  target: HTMLInputElement,
  countryField: HTMLElement | undefined
): void {
  const countryCode =
    countryField instanceof HTMLSelectElement ? countryField.value : '';
  if (!countryCode) return;

  const countryConfig = ctx.countryConfigs.get(countryCode);
  if (!countryConfig) return;

  const formatted = ctx.i18nRules.formatPostalCode(target.value, countryConfig);
  if (formatted === target.value) return;

  const kept = significantBefore(target.value, target.selectionStart ?? 0);
  target.value = formatted;
  const caret = caretAfter(formatted, kept);
  target.setSelectionRange(caret, caret);
}

/** A postcode's own characters; a space or hyphen is the format's. */
const SIGNIFICANT = /[\p{L}\p{N}]/u;

function significantBefore(text: string, offset: number): number {
  let count = 0;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (SIGNIFICANT.test(text[i])) count++;
  }
  return count;
}

/**
 * Where the caret goes in `text` to have `count` of its own characters before it: right
 * after the last of them, so Backspace steps back over a separator the format put there.
 *
 * `SW1A1AA` with the caret after `SW1A` → `SW1A| 1AA`. Moving by the length the value grew
 * instead put a caret typed at the start one place too far, and Backspace over the space
 * only saw it put back.
 */
function caretAfter(text: string, count: number): number {
  if (count === 0) return 0;
  let seen = 0;
  for (let i = 0; i < text.length; i++) {
    if (SIGNIFICANT.test(text[i]) && ++seen === count) return i + 1;
  }
  return text.length;
}
