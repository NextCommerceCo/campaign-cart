import { setSource } from '../dom/dom';
import type { Engine } from '../engine/engine';
import { format, localeOf, type Value, type ValueType } from '../engine/display/format';
import type { Address } from '../engine/events/checkout';
import { formatAddress, LINE_LAYOUT, phoneText } from '../engine/order/address-line';

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

const isAddress = (v: unknown): v is Partial<Address> => !!v && typeof v === 'object' && 'line1' in v && 'country' in v;

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
  if (isAddress(value)) return formatAddress(value, LINE_LAYOUT);
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

/** Writes a value into an element by its kind: an image's `src`, a link's `href`, a control's `value`, or text. */
export function write(el: HTMLElement, field: string, value: unknown, engine: Engine, override?: string | null): void {
  const empty = el.getAttribute('data-next-empty') ?? '';
  const text = display(field, value, engine, override);
  if (el instanceof HTMLImageElement || el instanceof HTMLSourceElement)
    return setSource(el, typeof value === 'string' && value);
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
