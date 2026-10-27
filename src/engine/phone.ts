export interface PhoneFormat {
  calling_code?: string;
  national_prefix?: string;
  masks?: { start?: string; mask: string }[];
  pattern?: string;
  example?: string;
}

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

const maskFor = (digits: string, format: PhoneFormat) =>
  format.masks?.find((entry) => !entry.start || regex(`^(?:${entry.start})`).test(digits))?.mask;

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

export function formatPhone(text: string, format?: PhoneFormat): string {
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

export function plausiblePhone(text: string, format?: PhoneFormat): boolean {
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
