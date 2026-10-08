/**
 * Whether one value looks like an email address, or holds an emoji — with no knowledge of
 * forms, fields, or the shopper's country.
 *
 * These are the bottom of the validation stack: every other module here eventually calls
 * one of them. They are pure functions of their argument, so they need **nothing** from
 * `CheckoutValidator` and can be tested by calling them.
 *
 * A name, a street line and a city are not checked for what they are written in, only that
 * they are there: the orders API takes any characters in them, so a pattern here could
 * only refuse a real shopper. One did, for every name written with Thai or Indic vowel
 * marks. The address-rules service can send one ({@link passesServedPattern}) when a value
 * turns out to break orders.
 *
 * Country-specific checks are deliberately *not* here, because being pure disqualifies
 * them. A postal code lives with `I18nRules`; a phone number lives in
 * [phone-validation.ts](./phone-validation.ts), which asks the input's phone field. It was
 * here once as a regex plus "at least ten digits", and judging a number without knowing
 * its country is what made it wrong.
 */

import { createLogger } from '@/core/logger';

/**
 * The regular expression behind {@link isValidEmail}, which adds the rules it cannot
 * express.
 */
export const VALIDATION_PATTERNS = {
  // Enhanced email validation - supports all valid TLDs including .co, .uk, etc.
  EMAIL:
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/,
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
 * Whether a text field's value passes the pattern the address-rules service sent for it,
 * compiled with the `u` flag and matched against the trimmed value.
 *
 * No pattern passes: none are sent today, and a field without one is only checked for being
 * there. A pattern that does not compile passes too, because a bad deployment of the
 * service must not stop every shopper on every page from paying.
 *
 * @example
 * ```ts
 * passesServedPattern('PO Box 12', '^(?!.*\\bPO Box\\b).*$'); // false
 * passesServedPattern('PO Box 12', undefined);                 // true
 * ```
 */
export function passesServedPattern(
  value: string,
  pattern: string | undefined
): boolean {
  if (!pattern) return true;
  if (!servedPatterns.has(pattern)) {
    let compiled: RegExp | null = null;
    try {
      compiled = new RegExp(pattern, 'u');
    } catch {
      logger.warn('Ignoring a field pattern that does not compile:', pattern);
    }
    servedPatterns.set(pattern, compiled);
  }
  return servedPatterns.get(pattern)?.test(value.trim()) ?? true;
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
