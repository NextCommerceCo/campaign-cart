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
 * Postcode formats this SDK knows a country by, for the countries whose pattern
 * from the countries service cannot describe their real postcodes: the pattern
 * language has no escape, so a pattern's own letters (`IM`, `JE`, `GX`, `LT`)
 * are consumed as placeholders. Re-expressing them as placeholders is what lets
 * a code whose prefix the shopper already typed take its separator.
 *
 * IM `IM00AX` → `IM0 0AX`, LT `LT55798` → `LT-55798`, GI `GX111AA` → `GX11 1AA`
 *
 * {@link withPostcodeFormats} merges these ahead of the pattern the service
 * sent, whenever a config is read, so `formatPostalCode` knows nothing about
 * countries. When the service ships a list for a country, its entry here goes.
 *
 * GB is spelled out by length even though one pattern anchored from the end
 * derives the same three shapes, because the service sends a single pattern and
 * pages on released versions of this SDK are reading it today.
 */
const POSTCODE_FORMATS: Record<string, string[]> = {
  GB: ['AANN NAA', 'AAN NAA', 'AN NAA'],
  GI: ['AANN NAA'],
  IM: ['AAN NAA'],
  JE: ['AAN NAA'],
  LT: ['LT-NNNNN', 'AA-NNNNN'],
};

/**
 * The config as read, with this SDK's formats for `countryCode` in front of the
 * one the countries service sent. Returns the config untouched for a country
 * with no entry.
 */
export function withPostcodeFormats(
  countryCode: string,
  countryConfig: CountryConfig
): CountryConfig {
  const known = POSTCODE_FORMATS[countryCode.toUpperCase()];
  if (!known) return countryConfig;

  const sent = countryConfig.postcodeFormat;
  const asSent = sent === null ? [] : Array.isArray(sent) ? sent : [sent];

  return {
    ...countryConfig,
    postcodeFormat: [...known, ...asSent.filter(f => !known.includes(f))],
  };
}

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
 * A format positions its literals at fixed offsets from the start, which fits a
 * fixed-length postcode only; the same format anchored from the end fits the
 * variable-length ones (GB outward codes run 2 to 4 characters). A country whose
 * postcodes take more than one shape carries a list, tried in order. A candidate
 * is used only when the country's own `postcodeRegex` accepts it, which also
 * leaves a half-typed value alone instead of rearranging it.
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

  const formats = Array.isArray(countryConfig.postcodeFormat)
    ? countryConfig.postcodeFormat
    : [countryConfig.postcodeFormat];

  for (const format of formats) {
    for (const anchor of ['start', 'end'] as const) {
      const candidate = applyFormat(cleanCode, format, anchor);
      if (
        candidate !== null &&
        checkAgainstCountry(candidate, countryConfig) === true
      ) {
        return candidate;
      }
    }
  }

  // A country with no rule to check against gives nothing to choose between its
  // formats, so the first one's start-anchored output stands.
  const first = applyFormat(cleanCode, formats[0], 'start');
  if (first !== null && checkAgainstCountry(first, countryConfig) === null) {
    return first;
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
      // The pattern the countries service ships, so a postcode validates the
      // same way whether or not that service answered.
      postcodeRegex: '^[A-Za-z]{1,2}\\d[A-Za-z\\d]? ?\\d[A-Za-z]{2}$',
      postcodeMinLength: 5,
      postcodeMaxLength: 8,
      postcodeExample: 'SW1A 0AA',
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
