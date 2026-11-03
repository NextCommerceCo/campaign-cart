export type ValueType = 'money' | 'percent' | 'int' | 'text' | 'bool' | 'url';

export interface Value {
  type: ValueType;
  value: string | number | boolean | undefined;
}

export const cents = (amount: string | number | undefined): number => Math.round(Number(amount ?? 0) * 100);
export const money = (c: number | undefined): Value => ({
  type: 'money',
  value: c === undefined ? undefined : c / 100,
});
export const pct = (part: number, whole: number): Value => ({
  type: 'percent',
  value: whole > 0 ? (part / whole) * 100 : 0,
});
export const bool = (value: boolean): Value => ({ type: 'bool', value });

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(locale: string | undefined, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let f = formatters.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat(locale, options);
    } catch {
      f = new Intl.NumberFormat(undefined, options);
    }
    formatters.set(key, f);
  }
  return f;
}

export function format(v: Value, currency: string | undefined, locale?: string, override?: string | null): string {
  if (v.value === undefined || v.value === null) return '';
  const type = override === 'currency' ? 'money' : override === 'percentage' ? 'percent' : v.type;
  const n = Number(v.value);
  switch (type) {
    case 'money':
      return currency
        ? formatter(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).format(n)
        : n.toFixed(2);
    case 'percent':
      return formatter(locale, { style: 'percent', maximumFractionDigits: 0 }).format(n / 100);
    case 'int':
      return formatter(locale, { maximumFractionDigits: 0 }).format(n);
    case 'bool':
      return v.value ? 'true' : 'false';
    default:
      return String(v.value);
  }
}

export function discountPercent(value: string | undefined, locale?: string): string {
  const n = Number(value);
  if (!value || !Number.isFinite(n)) return '';
  return formatter(locale, { style: 'percent', maximumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n / 100);
}

export function truthy(v: Value | undefined): boolean {
  if (!v || v.value === undefined || v.value === null) return false;
  if (typeof v.value === 'boolean') return v.value;
  if (typeof v.value === 'number') return v.value !== 0;
  return v.value !== '' && v.value !== 'false' && v.value !== '0';
}
