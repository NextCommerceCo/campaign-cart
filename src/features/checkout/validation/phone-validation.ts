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
 * 1. {@link isJunkPhoneNumber}, unless the library knows the number is really assignable.
 * 2. `isValidNumber()` — the library's length check. It is not the precise one, whose
 *    rules change monthly: an SDK release pinned on a customer's page freezes them, so a
 *    precise *gate* starts refusing real numbers as it ages. Precise is asked only to
 *    overrule step 1, where a frozen answer can accept a number but never refuse one.
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
  /**
   * Whether the number exists in its country's numbering plan. `null` before the utils
   * script loads.
   *
   * Read only to *accept* — see {@link checkPhone}. Never to refuse: these rules change
   * monthly and an SDK release pinned on a customer's page freezes them, so a gate built
   * on them starts turning real shoppers away as it ages.
   */
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
 * The shortest national number in service anywhere: Niue and Tokelau assign four digits.
 *
 * The floor was seven until a sweep of every country's example number showed it refusing
 * every number in nineteen of them — Greenland `32 10 00`, the Faroes `201234`, Andorra
 * `712 345`. Below four is a service code (`911`, `112`), never a number a shopper is
 * reachable on.
 */
const MIN_PHONE_DIGITS = 4;

/** E.164's own ceiling. */
const MAX_PHONE_DIGITS = 15;

/**
 * How much longer the widget's number may be than the one asked about and still be it.
 *
 * A dial code of up to three digits goes on the front, and a trunk prefix of one may come
 * off. Anything further apart is a different number: `2671` is the tail of a million real
 * numbers, and must not adopt the widget's whole `+14155552671`.
 */
const MAX_DIAL_PREFIX_DIGITS = 4;

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
 * length for a US number, so every length-based check passes them.
 *
 * Shape only — it knows nothing about who was ever assigned what, so on its own it refuses
 * 6,391 numbers that really are assignable somewhere. {@link checkPhone} is what makes it
 * safe, by asking the library before acting on it.
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

/** How many digits at the end two strings share. */
function commonSuffixLength(a: string, b: string): number {
  let shared = 0;
  while (
    shared < a.length &&
    shared < b.length &&
    a[a.length - 1 - shared] === b[b.length - 1 - shared]
  ) {
    shared++;
  }
  return shared;
}

/**
 * Whether the widget's number is the one being asked about.
 *
 * Two forms of one number differ in exactly two ways: a dial code goes on the front, and a
 * national trunk prefix comes off (`0` in most of the world, `8` in Russia and Kazakhstan).
 * So they match when they are within {@link MAX_DIAL_PREFIX_DIGITS} of each other in length
 * and share everything but at most one digit of the shorter one.
 *
 * Naming the trunk prefixes instead was tried and is what left every Russian order carrying
 * a national number. An absolute floor was tried before that and discarded the widget for
 * every Greenlandic and Andorran number, which are shorter than seven digits in full.
 */
function describesSameNumber(fromWidget: string, value: string): boolean {
  const widget = digitsOf(fromWidget);
  const asked = digitsOf(value);
  if (!widget || !asked) return false;

  const [longer, shorter] =
    widget.length >= asked.length ? [widget, asked] : [asked, widget];

  return (
    longer.length - shorter.length <= MAX_DIAL_PREFIX_DIGITS &&
    commonSuffixLength(longer, shorter) >= shorter.length - 1
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

  // A shape nobody types on purpose, unless the library knows the number is really
  // assignable — `4242424242` is a Los Angeles number as well as a placeholder, and a
  // shopper who holds one is not who this rule is for. `null` or no widget means the
  // question could not be put, and then the shape decides.
  const reallyAssignable = ask(() => widget?.isValidNumberPrecise?.()) === true;

  if (!reallyAssignable && isJunkPhoneNumber(national)) {
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
