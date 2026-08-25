/**
 * Whether a phone number can be used, and what to store for it.
 *
 * One question, one answer, one place: {@link checkPhone}. It used to be asked in five
 * places against four yardsticks, so a number could pass one gate and fail the next.
 *
 * Most callers want {@link isValidPhone} rather than the verdict itself — it is the one
 * place that decides what an `unknown` answer means, so every gate decides it the same way.
 *
 * Three verdicts, because the library that judges a number loads over the network:
 * `unknown` means nobody could check it, which is not the same as "the number is wrong".
 * The value is E.164 whenever one can be produced, because the orders API converts a
 * national number out of sight.
 *
 * Checks run in this order, first answer wins:
 *
 * 1. `isValidNumber()` — the library's length check, per country.
 * 2. Digit count, {@link MIN_PHONE_DIGITS}..15 — yields `unknown`, never `valid`.
 *
 * **What this deliberately does not do** is judge whether a well-formed number is one
 * anybody holds. `0000000000` is a valid length for a US number, so the SDK accepts it and
 * sends it. A shape rule here would be a second opinion competing with the server's, frozen
 * at release time on a page that may run for years, and the SDK never sees the outcome to
 * correct itself. The server owns that call; this owns sending it a well-formed number and
 * showing what comes back.
 */

/**
 * The part of `intl-tel-input`'s `Iti` this module uses.
 *
 * Structural, so the module stays free of the widget and of the DOM. Both methods are
 * optional and a throwing one yields `unknown`: a real instance can format but not judge
 * until its utils script lands, one caller reads its instance off a DOM element, and this
 * runs on every keystroke of the phone field.
 */
export interface PhoneNumberSource {
  /** E.164 for what is in the field now, or `''` before the utils script loads. */
  getNumber?(format?: number): string;
  /** Length-based verdict. `null` before the utils script loads. */
  isValidNumber?(): boolean | null;
}

/** `valid` and `invalid` are verdicts. `unknown` means nothing could check it. */
export type PhoneVerdict = 'valid' | 'invalid' | 'unknown';

/** Which check produced the verdict. Carried for logs, never for control flow. */
export type PhoneReason =
  | 'empty'
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

/**
 * The number the widget's own field holds, in E.164, or nothing.
 *
 * Nothing means the widget cannot speak for a number right now: there is none, the utils
 * script has not landed (`getNumber()` answers `''`), the field is empty, or the answer is
 * a bare dial code. That last one is the reason for the length floor: a widget can answer
 * with the selected country and no number, and `+1` must never be mistaken for the value it
 * was asked about — that would replace a shopper's number with a country.
 *
 * The one place the widget's number is read, so the floor cannot apply in one caller and
 * not another.
 */
export function e164FromWidget(widget?: PhoneNumberSource): string | undefined {
  const e164 = ask(() => widget?.getNumber?.());
  if (!e164?.startsWith('+')) return undefined;

  // A dial code is at least one digit and a national number at least MIN_PHONE_DIGITS, so
  // anything shorter than their sum is not a number in E.164.
  return digitsOf(e164).length > MIN_PHONE_DIGITS ? e164 : undefined;
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
  const fromWidget = e164FromWidget(widget);
  if (fromWidget) return fromWidget;

  const compact = value.replace(/[\s\-().]/g, '');
  return /^\+\d{8,15}$/.test(compact) ? compact : null;
}

/**
 * The widget, when it is in a position to answer at all.
 *
 * A widget reads its number and its verdict from its own field, so it can only speak for a
 * value that came from that field. Callers pass one that did — see the contract on
 * {@link checkPhone}.
 *
 * The one state left to rule out is a widget whose field is empty while the caller asks
 * about a number: `isValidNumber()` then answers `false` about a number that is not there.
 * A `null` answer is the utils script not having landed, which is not a rejection.
 */
function widgetFor(source?: PhoneNumberSource): PhoneNumberSource | undefined {
  if (!source) return undefined;
  if (ask(() => source.getNumber?.())) return source;
  return ask(() => source.isValidNumber?.()) == null ? source : undefined;
}

/**
 * Whether this phone can be used, and what to store for it.
 *
 * Pass `source` — the `intl-tel-input` instance bound to the field — whenever it is to
 * hand. Without it the answer can only be `unknown`: nothing else on the page knows what a
 * valid number looks like in the shopper's country.
 *
 * **`source` must be the widget for `raw`.** A widget reads its number and its verdict from
 * its own field, so it can only speak for a value that came from that field. Every caller
 * either reads the value straight off the field, or reads it from the store after
 * `checkout-form/phone-normalization.ts` has written the store from the field. This used to
 * be checked at runtime by comparing the two numbers digit by digit, which was a guess
 * standing in for a fact the callers already had.
 *
 * @example
 * ```ts
 * checkPhone('123', phoneInputs.get('shipping'));
 * // → { verdict: 'invalid', reason: 'library-length', value: '123', isE164: false }
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

  const widget = widgetFor(source);
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

  const digits = digitsOf(value).length;
  const withinRange = digits >= MIN_PHONE_DIGITS && digits <= MAX_PHONE_DIGITS;

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
 * Whether a phone number is good enough to accept, the way every gate in the SDK asks it.
 *
 * The companion to {@link isValidEmail} and {@link isValidName}, and what a caller wants
 * unless it needs the E.164 number as well.
 *
 * Only a number something actually rejected counts as invalid: an `unknown` verdict passes,
 * because a shopper is not told their phone is wrong on the strength of a check that could
 * not run. Deciding that here rather than at each gate is the point — a number that opens
 * one gate opens all of them.
 *
 * @example
 * ```ts
 * if (!isValidPhone(formData.phone, phoneSource('shipping'))) {
 *   errors.phone = 'Please enter a valid phone number';
 * }
 * ```
 */
export function isValidPhone(
  raw: string | undefined | null,
  source?: PhoneNumberSource
): boolean {
  return checkPhone(raw, source).verdict !== 'invalid';
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
