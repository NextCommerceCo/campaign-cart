import type { RemoteCheck, RulesApi } from './rules';
import type { CheckoutState, FieldFormat } from './types';

const MIN_DIGITS = 4;
const MAX_DIGITS = 15;
const MIN_INTERNATIONAL_DIGITS = 8;

const DIGIT_ZEROS = [0xff10, 0x0660, 0x06f0, 0x0966, 0x09e6, 0x0e50, 0x0ed0, 0x1040, 0x17e0];
const OTHER_DIGITS = /[\p{Nd}＋]/gu;

export function asciiDigits(text: string): string {
  return text.replace(OTHER_DIGITS, (char) => {
    if (char === '＋') return '+';
    const code = char.codePointAt(0) ?? 0;
    const zero = DIGIT_ZEROS.find((start) => code >= start && code <= start + 9);
    return zero === undefined ? char : String(code - zero);
  });
}

const digitsOf = (text: string) => asciiDigits(text).replace(/\D/g, '');

export const countryOf = (fields: Record<string, string> | undefined, name: string): string | undefined =>
  fields?.[name.startsWith('billing_') ? 'billing_country' : 'country'];

export const phoneKey = (text: string) => asciiDigits(text).replace(/[^\d+]/g, '');

const compiled = new Map<string, RegExp>();
const regex = (source: string) => {
  let re = compiled.get(source);
  if (!re) compiled.set(source, (re = new RegExp(source)));
  return re;
};

function startOf(text: string): '+' | '00' | undefined {
  const typed = asciiDigits(text).trimStart();
  if (typed.startsWith('+')) return '+';
  return digitsOf(typed).startsWith('00') ? '00' : undefined;
}

const maskFor = (digits: string, format: FieldFormat) =>
  format.masks
    ?.map((entry) => (typeof entry === 'string' ? { mask: entry } : entry))
    .find((entry) => !entry.start || regex(`^(?:${entry.start})`).test(digits))?.mask;

function masked(digits: string, mask: string): string | undefined {
  if (digits.length > mask.split('#').length - 1) return undefined;
  let shown = '';
  let used = 0;
  for (const char of mask) {
    if (used === digits.length) break;
    shown += char === '#' ? digits[used++] : char;
  }
  return shown;
}

function asWritten(text: string): string {
  const kept = asciiDigits(text)
    .replace(/[^\d+\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trimStart();
  return kept.charAt(0) + kept.slice(1).replace(/\+/g, '');
}

export function formatPhone(text: string, format?: FieldFormat): string {
  const start = startOf(text);
  if (start) return asWritten(text);
  const digits = digitsOf(text);
  if (!format?.masks?.length || !digits) return digits;
  const prefix = format.national_prefix;
  const maskHoldsPrefix = !!prefix && digitsOf(format.example ?? '').startsWith(prefix);
  if (prefix && !maskHoldsPrefix && digits.startsWith(prefix) && digits.length > prefix.length) {
    const national = digits.slice(prefix.length);
    const mask = maskFor(national, format);
    const rest = mask && masked(national, mask);
    if (rest) return `${prefix} ${rest}`;
  }
  const mask = maskFor(digits, format);
  return (mask && masked(digits, mask)) ?? digits;
}

export function plausiblePhone(text: string, format?: FieldFormat): boolean {
  const digits = digitsOf(text);
  if (format?.pattern === undefined) return digits.length >= MIN_DIGITS && digits.length <= MAX_DIGITS;
  const start = startOf(text);
  if (!start) return regex(format.pattern).test(digits);
  const international = start === '00' ? digits.slice(2) : digits;
  if (format.calling_code && international.startsWith(format.calling_code)) {
    return regex(format.pattern).test(international.slice(format.calling_code.length));
  }
  return international.length >= MIN_INTERNATIONAL_DIGITS && international.length <= MAX_DIGITS;
}

export const PHONES = ['phone_number', 'billing_phone_number'];

export const phoneFieldOf = (countryField: string) =>
  countryField === 'country' ? 'phone_number' : 'billing_phone_number';

export const phoneOf = (checkout: CheckoutState, name: string) =>
  checkout.phones[name]?.value ?? (asciiDigits(checkout.fields[name]?.trim() ?? '') || undefined);

/** Reads a number with i18n-rules once per number and country; a read that failed is asked again next time. */
export function createPhoneReads(rulesApi: RulesApi) {
  const asked = new Map<string, Promise<RemoteCheck | undefined>>();
  return (country: string, typed: string): Promise<RemoteCheck | undefined> => {
    const key = `${country}|${phoneKey(typed)}`;
    let check = asked.get(key);
    if (!check) {
      check = rulesApi.validate(country, { phone_number: typed }).then(
        (fields) => fields.phone_number,
        () => undefined,
      );
      asked.set(key, check);
      void check.then((result) => result || asked.delete(key));
    }
    return check;
  };
}

/**
 * What the checkout keeps of the read of `name`, typed as `typed` in `country`: the number in E.164, or with
 * `warn` its message as a warning. Nothing once the shopper changed the number or its country.
 */
export function phoneChecked(
  checkout: CheckoutState,
  name: string,
  country: string,
  typed: string,
  result: RemoteCheck | undefined,
  warn: boolean,
): Partial<CheckoutState> | undefined {
  const { fields, phones, errors } = checkout;
  if (!result || countryOf(fields, name) !== country || phoneKey(fields[name] ?? '') !== phoneKey(typed)) return;
  if (result.valid && result.value) {
    const { [name]: error, ...rest } = errors;
    return {
      phones: {
        ...phones,
        [name]: {
          value: result.value,
          country: result.country ?? country,
          national: result.national,
          international: result.international,
        },
      },
      ...(error?.code === 'invalid' && { errors: rest }),
    };
  }
  if (warn && result.error && !errors[name])
    return { errors: { ...errors, [name]: { ...result.error, warning: true } } };
}
