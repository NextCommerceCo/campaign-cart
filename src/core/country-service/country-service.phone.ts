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
  callingCode?: string;
  /** Dialled before a national number inside the country, and dropped from E.164. */
  nationalPrefix?: string;
  /**
   * `#` is one digit: `(###) ###-####`. The first whose `start` matches the start of the
   * digits is used — Thailand's `02` landlines and `08` mobiles group differently — and the
   * last, without `start`, is the default.
   */
  masks?: { start?: string; mask: string }[];
  /** Matched against the digits typed nationally, with or without the national prefix. */
  pattern: string;
  /** A real number in national form. */
  example?: string;
}

/** E.164's bounds, for a number typed with its own `+` code. */
const MIN_INTERNATIONAL_DIGITS = 8;
const MAX_INTERNATIONAL_DIGITS = 15;

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

function patternOf(rules: PhoneRules): RegExp {
  return regex(rules.pattern);
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

  const prefix = rules.nationalPrefix;
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
  const pattern = patternOf(rules);
  const digits = internationalDigits(text);
  if (digits === null) return pattern.test(digitsOf(text));
  if (rules.callingCode && digits.startsWith(rules.callingCode)) {
    return pattern.test(digits.slice(rules.callingCode.length));
  }
  return (
    digits.length >= MIN_INTERNATIONAL_DIGITS &&
    digits.length <= MAX_INTERNATIONAL_DIGITS
  );
}

/**
 * The number in E.164, or `''` when it is sent as typed and the order API converts it.
 *
 * `+{callingCode}` and the digits with one leading national prefix dropped: `081 234 5678`
 * in Thailand is `+66812345678`. A number typed with `+` or `00` keeps its own code.
 *
 * Sent as typed rather than guessed at: a country whose rule has no calling code
 * (Argentina, whose mobiles keep a `15` inside the number), and digits that begin with the
 * calling code but not the national prefix — `66812345678` in Thailand may be a number
 * pasted without its `+`, and adding `+66` to it again would send a wrong one.
 */
export function toE164(text: string, rules?: PhoneRules): string {
  const international = internationalDigits(text);
  if (international !== null) return international ? `+${international}` : '';
  const digits = digitsOf(text);
  if (!digits || !rules?.callingCode) return '';
  const prefix = rules.nationalPrefix;
  if (prefix && digits.startsWith(prefix)) {
    return `+${rules.callingCode}${digits.slice(prefix.length)}`;
  }
  if (digits.startsWith(rules.callingCode)) return '';
  return `+${rules.callingCode}${digits}`;
}
