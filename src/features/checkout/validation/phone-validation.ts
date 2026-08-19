/**
 * Whether a phone number can be used, and what it is worth to the order.
 *
 * One question, one answer, one place. Before this module the same question was asked in
 * five places with four different yardsticks — `intl-tel-input`, a `>= 10` digit count, a
 * `>= 7` digit count, and a regex that counted no digits at all — so the same number could
 * pass one gate and fail the next. Every caller now asks {@link checkPhone}.
 *
 * Two jobs, deliberately answered together, because a caller that has one always needs the
 * other:
 *
 * - **the value** — the orders API wants E.164 (`+14155552671`). It will convert a national
 *   number if it has to, but a conversion we did not make is a conversion we cannot see, so
 *   the SDK sends E.164 whenever it can and says so in the log when it cannot.
 * - **the verdict** — `valid`, `invalid`, or `unknown`. The third one is the point: the
 *   library that decides this loads over the network, so "we could not ask" is a real state
 *   and it is not the same answer as "the number is wrong". A shopper is never blocked
 *   because our own bundle was slow.
 *
 * The order the three checks run in, and why:
 *
 * 1. **Junk patterns** ({@link isJunkPhoneNumber}) — `0000000000`, `1234567890`. Decided
 *    here rather than by the library because this check needs nothing, can never go stale,
 *    and is never wrong: no shopper holds one of these numbers.
 * 2. **`isValidNumber()`** — the library's length check. Chosen over
 *    `isValidNumberPrecise()` on the library author's own advice: precise rules change
 *    monthly, and an SDK release pinned on a customer's page freezes them forever, so a
 *    precise gate starts rejecting real numbers as it ages. Lengths almost never change.
 * 3. **Digit count** — {@link MIN_PHONE_DIGITS} to {@link MAX_PHONE_DIGITS}, the E.164
 *    range. Only reached when step 2 could not be asked, and it yields `unknown` rather
 *    than `valid` so the caller knows nobody really checked.
 *
 * `isValidNumberPrecise()` is still asked, and its answer is carried on
 * {@link PhoneCheck.precise} for logging only. It decides nothing today. The point is to
 * measure how many real orders it would have rejected before anyone considers promoting it.
 */

/**
 * The part of `intl-tel-input`'s `Iti` this module uses.
 *
 * Structural rather than imported so the module stays free of the widget and of the DOM: a
 * test passes a plain object, and a future validator that is not `intl-tel-input` can be
 * dropped in behind the same methods.
 *
 * Every method is optional, and a missing or throwing one yields `unknown` rather than an
 * exception. Two reasons: for the first moments of every page the real instance can format
 * but not judge, because its utils script is still in flight; and one caller finds its
 * source by reading `.iti` off a DOM element, so what arrives here is whatever the page
 * has. This also runs on every keystroke of the phone field, which is no place to throw.
 */
export interface PhoneNumberSource {
  /** E.164 for what is currently in the field, or `''` when the library's utils are not loaded. */
  getNumber?(format?: number): string;
  /** Length-based verdict. `null` when the utils script has not loaded yet. */
  isValidNumber?(): boolean | null;
  /** Full libphonenumber verdict. `null` when the utils script has not loaded yet. */
  isValidNumberPrecise?(): boolean | null;
  /**
   * The country the field is currently on. Available without the utils script.
   *
   * Optional because it is only used to take a dial code off the front of a number before
   * the junk check, and because this runs on every keystroke of the phone field: a source
   * missing one method should degrade, not throw inside a change handler.
   */
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
  /** No widget to ask — none on the page, or the one there is displaying another number. */
  | 'no-instance';

export interface PhoneCheck {
  verdict: PhoneVerdict;
  /**
   * What to store and send: E.164 when one could be produced, otherwise the text as typed.
   * Callers write this back rather than the raw input, which is how the store ends up
   * holding one format instead of two.
   */
  value: string;
  /** False means {@link PhoneCheck.value} is a national number the API will have to convert. */
  isE164: boolean;
  reason: PhoneReason;
  /**
   * What `isValidNumberPrecise()` thought, or `null` when it could not be asked. Log it,
   * do not branch on it — see the module comment.
   */
  precise: boolean | null;
}

/**
 * The shortest and longest national number the digit-count fallback accepts.
 *
 * The ceiling is E.164's own limit of 15 digits. The floor is 7 because national numbers
 * that short exist (Norway, Iceland, and much of the Pacific), and this fallback only runs
 * when nothing better could answer — being generous here is the whole point of it being a
 * fallback rather than a gate.
 */
export const MIN_PHONE_DIGITS = 7;
/** Not exported: only this module's own fallback compares against the ceiling. */
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
 * The national part of a number, with the country's dial code taken off the front.
 *
 * The junk check has to run on the national part or it would miss `+1 0000000000`, whose
 * full digit string starts with a `1` and is therefore not "all the same digit".
 */
function nationalDigitsOf(value: string, dialCode?: string): string {
  const digits = digitsOf(value);
  if (!dialCode) return digits;
  if (!value.trim().startsWith('+')) return digits;
  return digits.startsWith(dialCode) ? digits.slice(dialCode.length) : digits;
}

/** True when every digit is the same, e.g. `0000000000`. */
function isSingleRepeatedDigit(digits: string): boolean {
  return /^(\d)\1+$/.test(digits);
}

/**
 * True when the digits run consecutively up or down, e.g. `1234567890` or `9876543210`.
 *
 * Wraps at the decade boundary, so the `9` → `0` at the end of `1234567890` still counts:
 * that number is the second most common thing typed into a phone field that someone does
 * not want to fill in, and stopping one digit short of catching it would be pointless.
 */
function isConsecutiveRun(digits: string): boolean {
  const step = (a: string, b: string, direction: number): boolean =>
    (Number(a) + direction + 10) % 10 === Number(b);

  const ascending = [...digits].every(
    (d, i) => i === 0 || step(digits[i - 1], d, 1)
  );
  const descending = [...digits].every(
    (d, i) => i === 0 || step(digits[i - 1], d, -1)
  );

  return ascending || descending;
}

/**
 * True when a short unit repeats to fill the whole number, e.g. `1212121212`.
 *
 * At least three repetitions are required so that a genuine number which happens to open
 * and close with the same pair is not caught.
 */
function isRepeatedUnit(digits: string): boolean {
  for (let unit = 1; unit <= MAX_JUNK_UNIT_LENGTH; unit++) {
    if (digits.length % unit !== 0) continue;
    if (digits.length / unit < 3) continue;
    const head = digits.slice(0, unit);
    if (digits === head.repeat(digits.length / unit)) return true;
  }
  return false;
}

/**
 * Whether a national number is one nobody actually holds.
 *
 * This is the check that closes the reported bug: `0000000000` and `1234567890` are the
 * right length for a US number, so every length-based check in the world passes them.
 *
 * Deliberately narrow, because the cost of the two mistakes is not symmetric: a junk number
 * on an order is an order operations cannot follow up, while a real number rejected is a
 * sale that does not happen and that nobody finds out about.
 *
 * The price is measurable rather than theoretical. Enumerating every shape these three
 * rules match gives **68** ten-digit numbers that are otherwise structurally valid North
 * American ones (`2345678901`, `4242424242`, `9012345678`, …) out of roughly six billion
 * assignable — about one in a hundred million. Widen a rule and re-run that count before
 * assuming the trade still holds.
 *
 * @example
 * ```ts
 * isJunkPhoneNumber('0000000000'); // → true
 * isJunkPhoneNumber('4155552671'); // → false
 * ```
 */
export function isJunkPhoneNumber(nationalDigits: string): boolean {
  if (nationalDigits.length < MIN_JUNK_CHECK_DIGITS) return false;

  return (
    isSingleRepeatedDigit(nationalDigits) ||
    isConsecutiveRun(nationalDigits) ||
    isRepeatedUnit(nationalDigits)
  );
}

/** A number already written internationally, normalised to bare `+` and digits. */
function alreadyE164(value: string): string | null {
  const compact = value.replace(/[\s\-().]/g, '');
  return /^\+\d{8,15}$/.test(compact) ? compact : null;
}

/**
 * The E.164 form of what the shopper typed, or `null` when there is no way to be sure.
 *
 * Two sources, in order: the library, which is the only thing that knows each country's
 * trunk-prefix rules; then the text itself, when it was already written internationally.
 *
 * There is deliberately no third source. `+{dialCode}{digits}` can be assembled from data
 * that is available without the utils script, but whether the national number keeps or
 * drops its leading zero is a per-country rule (the UK and Germany drop it, Italy keeps
 * it). Getting that wrong produces a number that looks like a valid E.164 and is not, which
 * is worse than handing the API a national number it knows it has to convert.
 *
 * Only reached for a source that {@link speaksFor} this number; the caller has already
 * established that.
 */
function readE164(value: string, source?: PhoneNumberSource): string | null {
  const fromLibrary = ask(() => source?.getNumber?.());
  if (fromLibrary?.startsWith('+')) return fromLibrary;
  return alreadyE164(value);
}

/**
 * Whether the widget is talking about the number being judged.
 *
 * Everything a widget can tell us — the international form *and* the verdict — is read
 * from its own field, never from the value passed in, and the two are not always the same
 * thing: a caller may be judging a number restored from an earlier page while the field on
 * screen holds something else entirely. A widget on a different number is not a source of
 * truth about this one, so it is set aside for both answers rather than for one of them,
 * and the result says `unknown` instead of borrowing a stranger's verdict.
 *
 * When the widget cannot produce a number at all — its utils script has not landed — there
 * is nothing to compare, and nothing is lost by carrying on: the verdict it would give in
 * that state is `null` anyway.
 */
function speaksFor(value: string, source?: PhoneNumberSource): boolean {
  if (!source) return false;
  const fromLibrary = ask(() => source.getNumber?.());
  if (!fromLibrary?.startsWith('+')) return true;
  return describesSameNumber(fromLibrary, value);
}

/**
 * Whether the library's number is the one that was asked about.
 *
 * Compared by digits and by suffix rather than equality, because converting to
 * international form legitimately changes both ends: a country code goes on the front
 * (`4155552671` becomes `14155552671`) and a national trunk prefix may come off it (the UK
 * writes `07700 900123` for `+447700900123`, while Italy keeps its leading zero). So a
 * match is allowed against the digits as given *and* against them without a leading zero,
 * which covers both conventions without having to know which country follows which.
 *
 * What it still rejects is a number that shares no tail with the one asked about — the
 * case this exists for, where the widget's field holds something other than the value
 * being judged.
 */
function describesSameNumber(fromLibrary: string, value: string): boolean {
  const library = digitsOf(fromLibrary);
  const asked = digitsOf(value);
  const withoutTrunkPrefix = asked.replace(/^0/, '');

  return [asked, withoutTrunkPrefix].some(
    candidate =>
      candidate.length > 0 &&
      (library.endsWith(candidate) || candidate.endsWith(library))
  );
}

/**
 * Runs one question at the source and turns a throw into "no answer".
 *
 * The source is a third-party widget, and one caller does not even own the instance it
 * passes — it reads it off a DOM element. A library that throws is a library that could
 * not answer, which is exactly what `undefined` means to every caller here.
 */
function ask<T>(question: () => T): T | undefined {
  try {
    return question();
  } catch {
    return undefined;
  }
}

/**
 * Whether this phone can be used, and what to store for it.
 *
 * `source` is the `intl-tel-input` instance bound to the field, when there is one. Pass it
 * whenever it is to hand: without it the answer can only ever be `unknown`, because nothing
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

  // Resolved before anything is asked of the widget: one that is displaying a different
  // number answers about that one, and is no help here.
  const speaker = speaksFor(value, source) ? source : undefined;

  const dialCode = ask(() => speaker?.getSelectedCountryData?.())?.dialCode;
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

  const e164 = readE164(value, speaker);
  const resolved = { value: e164 ?? value, isE164: e164 !== null };

  // `null` here is the utils script not having loaded, not a rejection.
  const byLength = ask(() => speaker?.isValidNumber?.()) ?? null;
  if (byLength !== null) {
    return {
      ...resolved,
      verdict: byLength ? 'valid' : 'invalid',
      reason: 'library-length',
      precise: ask(() => speaker?.isValidNumberPrecise?.()) ?? null,
    };
  }

  const withinRange =
    national.length >= MIN_PHONE_DIGITS && national.length <= MAX_PHONE_DIGITS;

  return {
    ...resolved,
    verdict: withinRange ? 'unknown' : 'invalid',
    reason: withinRange
      ? speaker
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
