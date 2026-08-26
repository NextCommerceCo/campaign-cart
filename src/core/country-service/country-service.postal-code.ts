/**
 * `CountryService`'s postal-code validation, formatting and per-country
 * defaults. Pure country formatting rules; the service itself still owns
 * fetching and caching.
 */

import type { Logger } from '@/core/logger';
import type { CountryConfig } from '@/core/country-service';

/**
 * Placeholder characters in a CDN `postcodeFormat`. All five accept any
 * character, and the pattern language has no escape, so a literal that happens
 * to be one of them is consumed as a placeholder (`980NN`, `GX11 1AA`). Hence
 * every formatted candidate is checked against the country's own regex before
 * it is used.
 */
const FORMAT_SLOTS = new Set(['N', 'X', 'A', '#', '9']);

/**
 * Formats for a CDN pattern the pattern language cannot express, keyed by the
 * pattern and then by the length of the cleaned code. The country's own letters
 * are re-expressed as placeholders, which is what lets a code whose prefix the
 * shopper already typed take its separator.
 *
 * IM `IMN NAA` + `IM00AX` → `IM0 0AX`, LT `LT-NNNNN` + `LT55798` → `LT-55798`
 *
 * A 7-character IM or JE code has no entry: spaced it is 8 characters, which
 * those countries' own `postcodeMaxLength` of 7 rejects.
 */
const FORMAT_BY_LENGTH: Record<string, Record<number, string>> = {
  'IMN NAA': { 6: 'AAN NAA' },
  'JEN NAA': { 6: 'AAN NAA' },
  'GX11 1AA': { 7: 'AANN NAA' },
  'LT-NNNNN': { 7: 'AA-NNNNN' },
};

const compiledRegexes = new Map<string, RegExp | null>();

function postcodeRegexOf(pattern: string): RegExp | null {
  const cached = compiledRegexes.get(pattern);
  if (cached !== undefined) return cached;

  let regex: RegExp | null = null;
  try {
    regex = new RegExp(pattern);
  } catch {
    regex = null;
  }
  compiledRegexes.set(pattern, regex);
  return regex;
}

/** `null` when the country ships no usable rule to check against. */
function checkAgainstCountry(
  postalCode: string,
  countryConfig: CountryConfig
): boolean | null {
  if (
    postalCode.length < countryConfig.postcodeMinLength ||
    postalCode.length > countryConfig.postcodeMaxLength
  ) {
    return false;
  }

  if (!countryConfig.postcodeRegex) return null;
  return postcodeRegexOf(countryConfig.postcodeRegex)?.test(postalCode) ?? null;
}

export function validatePostalCode(
  logger: Logger,
  postalCode: string,
  _countryCode: string,
  countryConfig: CountryConfig
): boolean {
  if (!postalCode) return false;

  const verdict = checkAgainstCountry(postalCode, countryConfig);
  if (verdict === null && countryConfig.postcodeRegex) {
    logger.error('Invalid postal code regex:', countryConfig.postcodeRegex);
  }
  return verdict ?? true;
}

/**
 * Fills `format` with `code`, anchoring the pattern's literals to the start or
 * to the end. `null` when `code` has more characters than the pattern has
 * placeholders.
 *
 * GB `AANN NAA` + `M11AE` → start `M11A E`, end `M1 1AE`
 */
function applyFormat(
  code: string,
  format: string,
  anchor: 'start' | 'end'
): string | null {
  const reverse = (value: string): string => [...value].reverse().join('');
  const source = anchor === 'start' ? code : reverse(code);
  const pattern = anchor === 'start' ? format : reverse(format);

  let formatted = '';
  let charIndex = 0;

  for (const formatChar of pattern) {
    if (charIndex >= source.length) break;

    if (FORMAT_SLOTS.has(formatChar)) {
      formatted += source[charIndex];
      charIndex++;
    } else {
      formatted += formatChar;
    }
  }

  if (charIndex < source.length) return null;
  return anchor === 'start' ? formatted : reverse(formatted);
}

/**
 * Formats a postal code into the shape its country writes it in, and returns
 * the input unchanged when it cannot.
 *
 * A `postcodeFormat` positions its literals at fixed offsets from the start,
 * which fits a fixed-length postcode only; the same pattern anchored from the
 * end fits the variable-length ones (GB outward codes run 2 to 4 characters),
 * and {@link FORMAT_BY_LENGTH} covers the patterns neither reading expresses.
 * A candidate is used only when the country's own `postcodeRegex` accepts it,
 * which also leaves a half-typed value alone instead of rearranging it.
 */
export function formatPostalCode(
  postalCode: string,
  countryConfig: CountryConfig
): string {
  if (!postalCode) return postalCode;

  const asTyped = /[a-zA-Z]/.test(postalCode)
    ? postalCode.toUpperCase()
    : postalCode;
  if (!countryConfig.postcodeFormat) return asTyped;

  const cleanCode = postalCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (!cleanCode) return postalCode;

  const format = countryConfig.postcodeFormat;

  const byLength = FORMAT_BY_LENGTH[format]?.[cleanCode.length];
  if (byLength !== undefined) {
    const corrected = applyFormat(cleanCode, byLength, 'start');
    if (
      corrected !== null &&
      checkAgainstCountry(corrected, countryConfig) === true
    ) {
      return corrected;
    }
  }

  const fromStart = applyFormat(cleanCode, format, 'start');
  if (
    fromStart !== null &&
    checkAgainstCountry(fromStart, countryConfig) !== false
  ) {
    return fromStart;
  }

  const fromEnd = applyFormat(cleanCode, format, 'end');
  if (
    fromEnd !== null &&
    checkAgainstCountry(fromEnd, countryConfig) === true
  ) {
    return fromEnd;
  }

  return asTyped;
}

export function getDefaultCountryConfig(countryCode: string): CountryConfig {
  const configs: Record<string, CountryConfig> = {
    US: {
      stateLabel: 'State',
      stateRequired: true,
      postcodeLabel: 'ZIP Code',
      postcodeRegex: '^\\d{5}(-\\d{4})?$',
      postcodeMinLength: 5,
      postcodeMaxLength: 10,
      postcodeExample: '12345 or 12345-6789',
      postcodeFormat: null,
      currencyCode: 'USD',
      currencySymbol: '$',
    },
    CA: {
      stateLabel: 'Province',
      stateRequired: true,
      postcodeLabel: 'Postal Code',
      postcodeRegex: '^[A-Z]\\d[A-Z] ?\\d[A-Z]\\d$',
      postcodeMinLength: 6,
      postcodeMaxLength: 7,
      postcodeExample: 'K1A 0B1',
      postcodeFormat: null,
      currencyCode: 'CAD',
      currencySymbol: '$',
    },
    GB: {
      stateLabel: 'County',
      stateRequired: false,
      postcodeLabel: 'Postcode',
      postcodeRegex: '^[A-Z]{1,2}\\d{1,2}[A-Z]?\\s?\\d[A-Z]{2}$',
      postcodeMinLength: 5,
      postcodeMaxLength: 8,
      postcodeExample: 'SW1A 1AA',
      postcodeFormat: null,
      currencyCode: 'GBP',
      currencySymbol: '£',
    },
  };

  return (
    configs[countryCode] || {
      stateLabel: 'State/Province',
      stateRequired: false,
      postcodeLabel: 'Postal Code',
      postcodeRegex: null,
      postcodeMinLength: 2,
      postcodeMaxLength: 20,
      postcodeExample: null,
      postcodeFormat: null,
      currencyCode: 'USD',
      currencySymbol: '$',
    }
  );
}
