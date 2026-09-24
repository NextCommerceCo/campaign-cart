/**
 * Phone numbers from one country's rules: the national number, its validity, its E.164
 * form, and how it is written while it is typed.
 *
 * The rules are libphonenumber's metadata, served by the address-rules service on the
 * `phone_number` field (`docs/http-api.md` in i18n-rules-v2), so this module holds the
 * algorithm and none of the data. Every function is pure, and every one is tested against
 * libphonenumber's own answers for every country's sample numbers
 * (`tests/fixtures/phone-corpus.json`, generated there).
 *
 * `national number` below means libphonenumber's national significant number: the digits
 * after the national prefix, which is what E.164 carries after the calling code.
 */

export interface PhoneFormatRule {
  /** Matches a whole national number, one group per displayed block. */
  pattern: string;
  /** How the groups are written: `($1) $2-$3`. */
  format: string;
  /** Progressively longer patterns, tested at the start of the number. */
  leadingDigits?: string[];
  /** How the first group is written nationally, with the national prefix: `0$1`. */
  nationalPrefixRule?: string;
}

export interface PhoneRules {
  /** ITU calling code without the `+`. */
  callingCode: string;
  nationalPrefix?: string;
  nationalPrefixForParsing?: string;
  nationalPrefixTransformRule?: string;
  lengths: number[];
  pattern: string;
  types: { pattern: string; lengths?: number[] }[];
  formats: PhoneFormatRule[];
}

/** libphonenumber waits for this many national digits before it picks a format. */
const MIN_LEADING_DIGITS = 3;

/** Compiled once per source: these run on every keystroke. */
const compiled = new Map<string, RegExp>();

function regex(source: string, anchoring: 'whole' | 'start'): RegExp {
  const key = `${anchoring}:${source}`;
  let re = compiled.get(key);
  if (!re) {
    re = new RegExp(anchoring === 'whole' ? `^(?:${source})$` : `^(?:${source})`);
    compiled.set(key, re);
  }
  return re;
}

function digitsOf(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * The national number in digits typed nationally, and the national prefix typed before it.
 *
 * libphonenumber's rule: strip what `nationalPrefixForParsing` matches at the start, or
 * rewrite it with `nationalPrefixTransformRule` — but keep the digits whole when they
 * matched the national pattern and the stripped ones do not, because then the "prefix"
 * was part of the number (`0` begins every Italian landline).
 */
export function splitNationalPrefix(
  digits: string,
  rules: PhoneRules
): { prefix: string; number: string } {
  const source = rules.nationalPrefixForParsing;
  if (!source) return { prefix: '', number: digits };
  const re = regex(source, 'start');
  const match = re.exec(digits);
  if (!match) return { prefix: '', number: digits };

  const transformed =
    rules.nationalPrefixTransformRule !== undefined && match[1] !== undefined;
  const number = transformed
    ? digits.replace(re, rules.nationalPrefixTransformRule ?? '')
    : digits.slice(match[0].length);

  const whole = regex(rules.pattern, 'whole');
  if (whole.test(digits) && !whole.test(number)) {
    return { prefix: '', number: digits };
  }
  return { prefix: transformed ? '' : match[0], number };
}

/** The national number for what was typed nationally. */
export function nationalNumber(typed: string, rules: PhoneRules): string {
  return splitNationalPrefix(digitsOf(typed), rules).number;
}

/**
 * Whether a national number is valid: one of the country's lengths, its pattern, and one
 * of its number types — libphonenumber's `isValidNumber`, not a length check alone, which
 * would accept a Belgian mobile one digit short.
 */
export function isValidNationalNumber(number: string, rules: PhoneRules): boolean {
  if (!rules.lengths.includes(number.length)) return false;
  if (!regex(rules.pattern, 'whole').test(number)) return false;
  return rules.types.some(
    type =>
      (type.lengths ?? rules.lengths).includes(number.length) &&
      regex(type.pattern, 'whole').test(number)
  );
}

/** `+{callingCode}{national number}`, or `''` when nothing was typed. */
export function toE164(typed: string, rules: PhoneRules): string {
  const number = nationalNumber(typed, rules);
  return number ? `+${rules.callingCode}${number}` : '';
}

/**
 * The format for a national number: the first whose leading digits match its start and
 * whose pattern accepts it. `leadingDigits` is tested at libphonenumber's index for the
 * number's length, so a partial number is judged by the shorter, looser patterns.
 */
function formatFor(
  number: string,
  rules: PhoneRules,
  accepts: (rule: PhoneFormatRule) => boolean
): PhoneFormatRule | undefined {
  return rules.formats.find(rule => {
    const leading = rule.leadingDigits;
    if (leading?.length) {
      const index = Math.min(
        Math.max(number.length - MIN_LEADING_DIGITS, 0),
        leading.length - 1
      );
      if (!regex(leading[index], 'start').test(number)) return false;
    }
    return accepts(rule);
  });
}

/**
 * A format string with its first group written the national way: `$1 $2` with `0$1`
 * becomes `0$1 $2`, and Argentina's `$2 15-$3-$4` becomes `0$2 15-$3-$4` — the rule's `$1`
 * stands for whichever group comes first. libphonenumber writes the prefix only when it
 * was typed, and a rule without the prefix's digits — Brazil's `($1)` — always.
 */
function nationalFormatString(
  rule: PhoneFormatRule,
  rules: PhoneRules,
  prefixTyped: boolean
): { format: string; placesPrefix: boolean } {
  const prefixRule = rule.nationalPrefixRule;
  const first = /\$\d/.exec(rule.format);
  if (!prefixRule || !first) return { format: rule.format, placesPrefix: false };
  const placesPrefix =
    rules.nationalPrefix !== undefined &&
    prefixRule.replace('$1', '').includes(rules.nationalPrefix);
  if (placesPrefix && !prefixTyped) return { format: rule.format, placesPrefix: false };
  return {
    format: rule.format.replace(first[0], prefixRule.replace('$1', first[0])),
    placesPrefix,
  };
}

/**
 * A whole national number written the way libphonenumber writes it nationally: in its
 * format, with the national prefix where the format's rule puts one, and as bare digits
 * when no format takes it.
 */
export function formatNational(
  number: string,
  rules: PhoneRules,
  prefixTyped: boolean = true
): string {
  const rule = formatFor(number, rules, candidate =>
    regex(candidate.pattern, 'whole').test(number)
  );
  if (!rule) return number;
  return number.replace(
    regex(rule.pattern, 'whole'),
    nationalFormatString(rule, rules, prefixTyped).format
  );
}

/** Each group's longest size, from `(\d{3})(\d{3,4})`: `[3, 4]`. */
function groupSizes(pattern: string): number[] | null {
  const groups = pattern.match(/\(\\d(?:\{\d+(?:,\d+)?\})?\)/g);
  if (!groups || groups.join('') !== pattern) return null;
  return groups.map(group => {
    const size = /\{(\d+)(?:,(\d+))?\}/.exec(group);
    return size ? Number(size[2] ?? size[1]) : 1;
  });
}

/**
 * The digits a shopper has typed, written in the blocks of the format they are heading for.
 *
 * Takes digits, not the field's text: a format can add digits of its own (Argentina's
 * mobile `15`, Belarus's `8 0` prefix), so reading them back out of what was displayed
 * would type them twice. The caller keeps the digits and shows what this returns.
 *
 * Each group is filled to its longest size and the format is cut after the last group
 * with a digit in it, which is what libphonenumber's as-you-type formatter shows: `41555`
 * in the US is `415-55`, in the local seven-digit format, until an eighth digit rules it
 * out. A whole valid number is written as {@link formatNational} writes it; anything no
 * format can take is shown as the digits typed.
 */
export function formatAsYouType(typedDigits: string, rules: PhoneRules): string {
  const digits = digitsOf(typedDigits);
  const { prefix, number } = splitNationalPrefix(digits, rules);
  const prefixTyped =
    rules.nationalPrefix !== undefined && digits.startsWith(rules.nationalPrefix);
  if (isValidNationalNumber(number, rules)) {
    const whole = formatNational(number, rules, prefixTyped);
    // The prefix rule placed the prefix, or the number carries every digit typed.
    if (prefix === '' || digitsOf(whole).length >= digits.length) return whole;
    return `${prefix} ${whole}`;
  }
  // A prefix rewritten into the number (Argentina) is shown as typed until it is whole.
  if (prefix + number !== digits || number.length < MIN_LEADING_DIGITS) return digits;

  const rule = formatFor(number, rules, candidate => {
    const sizes = groupSizes(candidate.pattern);
    return sizes !== null && sizes.reduce((a, b) => a + b, 0) >= number.length;
  });
  const sizes = rule && groupSizes(rule.pattern);
  if (!rule || !sizes) return digits;

  const blocks: string[] = [];
  let rest = number;
  for (const size of sizes) {
    if (!rest) break;
    blocks.push(rest.slice(0, size));
    rest = rest.slice(size);
  }

  const { format, placesPrefix } = nationalFormatString(rule, rules, prefixTyped);
  const last = blocks.length;
  const cut = format.search(new RegExp(`\\$${last}(?!\\d)`)) + `$${last}`.length;
  const written = format
    .slice(0, cut)
    .replace(/\$(\d)/g, (_, n: string) => blocks[Number(n) - 1] ?? '');
  // A typed prefix the format has no place for is written before it, as dialled.
  return placesPrefix || !prefix ? written : `${prefix} ${written}`;
}
