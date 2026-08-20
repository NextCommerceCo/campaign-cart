/**
 * Whether one value looks like an email address, a phone number, a person's name, or a
 * city — with no knowledge of forms, fields, or the shopper's country.
 *
 * These are the bottom of the validation stack: every other module here eventually calls
 * one of them. They are pure functions of their argument, so they need **nothing** from
 * `CheckoutValidator` and can be tested by calling them.
 *
 * Country-specific checks are deliberately *not* here — a postal code is only valid
 * relative to a country, so that check lives with `CountryService` and is reached through
 * the modules that know which country the shopper picked.
 *
 * Extracted verbatim from `checkout-validator.ts`, which still exposes all four as public
 * methods.
 */

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
  // apostrophe (straight or curly), hyphen, or space.
  // Examples: "田中", "Владимир", "Anne-Marie du Pré", "O'Brien", "O’Brien"
  NAME: /^\p{L}+(?:['’ -]\p{L}+)*$/u,
  // City validation - allows any Unicode letter, spaces, periods, apostrophes (both straight and curly), and hyphens
  // Examples: "New York", "St. John's", "St. John’s", "São Paulo", "Québec-City", "Mont-Saint-Michel", "O'Fallon"
  CITY: /^[\p{L}\s.'’-]+$/u,
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

/**
 * Whether a person's name contains only letters — any script — spaces, hyphens, and
 * apostrophes (straight or curly).
 *
 * @example
 * ```ts
 * isValidName("O'Brien-Smith"); // true
 * isValidName('田中');          // true — any script is a letter
 * isValidName('Jane 2nd');      // false — digits are not allowed
 * ```
 */
export function isValidName(name: string): boolean {
  return VALIDATION_PATTERNS.NAME.test(name.trim());
}

/**
 * Whether a city name is plausible: at least two characters, starting with a letter, no
 * digits, and no run of three-or-more spaces or hyphens.
 *
 * @example
 * ```ts
 * isValidCity('São Paulo'); // true
 * isValidCity('Area 51');   // false — digits are not allowed
 * ```
 */
export function isValidCity(city: string): boolean {
  const trimmedCity = city.trim();

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
