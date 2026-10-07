/**
 * Whether one value looks like an email address, a person's name, or a city — with no
 * knowledge of forms, fields, or the shopper's country.
 *
 * These are the bottom of the validation stack: every other module here eventually calls
 * one of them. They are pure functions of their argument, so they need **nothing** from
 * `CheckoutValidator` and can be tested by calling them.
 *
 * A name and a city take the address-rules service's pattern when the caller has one
 * (`CountryConfig.namePattern` / `cityPattern`), so a correction to it reaches every page
 * without a release; the patterns here are what is used without one.
 *
 * Country-specific checks are deliberately *not* here, because being pure disqualifies
 * them. A postal code lives with `I18nRules`; a phone number lives in
 * [phone-validation.ts](./phone-validation.ts), which asks the input's phone field. It was
 * here once as a regex plus "at least ten digits", and judging a number without knowing
 * its country is what made it wrong.
 *
 * Extracted verbatim from `checkout-validator.ts`, which still exposes all three as public
 * methods.
 */

import { createLogger } from '@/core/logger';

/**
 * The regular expressions behind the checks below.
 *
 * @remarks Each pattern is one half of its check — {@link isValidEmail} and
 * {@link isValidCity} both add rules the regex cannot express.
 */
export const VALIDATION_PATTERNS = {
  // Enhanced email validation - supports all valid TLDs including .co, .uk, etc.
  EMAIL:
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/,
  // Name validation - letter runs (any script, via \p{L}) separated by a single
  // apostrophe (straight or curly), hyphen, or space. A run carries its combining marks
  // (\p{M}): Thai, Lao, Khmer and every Indic script write vowels and tones with them, so
  // without it "สุดา" and "नेहा" were refused and a shopper so named could not pay.
  // Examples: "田中", "Владимир", "Anne-Marie du Pré", "O'Brien", "O’Brien", "สุดา"
  NAME: /^\p{L}[\p{L}\p{M}]*(?:['’ -]\p{L}[\p{L}\p{M}]*)*$/u,
  // City validation - any Unicode letter and its combining marks, spaces, periods,
  // apostrophes (both straight and curly), and hyphens
  // Examples: "New York", "St. John's", "São Paulo", "Québec-City", "เชียงใหม่", "नई दिल्ली"
  CITY: /^[\p{L}\p{M}\s.'’-]+$/u,
} as const;

/**
 * Whether an address is a plausible email — pattern, then the rules a pattern misses.
 *
 * Beyond the shape, it rejects consecutive dots, a local or domain part that starts or
 * ends with a dot, and a one-character top-level domain (so `gmail.c` is caught while
 * `example.co` is kept).
 *
 * @example
 * ```ts
 * isValidEmail('shopper@example.co'); // true
 * isValidEmail('shopper@gmail.c');    // false — one-letter TLD
 * ```
 */
export function isValidEmail(email: string): boolean {
  // First check basic regex pattern
  if (!VALIDATION_PATTERNS.EMAIL.test(email)) {
    return false;
  }

  // Additional validation rules
  // Check for consecutive dots
  if (email.includes('..')) {
    return false;
  }

  // Check that email doesn't start or end with a dot
  const [localPart, domainPart] = email.split('@');
  if (!localPart || !domainPart) {
    return false;
  }

  if (
    localPart.startsWith('.') ||
    localPart.endsWith('.') ||
    domainPart.startsWith('.') ||
    domainPart.endsWith('.')
  ) {
    return false;
  }

  // Ensure TLD is at least 2 characters (prevents .c, .h, etc.)
  const parts = domainPart.split('.');
  const tld = parts[parts.length - 1];
  if (!tld || tld.length < 2) {
    return false;
  }

  // Check for common incomplete domains (single letter TLDs)
  // Note: .co is a valid TLD for Colombia and many services, so we don't block it
  const incompletePatterns = [
    /\.c$/, // gmail.c, yahoo.c (but not .co)
    /\.n$/, // incomplete .net
    /\.o$/, // incomplete .org
  ];

  // Only apply incomplete pattern check if it's truly a single letter TLD
  const domainLower = email.toLowerCase();
  if (incompletePatterns.some(pattern => pattern.test(domainLower))) {
    // Make sure we're not blocking valid 2-letter TLDs
    const parts = domainPart.split('.');
    const tld = parts[parts.length - 1];
    if (tld && tld.length === 1) {
      return false;
    }
  }

  return true;
}

const logger = createLogger('ValidationPatterns');

/** Each pattern the service sent, compiled once; `null` for one that does not compile. */
const servedPatterns = new Map<string, RegExp | null>();

/**
 * The service's pattern, compiled with `u`, or `undefined` to use the SDK's own. One that
 * does not compile falls back rather than refusing every value: a bad deployment of the
 * service must not stop every shopper on every page from paying.
 */
function servedPattern(pattern: string | undefined): RegExp | undefined {
  if (!pattern) return undefined;
  if (!servedPatterns.has(pattern)) {
    let compiled: RegExp | null = null;
    try {
      compiled = new RegExp(pattern, 'u');
    } catch {
      logger.warn(
        'Invalid name or city pattern, using the built-in one:',
        pattern
      );
    }
    servedPatterns.set(pattern, compiled);
  }
  return servedPatterns.get(pattern) ?? undefined;
}

/**
 * Whether a person's name contains only letters — any script, with their combining
 * marks — spaces, hyphens, and apostrophes (straight or curly).
 *
 * @param pattern The service's pattern for the address's country, when there is one.
 *
 * @example
 * ```ts
 * isValidName("O'Brien-Smith"); // true
 * isValidName('田中');          // true — any script is a letter
 * isValidName('Jane 2nd');      // false — digits are not allowed
 * ```
 */
export function isValidName(name: string, pattern?: string): boolean {
  return (servedPattern(pattern) ?? VALIDATION_PATTERNS.NAME).test(name.trim());
}

/**
 * Whether a city name is plausible: at least two characters, starting with a letter, no
 * digits, and no run of three-or-more spaces or hyphens.
 *
 * @param pattern The service's pattern for the address's country, when there is one. It
 *   is the whole check: the rules below are the SDK's own, for a deployment that sends none.
 *
 * @example
 * ```ts
 * isValidCity('São Paulo'); // true
 * isValidCity('Area 51');   // false — digits are not allowed
 * ```
 */
export function isValidCity(city: string, pattern?: string): boolean {
  const trimmedCity = city.trim();
  const served = servedPattern(pattern);
  if (served) return served.test(trimmedCity);

  // City must not be empty
  if (!trimmedCity) {
    return false;
  }

  // City must be at least 2 characters
  if (trimmedCity.length < 2) {
    return false;
  }

  // Check for numbers anywhere in the city name
  if (/\d/.test(trimmedCity)) {
    return false;
  }

  // Check for excessive consecutive punctuation (more than 2 hyphens or spaces)
  if (/---+/.test(trimmedCity) || /\s{3,}/.test(trimmedCity)) {
    return false;
  }

  // Check if starts with punctuation (except for allowed cases)
  // Allow starting with letters only (Unicode letters via \p{L})
  if (!/^[\p{L}]/u.test(trimmedCity)) {
    return false;
  }

  // Use the CITY pattern for validation
  // This regex allows: Unicode letters, spaces, periods, apostrophes (both ' and '), and hyphens
  return VALIDATION_PATTERNS.CITY.test(trimmedCity);
}

/**
 * A character drawn as an emoji, a symbol asked to be (`™` + U+FE0F), or a keycap (`1️⃣`).
 * Not `\p{Extended_Pictographic}` alone: that also holds `©`, `™` and `→`, which a company
 * line can carry, and a bare U+200D joins Indic letters as well as emojis.
 */
const EMOJI = /\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F|\u20E3/u;

/** Whether a value holds an emoji. No field takes one: "invalid" alone gives no clue. */
export function hasEmoji(value: unknown): boolean {
  return typeof value === 'string' && EMOJI.test(value);
}
