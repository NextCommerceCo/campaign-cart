/**
 * Whether a phone number can be used, and what to store for it.
 *
 * One question, one answer, one place: {@link checkPhone}. Before this module the same
 * question was asked in five places against four yardsticks — `intl-tel-input`, a `>= 10`
 * digit count, a `>= 7` digit count, and a regex that counted no digits at all — so one
 * number could pass one gate and fail the next.
 *
 * The **verdict** is `valid`, `invalid`, or `unknown`. The third one is the point: the
 * library that judges a number loads over the network, so "nobody could check it" is a
 * real state and it is not the same answer as "the number is wrong". A shopper is never
 * blocked because our own bundle was slow.
 *
 * The **value** is E.164 (`+14155552671`) whenever one can be produced. The orders API
 * converts a national number, but a conversion we did not make is one we cannot see.
 *
 * Three checks, in this order:
 *
 * 1. **Junk patterns** ({@link isJunkPhoneNumber}) — needs nothing, can never go stale,
 *    and no shopper holds one of these numbers.
 * 2. **`isValidNumber()`** — the library's length check, per country. Chosen over
 *    `isValidNumberPrecise()` on the library author's own advice: precise rules change
 *    monthly and an SDK release pinned on a customer's page freezes them, so a precise
 *    gate starts rejecting real numbers as it ages. Lengths almost never change.
 * 3. **Digit count** — {@link MIN_PHONE_DIGITS} to 15, the E.164 range. Only reached when
 *    step 2 could not be asked, and it yields `unknown` rather than `valid` so the caller
 *    knows nobody really checked.
 *
 * `isValidNumberPrecise()` is still asked, and its answer rides on {@link PhoneCheck}
 * `precise` for logging only. It decides nothing today; the point is to measure how many
 * real orders it would have cost before anyone considers promoting it.
 */

/**
 * The part of `intl-tel-input`'s `Iti` this module uses.
 *
 * Structural rather than imported, so the module stays free of the widget and of the DOM:
 * a test passes a plain object, and a validator that is not `intl-tel-input` can be
 * dropped in behind the same methods.
 *
 * Every method is optional, and a missing or throwing one yields `unknown` rather than an
 * exception — for the first moments of every page the real instance can format but not
 * judge, one caller finds its source by reading `.iti` off a DOM element, and this runs on
 * every keystroke of the phone field.
 */
export interface PhoneNumberSource {
  /** E.164 for what is in the field now, or `''` when the utils script has not loaded. */
  getNumber?(format?: number): string;
  /** Length-based verdict. `null` when the utils script has not loaded yet. */
  isValidNumber?(): boolean | null;
  /** Full libphonenumber verdict. `null` when the utils script has not loaded yet. */
  isValidNumberPrecise?(): boolean | null;
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
  /** No widget to ask — none on the page, or the one there is showing another number. */
  | 'no-instance';

export interface PhoneCheck {
  verdict: PhoneVerdict;
  /**
   * What to store and send: E.164 when one could be produced, otherwise the text as
   * typed. Callers write this back rather than the raw input, which is how the store ends
   * up holding one format instead of two.
   */
  value: string;
  /** False means {@link PhoneCheck.value} is a national number the API must convert. */
  isE164: boolean;
  reason: PhoneReason;
  /** What `isValidNumberPrecise()` thought, or `null` when it could not be asked. */
  precise: boolean | null;
}

/**
 * The shortest national number the digit-count fallback accepts, and the shortest tail
 * that counts as naming a number.
 *
 * Seven, because national numbers that short exist (Norway, Iceland, much of the
 * Pacific), and this fallback only runs when nothing better could answer.
 */
export const MIN_PHONE_DIGITS = 7;

/** E.164's own ceiling. Only this module's fallback compares against it. */
const MAX_PHONE_DIGITS = 15;

/** Below this many digits the junk check does not run: length already rejects them. */
const MIN_JUNK_CHECK_DIGITS = 7;

/** Longest repeating unit looked for, e.g. `123123123123`. */
const MAX_JUNK_UNIT_LENGTH = 3;

/** Digits only, so `(415) 555-2671` and `+1 415-555-2671` compare the same. */
function digitsOf(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Runs one question at the widget and turns a throw into "no answer".
 *
 * It is third-party code, one caller does not even own the instance it passes, and this
 * runs on every keystroke of the phone field, which is no place to throw.
 */
function ask<T>(question: () => T): T | undefined {
  try {
    return question();
  } catch {
    return undefined;
  }
}

/**
 * A phone keypad read straight through, in both directions and from either end.
 *
 * Matched as a substring, which is what keeps the rule to what a person types when they do
 * not want to give a number. Counting steps instead — each digit one more than the last,
 * wrapping 9 to 0 — also catches numbers people really hold: the Australian mobile
 * `+61 432 109 876` is a descending run once its dial code comes off.
 */
const KEYPAD_RUNS = ['1234567890', '0987654321', '0123456789', '9876543210'];

/** True when the digits are a run taken straight off the keypad, e.g. `1234567890`. */
function isKeypadRun(digits: string): boolean {
  return KEYPAD_RUNS.some(run => run.includes(digits));
}

/**
 * True when a unit of up to three digits repeats to fill the number: `0000000000`,
 * `1212121212`, `123123123123`.
 *
 * Three repetitions minimum, so a real number that happens to open and close with the
 * same pair is not caught.
 */
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
 * This is the check that closes the reported bug: `0000000000` and `1234567890` are the
 * right length for a US number, so every length-based check in the world passes them.
 *
 * Deliberately narrow, because the two mistakes do not cost the same. Junk on an order is
 * an order operations cannot follow up; a real number refused is a sale that does not
 * happen and that nobody finds out about. Widen a rule and check what real numbering plans
 * it starts to catch — see {@link KEYPAD_RUNS} for the one that already had to be narrowed.
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
 * The national part of a number, with the country's dial code taken off the front.
 *
 * The junk check has to run on the national part, or it would miss `+1 0000000000`, whose
 * full digit string starts with a `1` and is therefore not all the same digit.
 */
function nationalDigitsOf(value: string, dialCode?: string): string {
  const digits = digitsOf(value);
  if (!dialCode || !value.trim().startsWith('+')) return digits;
  return digits.startsWith(dialCode) ? digits.slice(dialCode.length) : digits;
}

/**
 * The E.164 form of what the shopper typed, or `null` when there is no way to be sure.
 *
 * The widget first, because it is the only thing that knows each country's trunk-prefix
 * rules; then the text itself, when it was already written internationally.
 *
 * There is deliberately no third source. `+{dialCode}{digits}` can be assembled from data
 * available without the utils script, but whether the national number keeps or drops its
 * leading zero is a per-country rule (the UK and Germany drop it, Italy keeps it). Getting
 * that wrong produces a number that looks like valid E.164 and is not, which is worse than
 * handing the API a national number it knows it has to convert.
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
 * Compared by digit tails rather than by equality, because international form legitimately
 * changes both ends: a country code goes on the front (`4155552671` becomes
 * `14155552671`) and a trunk prefix may come off it (the UK writes `07700 900123` for
 * `+447700900123`, while Italy keeps its leading zero). Matching the digits as given *and*
 * without a leading zero covers both conventions without knowing which country follows
 * which.
 *
 * A tail counts only from {@link MIN_PHONE_DIGITS} up. Four digits are the tail of a
 * million real numbers, so matching on them would hand a caller asking about `2671` the
 * widget's whole `+14155552671` and call it the same number.
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
 * Everything a widget can say — the international form and the verdict alike — it reads
 * from its own field, never from the value it was asked about. The two come apart on a
 * page that judges a number the field is not showing: one restored from an earlier visit,
 * or a field that has not been populated yet. Such a widget is set aside for both answers,
 * and the result says `unknown` rather than borrowing a stranger's.
 */
function widgetFor(
  value: string,
  source?: PhoneNumberSource
): PhoneNumberSource | undefined {
  if (!source) return undefined;

  const shown = ask(() => source.getNumber?.());
  if (shown) return describesSameNumber(shown, value) ? source : undefined;

  // No number to compare against, which is two different states. Either the utils script
  // has not landed — the widget can still name the country, and its verdict is `null`
  // anyway — or the field is empty, and then `isValidNumber()` answers `false` about a
  // number that is not there.
  return ask(() => source.isValidNumber?.()) == null ? source : undefined;
}

/**
 * Whether this phone can be used, and what to store for it.
 *
 * `source` is the `intl-tel-input` instance bound to the field, when there is one. Pass it
 * whenever it is to hand: without it the answer can only be `unknown`, because nothing
 * else on the page knows what a valid number looks like in the shopper's country.
 *
 * @example
 * ```ts
 * const check = checkPhone('0000000000', phoneInputs.get('shipping'));
 * // → { verdict: 'invalid', reason: 'junk-pattern', value: '0000000000', isE164: false }
 *
 * const ok = checkPhone('(415) 555-2671', phoneInputs.get('shipping'));
 * // → { verdict: 'valid', reason: 'library-length', value: '+14155552671', isE164: true }
 * ```
 */
export function checkPhone(
  raw: string | undefined | null,
  source?: PhoneNumberSource
): PhoneCheck {
  const value = (raw ?? '').trim();

  if (!value) {
    return {
      verdict: 'unknown',
      value: '',
      isE164: false,
      reason: 'empty',
      precise: null,
    };
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
      precise: null,
    };
  }

  const e164 = readE164(value, widget);
  const resolved = { value: e164 ?? value, isE164: e164 !== null };

  // `null` here is the utils script not having loaded, not a rejection.
  const byLength = ask(() => widget?.isValidNumber?.()) ?? null;
  if (byLength !== null) {
    return {
      ...resolved,
      verdict: byLength ? 'valid' : 'invalid',
      reason: 'library-length',
      precise: ask(() => widget?.isValidNumberPrecise?.()) ?? null,
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
    precise: null,
  };
}

/**
 * The value to store for a phone: E.164 when one can be had, the text as typed otherwise.
 *
 * The shorthand for callers that are moving a value around rather than judging it — the
 * field-change handler, the contact-details store, the form populator. All three used to
 * carry their own `getNumber() || value`, which is the same rule written three times and
 * therefore three things to keep in step.
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
