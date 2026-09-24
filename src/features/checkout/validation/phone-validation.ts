/**
 * Whether a phone number can be used, and what to store for it.
 *
 * One question, one answer, one place: {@link checkPhone}, or {@link isValidPhone} for
 * callers that only want a boolean. It used to be asked in five places against four
 * yardsticks, so a number could pass one gate and fail the next.
 *
 * Checked in this order, first answer wins:
 *
 * 1. `isValidNumber()` — the phone field's verdict: `isPlausiblePhone` against its
 *    country's phone rules.
 * 2. Digit count, {@link MIN_PHONE_DIGITS}..{@link MAX_PHONE_DIGITS} — `unknown`, never `valid`.
 *
 * Three verdicts because those rules load over the network: `unknown` means nobody could
 * check it, not that the number is wrong.
 *
 * **The bar is deliberately loose, because the order API validates the number.** The field
 * only refuses what is clearly not a phone number: national digits outside the country's
 * loose pattern (`core/country-service/country-service.phone.ts › isPlausiblePhone`), or a
 * number typed with another country's `+` code outside E.164's 8 to 15 digits. It asks
 * nothing about number types or whether a number is in service, so `0000000000` passes in
 * the US and is sent. The two ways of being wrong do not cost the same: refusing a real
 * number loses a sale, silently and for good, while accepting an unreachable one costs a
 * server-side rejection we can see.
 */

/**
 * What this module asks a phone field (`checkout-form/phone-input.ts`).
 *
 * Structural, so the module stays free of the field and the DOM. Both methods optional and
 * a throwing one yields `unknown`, because this runs on every keystroke.
 */
export interface PhoneNumberSource {
  /** E.164 for what is in the field now, or `''` when there is none to give. */
  getNumber?(): string;
  /** Whether the number could be one for its country. `null` until the rules load. */
  isValidNumber?(): boolean | null;
}

/** `valid` and `invalid` are verdicts. `unknown` means nothing could check it. */
export type PhoneVerdict = 'valid' | 'invalid' | 'unknown';

/** Which check produced the verdict. Carried for logs, never for control flow. */
export type PhoneReason =
  | 'empty'
  /** The country's phone rule decided it. */
  | 'rule'
  | 'digit-count'
  /** The phone field is there, and has no rule to check with. */
  | 'rule-not-loaded'
  /** No widget to ask — none on the page, or the one there is shows another number. */
  | 'no-instance';

export interface PhoneCheck {
  verdict: PhoneVerdict;
  /**
   * What to store and send: E.164 when one could be produced, the text as typed otherwise.
   * Written back instead of the raw input, so the store holds one format rather than two.
   */
  value: string;
  /** False means {@link PhoneCheck.value} is a national number the API must convert. */
  isE164: boolean;
  reason: PhoneReason;
}

/**
 * The shortest national number in service anywhere: Niue and Tokelau assign four digits.
 *
 * Seven refused every number in nineteen countries — Greenland `32 10 00`, the Faroes
 * `201234`, Andorra `712 345`. Below four is a service code (`911`, `112`).
 */
const MIN_PHONE_DIGITS = 4;

/** E.164's own ceiling. */
const MAX_PHONE_DIGITS = 15;

/** Digits only, so `(415) 555-2671` and `+1 415-555-2671` compare the same. */
function digitsOf(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Whether a `+`-prefixed string has the length of a number rather than of a dial code.
 *
 * One rule for both sources of an E.164 number, the widget and the typed text. A dial code
 * is one to three digits and a national number at least {@link MIN_PHONE_DIGITS}, so their
 * sum is the floor: `+1` is a country, `+6831234` is Niue.
 */
function isE164Shaped(value: string): boolean {
  // Digits only after the `+`: counting digits alone would call `+1415CALL2671` E.164 and
  // send the letters to the API.
  if (!/^\+\d+$/.test(value)) return false;
  const digits = value.length - 1;
  return digits > MIN_PHONE_DIGITS && digits <= MAX_PHONE_DIGITS;
}

/**
 * The number the widget's own field holds, in E.164, or nothing.
 *
 * Nothing when the widget cannot speak for a number: none on the page, a national number
 * with no rules to convert it by or a rule with no calling code (`getNumber()` answers
 * `''`), an empty field, or a bare dial code — which must never be taken for the number it
 * was asked about.
 */
export function e164FromWidget(widget?: PhoneNumberSource): string | undefined {
  let e164: string | undefined;
  try {
    e164 = widget?.getNumber?.();
  } catch {
    return undefined; // A widget torn down under us; see verdictOf.
  }
  return e164 && isE164Shaped(e164) ? e164 : undefined;
}

/**
 * The widget's verdict, `null` while its rules load, `undefined` when it could not answer
 * at all.
 *
 * The `catch` keeps a source that throws from failing a keystroke. The SDK's own phone
 * field reports every state rather than throwing.
 */
function verdictOf(widget?: PhoneNumberSource): boolean | null | undefined {
  try {
    return widget?.isValidNumber?.();
  } catch {
    return undefined;
  }
}

/**
 * E.164 from the widget, then from the text when it was already written internationally.
 *
 * Deliberately no third source: `+{dialCode}{digits}` is assemblable without the rules,
 * but whether the national number keeps its leading zero is a per-country rule (the UK and
 * Germany drop it, Italy keeps it). Guessing produces a number that looks like valid E.164
 * and is not, which is worse than a national number the API knows it must convert.
 */
function readE164(value: string, widget?: PhoneNumberSource): string | null {
  const fromWidget = e164FromWidget(widget);
  if (fromWidget) return fromWidget;

  const compact = value.replace(/[\s\-().]/g, '');
  return isE164Shaped(compact) ? compact : null;
}

/**
 * The widget, when it is in a position to answer at all.
 *
 * It is whenever its field holds anything. `getNumber()` answers for a number too short to
 * be valid — `+1415555267` for nine US digits — and that is the case whose verdict matters
 * most, so the test is "holds something", not "holds a valid number".
 *
 * An empty field answers `''`, and its `isValidNumber()` is `false` about a number that is
 * not there. The only usable answer left there is `null`: the rules not having loaded,
 * which is not a rejection. A country whose rule has no calling code (Argentina) also
 * answers `''` with a verdict, so its numbers fall through to the digit count.
 */
function usableWidget(
  source?: PhoneNumberSource
): PhoneNumberSource | undefined {
  if (!source) return undefined;

  let shown: string | undefined;
  try {
    shown = source.getNumber?.();
  } catch {
    return undefined;
  }
  if (shown) return source;

  return verdictOf(source) == null ? source : undefined;
}

/**
 * Whether this phone can be used, and what to store for it.
 *
 * Pass `source` — the phone field bound to the input — whenever it is to hand. Without it
 * the answer can only be `unknown`: nothing else on the page knows what a valid number
 * looks like in the shopper's country.
 *
 * **`source` must be the widget for `raw`.** A widget answers about its own field, so every
 * caller either reads `raw` straight off that field or reads it from the store after
 * `checkout-form/phone-normalization.ts` has written the store from it.
 *
 * @example
 * ```ts
 * checkPhone('123', phoneInputs.get('shipping'));
 * // → { verdict: 'invalid', reason: 'rule', value: '123', isE164: false }
 *
 * checkPhone('(415) 555-2671', phoneInputs.get('shipping'));
 * // → { verdict: 'valid', reason: 'rule', value: '+14155552671', isE164: true }
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

  const widget = usableWidget(source);
  const e164 = readE164(value, widget);
  const resolved = { value: e164 ?? value, isE164: e164 !== null };

  // `null` is the rules not having loaded, not a rejection.
  const byLength = verdictOf(widget) ?? null;
  if (byLength !== null) {
    return {
      ...resolved,
      verdict: byLength ? 'valid' : 'invalid',
      reason: 'rule',
    };
  }

  const digits = digitsOf(value).length;
  const withinRange = digits >= MIN_PHONE_DIGITS && digits <= MAX_PHONE_DIGITS;

  return {
    ...resolved,
    verdict: withinRange ? 'unknown' : 'invalid',
    reason: withinRange
      ? widget
        ? 'rule-not-loaded'
        : 'no-instance'
      : 'digit-count',
  };
}

/**
 * Whether a phone number is good enough to accept, the way every gate in the SDK asks it.
 *
 * The companion to {@link isValidEmail} and {@link isValidName}. `unknown` passes: a shopper
 * is not told their phone is wrong on the strength of a check that could not run. Decided
 * here rather than at each gate, so a number that opens one opens all of them.
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

/**
 * Whether the page marks the phone as required, with `required` or
 * `data-next-required="true"` on its input.
 *
 * The input is found by `data-next-checkout-field`, like every other checkout field.
 * `name="phone"` was once the only lookup and stays as the fallback, so a page that relied
 * on it keeps working; preferring the SDK attribute also stops another form's phone input
 * on the same page from deciding the rule.
 */
export function isPhoneMarkedRequired(): boolean {
  const field =
    document.querySelector('[data-next-checkout-field="phone"]') ??
    document.querySelector('[name="phone"]');
  return (
    field instanceof HTMLElement &&
    (field.hasAttribute('required') || field.dataset.nextRequired === 'true')
  );
}
