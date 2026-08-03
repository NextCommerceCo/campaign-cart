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

import type { CountryConfig, CountryService } from '@/core/country-service';

/** The two things this module needs from the checkout form. */
export interface PostalCodeFormatContext {
  /** Owns the per-country formatting rule. */
  countryService: CountryService;
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
 *   { countryService, countryConfigs },
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

  const formatted = ctx.countryService.formatPostalCode(
    target.value,
    countryConfig
  );
  if (formatted === target.value) return;

  const cursorPos = target.selectionStart ?? 0;
  const lengthDiff = formatted.length - target.value.length;
  target.value = formatted;
  // Restore cursor position after formatting
  target.setSelectionRange(cursorPos + lengthDiff, cursorPos + lengthDiff);
}
