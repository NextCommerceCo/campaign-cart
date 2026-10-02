/**
 * A phone number shown and loosely checked by one country's rule, and the answer the
 * address-rules service gives when asked to read it.
 *
 * The rule is the service's `fields.phone_number.format`, kept in each country's file
 * there: display masks and a loose digit pattern. Loose on purpose: the check here only
 * catches what is clearly not a phone number, and the service's tests fail if a pattern
 * refuses any of libphonenumber's example numbers for its country. The E.164 number comes
 * from the service (`POST /v1/validate`), which reads the number with libphonenumber, so
 * nothing here builds one from national digits.
 */

export interface PhoneRules {
  /** ITU calling code without the `+`; absent where the number must be sent as typed. */
  calling_code?: string;
  /** Dialled before a national number inside the country, and shown before the mask. */
  national_prefix?: string;
  /**
   * `#` is one digit: `(###) ###-####`. The first whose `start` matches the start of the
   * digits is used — Thailand's `02` landlines and `08` mobiles group differently — and the
   * last, without `start`, is the default.
   */
  masks?: { start?: string; mask: string }[];
  /**
   * Matched against the digits typed nationally, with or without the national prefix.
   * Absent for a country with no rule of its own, whose number is then not checked.
   */
  pattern?: string;
  /** A real number in national form. */
  example?: string;
}

/**
 * What the service answers for a phone number: `phone_number` in the response of
 * `POST /v1/validate`.
 */
export interface PhoneNumberResult {
  /** Whether the number is one its country has assigned. */
  valid: boolean;
  /** The number in E.164, `+66812345678`, where `valid`. */
  value?: string;
  /** The number's own country, which need not be the address country. */
  country?: string;
}

/** E.164's bounds, for a number typed with its own `+` code. */
const MIN_INTERNATIONAL_DIGITS = 8;
const MAX_INTERNATIONAL_DIGITS = 15;

const E164 = new RegExp(
  `^\\+[1-9]\\d{${MIN_INTERNATIONAL_DIGITS - 1},${MAX_INTERNATIONAL_DIGITS - 1}}$`
);

/**
 * Whether `text` is a phone number in E.164, the only form a tag can match to a person:
 * `+14155552671`, never `(415) 555-2671` or `4155552671`.
 */
export function isE164(text: string | null | undefined): text is string {
  return typeof text === 'string' && E164.test(text);
}

/**
 * The zero of each run of decimal digits a keyboard may type besides ASCII: full-width (a
 * Japanese or Chinese IME), Arabic-Indic, Eastern Arabic-Indic, Devanagari, Bengali, Thai,
 * Lao, Myanmar and Khmer. Each run is ten code points, zero first.
 */
const DIGIT_ZEROS = [
  0xff10, 0x0660, 0x06f0, 0x0966, 0x09e6, 0x0e50, 0x0ed0, 0x1040, 0x17e0,
];

const OTHER_DIGITS = /[\p{Nd}＋]/gu;

/**
 * `๐๘๑` → `081`, `＋６６` → `+66`: the text with every digit as an ASCII one. Each is one
 * UTF-16 unit replaced by one, so a caret offset into the text still points at the same
 * place.
 */
export function asciiDigits(text: string): string {
  return text.replace(OTHER_DIGITS, char => {
    if (char === '＋') return '+';
    const code = char.codePointAt(0) ?? 0;
    const zero = DIGIT_ZEROS.find(start => code >= start && code <= start + 9);
    return zero === undefined ? char : String(code - zero);
  });
}

/** Compiled once per source: the check and the mask run on every keystroke. */
const compiled = new Map<string, RegExp>();

function regex(source: string): RegExp {
  let re = compiled.get(source);
  if (!re) {
    re = new RegExp(source);
    compiled.set(source, re);
  }
  return re;
}

/** The mask for these digits: the first whose `start` matches, else the default. */
function maskFor(digits: string, rules?: PhoneRules): string | undefined {
  return rules?.masks?.find(
    entry => !entry.start || regex(`^(?:${entry.start})`).test(digits)
  )?.mask;
}

function digitsOf(text: string): string {
  return asciiDigits(text).replace(/\D/g, '');
}

/** How a number was typed: with a `+`, dialled with `00`, or neither. */
function startOf(text: string): '+' | '00' | undefined {
  const typed = asciiDigits(text).trimStart();
  if (typed.startsWith('+')) return '+';
  if (digitsOf(typed).startsWith('00')) return '00';
  return undefined;
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
 * What the field shows: `+` and the digits for a number typed with a `+`, the digits as
 * typed for one dialled with `00`, otherwise the digits in the country's mask for how the
 * number starts — cut after the last digit typed, so `41555` in the US shows as
 * `(415) 55`. Digits the mask has no room for, or a country with no mask, show as typed.
 * Until the digits reach a mask's `start`, the default is used.
 *
 * A national prefix the mask does not hold (the US mask has no `1`) is shown before it:
 * `1 (415) 555-2671`.
 */
export function formatPhone(text: string, rules?: PhoneRules): string {
  const digits = digitsOf(text);
  const start = startOf(text);
  if (start === '+') return `+${digits}`;
  if (start === '00' || !rules?.masks?.length || !digits) return digits;

  const prefix = rules.national_prefix;
  const maskHoldsPrefix =
    prefix !== undefined && digitsOf(rules.example ?? '').startsWith(prefix);
  if (
    prefix &&
    !maskHoldsPrefix &&
    digits.startsWith(prefix) &&
    digits.length > prefix.length
  ) {
    const national = digits.slice(prefix.length);
    const mask = maskFor(national, rules);
    const rest = mask ? masked(national, mask) : null;
    if (rest !== null) return `${prefix} ${rest}`;
  }
  const mask = maskFor(digits, rules);
  return (mask && masked(digits, mask)) ?? digits;
}

/**
 * Whether the number could be a phone number for the country. A number typed with `+` or
 * `00` and the country's own code is checked against its pattern without that code; one
 * with another code only has to be the length of an E.164 number.
 */
export function isPlausiblePhone(text: string, rules: PhoneRules): boolean {
  // A country with no rule of its own has no pattern, and its number is not checked.
  if (rules.pattern === undefined) return true;
  const pattern = regex(rules.pattern);
  const start = startOf(text);
  const digits = digitsOf(text);
  if (start === undefined) return pattern.test(digits);
  const international = start === '00' ? digits.slice(2) : digits;
  if (rules.calling_code && international.startsWith(rules.calling_code)) {
    return pattern.test(international.slice(rules.calling_code.length));
  }
  return (
    international.length >= MIN_INTERNATIONAL_DIGITS &&
    international.length <= MAX_INTERNATIONAL_DIGITS
  );
}
