/**
 * A phone number shown, checked and converted by one country's rule.
 *
 * The rule is the address-rules service's `spec.phone`, kept in each country's file there:
 * display masks, a loose digit pattern, and what E.164 needs. Loose on purpose — the order
 * API validates the number, so the check here only catches what is clearly not a phone
 * number, and the service's tests fail if a pattern refuses any of libphonenumber's example
 * numbers for its country.
 */

export interface PhoneRules {
  /** ITU calling code without the `+`; absent where the number must be sent as typed. */
  calling_code?: string;
  /** Dialled before a national number inside the country, and dropped from E.164. */
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
  /**
   * libphonenumber's facts for reading a national number, from the address-rules service:
   * the prefix as a regex where it is not one literal (`0|80?` in Belarus), what it is
   * rewritten to where it is not dropped (`268$1` in Antigua, whose local seven digits lack
   * the area code), and every valid national number. See {@link toE164}.
   */
  national_prefix_for_parsing?: string;
  national_prefix_transform_rule?: string;
  national_number_pattern?: string;
}

/**
 * One country of a calling code, as `GET /v1/calling-codes` lists it. Where a code has
 * several, each is told apart by the start of the national number or by the pattern of
 * every number it has, tried in order; a number none of them claims is the first one's.
 */
export interface CallingCodeCountry {
  country: string;
  leading_digits?: string;
  pattern?: string;
}

/** Every calling code without its `+`, and its countries: `{ "66": [{ "country": "TH" }] }`. */
export type CallingCodes = Readonly<
  Record<string, readonly CallingCodeCountry[]>
>;

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
  return text.replace(/\D/g, '');
}

/**
 * The digits after the calling code's `+`, or `null` for a number typed nationally. `00` is
 * how most countries dial abroad, so `0066 81…` is read as `+66 81…`.
 */
function internationalDigits(text: string): string | null {
  const typed = text.trimStart();
  if (typed.startsWith('+')) return digitsOf(typed);
  if (typed.startsWith('00')) return digitsOf(typed).slice(2);
  return null;
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
 * digits in the country's mask for how the number starts — cut after the last digit typed,
 * so `41555` in the US shows as `(415) 55`. Digits the mask has no room for, or a country
 * with no mask, show as typed. Until the digits reach a mask's `start`, the default is used.
 *
 * A national prefix the mask does not hold (the US mask has no `1`) is shown before it:
 * `1 (415) 555-2671`.
 */
export function formatPhone(text: string, rules?: PhoneRules): string {
  const international = internationalDigits(text);
  if (international !== null) return `+${international}`;
  const digits = digitsOf(text);
  if (!rules?.masks?.length || !digits) return digits;

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
 * Whether the number could be a phone number for the country. A `+` number with the
 * country's own code is checked against its pattern without that code; one with another
 * code only has to be the length of an E.164 number.
 */
export function isPlausiblePhone(text: string, rules: PhoneRules): boolean {
  // A country with no rule of its own has no pattern, and its number is not checked.
  if (rules.pattern === undefined) return true;
  const pattern = regex(rules.pattern);
  const digits = internationalDigits(text);
  if (digits === null) return pattern.test(digitsOf(text));
  if (rules.calling_code && digits.startsWith(rules.calling_code)) {
    return pattern.test(digits.slice(rules.calling_code.length));
  }
  return (
    digits.length >= MIN_INTERNATIONAL_DIGITS &&
    digits.length <= MAX_INTERNATIONAL_DIGITS
  );
}

/** Whether `digits` are a valid national number, or `true` where the rule cannot tell. */
function isNationalNumber(rules: PhoneRules, digits: string): boolean {
  return (
    rules.national_number_pattern === undefined ||
    regex(`^(?:${rules.national_number_pattern})$`).test(digits)
  );
}

/**
 * The digits with the national prefix dropped or rewritten, as libphonenumber reads them
 * (`maybeStripNationalPrefixAndCarrierCode`). The prefix stays when the digits were a
 * number and would not be one without it.
 */
function withoutNationalPrefix(rules: PhoneRules, digits: string): string {
  const prefix =
    rules.national_prefix_for_parsing ??
    rules.national_prefix?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!prefix || !digits) return digits;
  const start = regex(`^(?:${prefix})`);
  const match = start.exec(digits);
  if (!match) return digits;
  const last = match[match.length - 1];
  const read =
    rules.national_prefix_transform_rule &&
    match.length > 1 &&
    last !== undefined
      ? digits.replace(start, rules.national_prefix_transform_rule)
      : digits.slice(match[0].length);
  return isNationalNumber(rules, digits) && !isNationalNumber(rules, read)
    ? digits
    : read;
}

/**
 * The number in E.164, or `''` when there is none to give: the number is then sent as
 * typed, and the order API converts it.
 *
 * Read the way libphonenumber reads it, from the service's facts: digits that start with
 * the calling code are taken as typed with it and no `+` when only that way are they a
 * number; otherwise the national prefix is dropped or rewritten, and the rest must be a
 * valid national number. `081 234 5678` in Thailand is `+66812345678`, `464 1234` in
 * Antigua `+12684641234`. A number typed with `+` or `00` keeps its own code, and is
 * checked when that code is this country's.
 *
 * A rule without `national_number_pattern` comes from a service that predates it, and is
 * read as it always was: one leading `national_prefix` dropped, and digits that begin with
 * the calling code sent as typed, since `66812345678` in Thailand may be a number pasted
 * without its `+`. A rule with no calling code (Argentina) is always sent as typed.
 */
export function toE164(text: string, rules?: PhoneRules): string {
  const international = internationalDigits(text);
  if (international !== null) {
    if (!international) return '';
    const own = rules?.calling_code;
    if (rules && own && international.startsWith(own)) {
      return isNationalNumber(rules, international.slice(own.length))
        ? `+${international}`
        : '';
    }
    return `+${international}`;
  }
  const digits = digitsOf(text);
  const code = rules?.calling_code;
  if (!digits || !rules || !code) return '';

  if (rules.national_number_pattern === undefined) {
    const prefix = rules.national_prefix;
    if (prefix && digits.startsWith(prefix)) {
      return `+${code}${digits.slice(prefix.length)}`;
    }
    return digits.startsWith(code) ? '' : `+${code}${digits}`;
  }

  if (digits.startsWith(code)) {
    const rest = withoutNationalPrefix(rules, digits.slice(code.length));
    if (!isNationalNumber(rules, digits) && isNationalNumber(rules, rest)) {
      return `+${code}${rest}`;
    }
  }
  const national = withoutNationalPrefix(rules, digits);
  return isNationalNumber(rules, national) ? `+${code}${national}` : '';
}

/**
 * The country a number typed with `+` or `00` is in, the way libphonenumber finds it:
 * `+1 268 464 1234` is Antigua, `+66 81…` Thailand. `undefined` for a number typed
 * nationally, or a code no country has.
 */
export function countryOfNumber(
  text: string,
  codes: CallingCodes
): string | undefined {
  const digits = internationalDigits(text);
  if (!digits) return undefined;
  for (const length of [1, 2, 3]) {
    const countries = codes[digits.slice(0, length)];
    if (!countries) continue;
    const national = digits.slice(length);
    const found = countries.find(entry =>
      entry.leading_digits !== undefined
        ? regex(`^(?:${entry.leading_digits})`).test(national)
        : entry.pattern !== undefined &&
          regex(`^(?:${entry.pattern})$`).test(national)
    );
    return (found ?? countries[0])?.country;
  }
  return undefined;
}
