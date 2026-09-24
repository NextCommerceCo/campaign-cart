/**
 * A phone number shown, checked and converted by one country's rule.
 *
 * The rule is the address-rules service's `spec.phone`, kept in each country's file there:
 * a display mask, a loose digit pattern, and what E.164 needs. Loose on purpose — the order
 * API validates the number, so the check here only catches what is clearly not a phone
 * number, and the service's tests fail if a pattern refuses any of libphonenumber's example
 * numbers for its country.
 */

export interface PhoneRules {
  /** ITU calling code without the `+`; absent where the number must be sent as typed. */
  callingCode?: string;
  /** Dialled before a national number inside the country, and dropped from E.164. */
  nationalPrefix?: string;
  /** `#` is one digit: `(###) ###-####`. */
  mask?: string;
  /** Matched against the digits typed nationally, with or without the national prefix. */
  pattern: string;
  /** A real number in national form. */
  example?: string;
}

/** E.164's bounds, for a number typed with its own `+` code. */
const MIN_INTERNATIONAL_DIGITS = 8;
const MAX_INTERNATIONAL_DIGITS = 15;

function digitsOf(text: string): string {
  return text.replace(/\D/g, '');
}

function isInternational(text: string): boolean {
  return text.trimStart().startsWith('+');
}

function masked(digits: string, mask: string): string | null {
  if (digits.length > mask.split('#').length - 1) return null;
  let shown = '';
  let used = 0;
  for (const char of mask) {
    if (used === digits.length) break;
    if (char === '#') shown += digits[used++];
    else shown += char;
  }
  return shown;
}

/**
 * What the field shows: `+` and the digits for a number typed with a `+`, otherwise the
 * digits in the country's mask — cut after the last digit typed, so `41555` in the US shows
 * as `(415) 55`. Digits the mask has no room for, or a country with no mask, show as typed.
 *
 * A national prefix the mask does not hold (the US mask has no `1`) is shown before it:
 * `1 (415) 555-2671`.
 */
export function formatPhone(text: string, rules?: PhoneRules): string {
  const digits = digitsOf(text);
  if (isInternational(text)) return `+${digits}`;
  const mask = rules?.mask;
  if (!mask || !digits) return digits;

  const prefix = rules.nationalPrefix;
  const maskHoldsPrefix =
    prefix !== undefined && digitsOf(rules.example ?? '').startsWith(prefix);
  if (
    prefix &&
    !maskHoldsPrefix &&
    digits.startsWith(prefix) &&
    digits.length > prefix.length
  ) {
    const rest = masked(digits.slice(prefix.length), mask);
    if (rest !== null) return `${prefix} ${rest}`;
  }
  return masked(digits, mask) ?? digits;
}

/**
 * Whether the number could be a phone number for the country. A `+` number with the
 * country's own code is checked against its pattern without that code; one with another
 * code only has to be the length of an E.164 number.
 */
export function isPlausiblePhone(text: string, rules: PhoneRules): boolean {
  const digits = digitsOf(text);
  const pattern = new RegExp(rules.pattern);
  if (!isInternational(text)) return pattern.test(digits);
  if (rules.callingCode && digits.startsWith(rules.callingCode)) {
    return pattern.test(digits.slice(rules.callingCode.length));
  }
  return (
    digits.length >= MIN_INTERNATIONAL_DIGITS &&
    digits.length <= MAX_INTERNATIONAL_DIGITS
  );
}

/**
 * The number in E.164, or `''` when it must be sent as typed: no digits, or a country whose
 * rule carries no calling code (Argentina, whose mobiles keep a `15` inside the number that
 * only the order API's conversion removes).
 *
 * `+{callingCode}` and the digits with one leading national prefix dropped — `081 234 5678`
 * in Thailand is `+66812345678`. A number typed with its own `+` is kept as typed.
 */
export function toE164(text: string, rules?: PhoneRules): string {
  const digits = digitsOf(text);
  if (!digits) return '';
  if (isInternational(text)) return `+${digits}`;
  if (!rules?.callingCode) return '';
  const prefix = rules.nationalPrefix;
  const national =
    prefix && digits.startsWith(prefix) ? digits.slice(prefix.length) : digits;
  return `+${rules.callingCode}${national}`;
}
