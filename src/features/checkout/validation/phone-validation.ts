/**
 * Whether a phone number can be used, and what to store for it.
 *
 * One question, one answer, one place: {@link checkPhone}. It used to be asked in five
 * places against four yardsticks, so a number could pass one gate and fail the next.
 *
 * Three verdicts, because the library that judges a number loads over the network:
 * `unknown` means nobody could check it, which is not the same as "the number is wrong".
 * The value is E.164 whenever one can be produced, because the orders API converts a
 * national number out of sight.
 *
 * Checks run in this order, first answer wins:
 *
 * 1. {@link isJunkPhoneNumber} — needs nothing, can never go stale.
 * 2. `isValidNumber()` — the library's length check. Not `isValidNumberPrecise()`: precise
 *    rules change monthly, and an SDK release pinned on a customer's page freezes them, so
 *    a precise gate starts refusing real numbers as it ages.
 * 3. Digit count, {@link MIN_PHONE_DIGITS}..15 — yields `unknown`, never `valid`.
 */

/**
 * The part of `intl-tel-input`'s `Iti` this module uses.
 *
 * Structural, so the module stays free of the widget and of the DOM. Every method is
 * optional and a throwing one yields `unknown`: a real instance can format but not judge
 * until its utils script lands, one caller reads its instance off a DOM element, and this
 * runs on every keystroke of the phone field.
 */
export interface PhoneNumberSource {
  /** E.164 for what is in the field now, or `''` before the utils script loads. */
  getNumber?(format?: number): string;
  /** Length-based verdict. `null` before the utils script loads. */
  isValidNumber?(): boolean | null;
  /** The country the field is on. Available without the utils script. */
  getSelectedCountryData?(): { dialCode?: string; iso2?: string };
}

/** `valid` and `invalid` are verdicts. `unknown` means nothing could check it. */
export type PhoneVerdict = 'valid' | 'invalid' | 'unknown';

/** Which check produced the verdict. Carried for logs, never for control flow. */
export type PhoneReason =
  | 'empty'
  | 'junk-pattern'
  | 'library-length'
  | 'digit-count'
  | 'utils-not-loaded'
  /** No widget to ask — none on the page, or the one there is shows another number. */
  | 'no-instance';

export interface PhoneCheck {
  verdict: PhoneVerdict;
  /**
   * What to store and send: E.164 when one could be produced, the text as typed otherwise.
   * Callers write this back instead of the raw input, which is how the store ends up
   * holding one format rather than two.
   */
  value: string;
  /** False means {@link PhoneCheck.value} is a national number the API must convert. */
  isE164: boolean;
  reason: PhoneReason;
}

/**
 * Floor for the digit-count fallback, and the shortest tail that counts as naming a number.
 * Seven, because national numbers that short exist (Norway, Iceland, the Pacific).
 */
export const MIN_PHONE_DIGITS = 7;

/** E.164's own ceiling. */
const MAX_PHONE_DIGITS = 15;

/** Below this, length already rejects the number, so the junk check does not run. */
const MIN_JUNK_CHECK_DIGITS = 7;

/**
 * Two, not three. Three costs nothing at ten digits (10 % 3 ≠ 0) but at **nine** — the
 * national length of a mobile in AU, FR, DE, IT, ES and NL — it takes the numbers this
 * rule can refuse from 16 to 1,006, all to catch `123123123`.
 */
const MAX_JUNK_UNIT_LENGTH = 2;

/**
 * A keypad read straight through, in both directions and from either end. Matched as a
 * substring: counting steps and wrapping 9 to 0 also catches numbers people hold, such as
 * the Australian mobile `+61 432 109 876`.
 */
const KEYPAD_RUNS = ['1234567890', '0987654321', '0123456789', '9876543210'];

/** Digits only, so `(415) 555-2671` and `+1 415-555-2671` compare the same. */
function digitsOf(value: string): string {
  return value.replace(/\D/g, '');
}

/** Asks the widget one question; a throw means it could not answer. */
function ask<T>(question: () => T): T | undefined {
  try {
    return question();
  } catch {
    return undefined;
  }
}

function isKeypadRun(digits: string): boolean {
  return KEYPAD_RUNS.some(run => run.includes(digits));
}

/** Three repetitions minimum, so a number that opens and closes alike is not caught. */
function isRepeatedUnit(digits: string): boolean {
  for (let unit = 1; unit <= MAX_JUNK_UNIT_LENGTH; unit++) {
    const repeats = digits.length / unit;
    if (!Number.isInteger(repeats) || repeats < 3) continue;
    if (digits === digits.slice(0, unit).repeat(repeats)) return true;
  }
  return false;
}

/**
 * Whether a national number is one nobody holds.
 *
 * The check that closes the reported bug: `0000000000` and `1234567890` are the right
 * length for a US number, so every length-based check passes them. It is also the only
 * rule here that can refuse a number the library accepts, which is why it stays narrow —
 * junk on an order is an order operations cannot follow up, but a real number refused is a
 * sale nobody finds out about. Ten-digit North American numbers it can refuse: 65 out of
 * ~6.4 billion assignable. Widen a rule and count again.
 *
 * @example
 * ```ts
 * isJunkPhoneNumber('0000000000'); // → true
 * isJunkPhoneNumber('4155552671'); // → false
 * ```
 */
export function isJunkPhoneNumber(nationalDigits: string): boolean {
  return (
    nationalDigits.length >= MIN_JUNK_CHECK_DIGITS &&
    (isKeypadRun(nationalDigits) || isRepeatedUnit(nationalDigits))
  );
}

/**
 * The number without its dial code. The junk check runs on this, or it would miss
 * `+1 0000000000`, whose full digit string starts with a `1`.
 */
function nationalDigitsOf(value: string, dialCode?: string): string {
  const digits = digitsOf(value);
  if (!dialCode || !value.trim().startsWith('+')) return digits;
  return digits.startsWith(dialCode) ? digits.slice(dialCode.length) : digits;
}

/**
 * E.164 from the widget, then from the text when it was already written internationally.
 *
 * Deliberately no third source: `+{dialCode}{digits}` is assemblable without the utils
 * script, but whether the national number keeps its leading zero is a per-country rule (the
 * UK and Germany drop it, Italy keeps it). Guessing produces a number that looks like valid
 * E.164 and is not, which is worse than a national number the API knows it must convert.
 */
function readE164(value: string, widget?: PhoneNumberSource): string | null {
  const fromWidget = ask(() => widget?.getNumber?.());
  if (fromWidget?.startsWith('+')) return fromWidget;

  const compact = value.replace(/[\s\-().]/g, '');
  return /^\+\d{8,15}$/.test(compact) ? compact : null;
}

/**
 * Whether the widget's number is the one being asked about.
 *
 * Matched on digit tails, not equality: international form adds a country code
 * (`4155552671` → `14155552671`) and may drop a trunk prefix (`07700 900123` →
 * `+447700900123`), so both the digits as given and without a leading zero count. A tail
 * shorter than {@link MIN_PHONE_DIGITS} matches nothing — `2671` is the tail of a million
 * real numbers.
 */
function describesSameNumber(fromWidget: string, value: string): boolean {
  const widget = digitsOf(fromWidget);
  const asked = digitsOf(value);

  return [asked, asked.replace(/^0/, '')].some(
    candidate =>
      candidate.length >= MIN_PHONE_DIGITS &&
      (widget.endsWith(candidate) || candidate.endsWith(widget))
  );
}

/**
 * The widget, but only when its own field holds the number being judged.
 *
 * A widget reads its number and its verdict from its own field, never from the value it is
 * asked about. The two come apart on a page judging a number the field is not showing: one
 * restored from an earlier visit, or a field not populated yet.
 */
function widgetFor(
  value: string,
  source?: PhoneNumberSource
): PhoneNumberSource | undefined {
  if (!source) return undefined;

  const shown = ask(() => source.getNumber?.());
  if (shown) return describesSameNumber(shown, value) ? source : undefined;

  // Nothing to compare, which is two states: the utils script has not landed (the widget
  // can still name the country, and its verdict is `null` anyway), or the field is empty
  // and `isValidNumber()` answers `false` about a number that is not there.
  return ask(() => source.isValidNumber?.()) == null ? source : undefined;
}

/**
 * Whether this phone can be used, and what to store for it.
 *
 * Pass `source` — the `intl-tel-input` instance bound to the field — whenever it is to
 * hand. Without it the answer can only be `unknown`: nothing else on the page knows what a
 * valid number looks like in the shopper's country.
 *
 * @example
 * ```ts
 * checkPhone('0000000000', phoneInputs.get('shipping'));
 * // → { verdict: 'invalid', reason: 'junk-pattern', value: '0000000000', isE164: false }
 *
 * checkPhone('(415) 555-2671', phoneInputs.get('shipping'));
 * // → { verdict: 'valid', reason: 'library-length', value: '+14155552671', isE164: true }
 * ```
 */
export function checkPhone(
  raw: string | undefined | null,
  source?: PhoneNumberSource
): PhoneCheck {
  const value = (raw ?? '').trim();

  if (!value) {
    return { verdict: 'unknown', value: '', isE164: false, reason: 'empty' };
  }

  const widget = widgetFor(value, source);
  const dialCode = ask(() => widget?.getSelectedCountryData?.())?.dialCode;
  const national = nationalDigitsOf(value, dialCode);

  if (isJunkPhoneNumber(national)) {
    return {
      verdict: 'invalid',
      value,
      isE164: false,
      reason: 'junk-pattern',
    };
  }

  const e164 = readE164(value, widget);
  const resolved = { value: e164 ?? value, isE164: e164 !== null };

  // `null` is the utils script not having loaded, not a rejection.
  const byLength = ask(() => widget?.isValidNumber?.()) ?? null;
  if (byLength !== null) {
    return {
      ...resolved,
      verdict: byLength ? 'valid' : 'invalid',
      reason: 'library-length',
    };
  }

  const withinRange =
    national.length >= MIN_PHONE_DIGITS && national.length <= MAX_PHONE_DIGITS;

  return {
    ...resolved,
    verdict: withinRange ? 'unknown' : 'invalid',
    reason: withinRange
      ? widget
        ? 'utils-not-loaded'
        : 'no-instance'
      : 'digit-count',
  };
}

/**
 * The value to store for a phone: E.164 when one can be had, the text as typed otherwise.
 * For callers moving a value around rather than judging it.
 *
 * @example
 * ```ts
 * normalizePhone('(415) 555-2671', phoneInputs.get('shipping')); // → '+14155552671'
 * ```
 */
export function normalizePhone(
  raw: string | undefined | null,
  source?: PhoneNumberSource
): string {
  return checkPhone(raw, source).value;
}
