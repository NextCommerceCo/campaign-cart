import type { Engine } from '../engine/engine';
import { format, localeOf, phoneText, type Value, type ValueType } from '../engine/format';

const MONEY = /(^|_)(price|total|subtotal|tax|amount)$|^total_discount$/;

/** A field's display type from its name: `price`, `*_total`, `subtotal`, `tax`, `amount` are money, `*percentage` a percentage. */
export function fieldType(field: string, value: unknown): ValueType {
  if (typeof value === 'boolean') return 'bool';
  if (typeof value === 'number') {
    if (MONEY.test(field)) return 'money';
    if (/percentage$/.test(field)) return 'percent';
    return 'int';
  }
  return field === 'image' || field.endsWith('_url') ? 'url' : 'text';
}

interface AddressLike {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
}

const isAddress = (v: unknown): v is AddressLike => !!v && typeof v === 'object' && 'line1' in v && 'country' in v;

/** An address on one line: street, city, state and postcode, country. */
export const addressLine = (a: AddressLike) =>
  [a.line1, a.line2, a.city, [a.state, a.postcode].filter(Boolean).join(' '), a.country].filter(Boolean).join(', ');

function number(n: number, locale: string | undefined, options: Intl.NumberFormatOptions): string {
  try {
    return new Intl.NumberFormat(locale, options).format(n);
  } catch {
    return new Intl.NumberFormat(undefined, options).format(n);
  }
}

/** The text a value shows as, by its field's type or `data-next-format`. */
export function display(field: string, value: unknown, engine: Engine, override?: string | null): string {
  if (value === undefined || value === null) return '';
  if (isAddress(value)) return addressLine(value);
  if (Array.isArray(value)) return String(value.length);
  if (typeof value === 'object') return '';
  const campaign = engine.getState().campaign;
  const currency = campaign?.currency;
  const locale = localeOf(engine.getState());
  const n = Number(value);
  switch (override) {
    case 'currency_code':
      return currency ? `${format({ type: 'money', value: n }, currency, locale)} ${currency}` : n.toFixed(2);
    case 'currency_rounded':
      return currency
        ? number(n, locale, {
            style: 'currency',
            currency,
            currencyDisplay: 'narrowSymbol',
            maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
          })
        : String(n);
    case 'number':
      return number(n, locale, { maximumFractionDigits: 2 });
    case 'phone':
      return phoneText(String(value));
    case 'address':
      return String(value);
  }
  const v: Value = { type: fieldType(field, value), value: value as Value['value'] };
  if (!override && v.type === 'int' && !Number.isInteger(n)) return number(n, locale, { maximumFractionDigits: 2 });
  return format(v, currency, locale, override);
}

/** Truthiness of a model value: an empty list, `0`, `''`, `'false'` and `'0'` are false. */
export function truthy(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (value === undefined || value === null || value === false) return false;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value !== '' && value !== 'false' && value !== '0';
  return true;
}

/** Writes a value into an element by its kind: an image's `src`, a link's `href`, a control's `value`, or text. */
export function write(el: HTMLElement, field: string, value: unknown, engine: Engine, override?: string | null): void {
  const empty = el.getAttribute('data-next-empty') ?? '';
  const text = display(field, value, engine, override);
  if (el instanceof HTMLImageElement || el instanceof HTMLSourceElement) {
    const src = typeof value === 'string' ? value : '';
    const attr = el instanceof HTMLSourceElement ? 'srcset' : 'src';
    if (src && el.getAttribute(attr) !== src) el.setAttribute(attr, src);
    return;
  }
  if (el instanceof HTMLAnchorElement) {
    if (typeof value === 'string' && value && el.getAttribute('href') !== value) el.setAttribute('href', value);
    return;
  }
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    if (el.value !== text) el.value = text;
    return;
  }
  const shown = text === '' ? empty : text;
  if (el.textContent !== shown || el.children.length) el.textContent = shown;
}
