import type { State } from '../types';
import { textsIn, type Texts } from './texts';

export type ValueType = 'money' | 'percent' | 'int' | 'text' | 'bool' | 'url';

export interface Value {
  type: ValueType;
  value: string | number | boolean | undefined;
  /** Being re-priced: keep what is on screen. */
  held?: boolean;
}

type Amount = string | number | null | undefined;

export const cents = (amount: Amount): number => Math.round(Number(amount ?? 0) * 100);
export const dollars = (amount: Amount): number => cents(amount) / 100;
export const addDollars = (amounts: number[]): number => Math.round(amounts.reduce((n, a) => n + a * 100, 0)) / 100;
export const money = (c: number | undefined): Value => ({
  type: 'money',
  value: c === undefined ? undefined : c / 100,
});
/** `part` as a fraction of `whole`; 0 when there is no whole. */
export const share = (part: number, whole: number): number => (whole > 0 ? part / whole : 0);
/** What paying `paid` saves on `compare`, never below 0. */
export const savings = (compare: number, paid: number): number => Math.max(0, compare - paid);
export const pct = (part: number, whole: number): Value => ({ type: 'percent', value: share(part, whole) * 100 });
/** A percentage with two decimals, as events carry it. */
export const percentOf = (part: number, whole: number): number => Math.round(share(part, whole) * 10000) / 100;
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

type TextsByLanguage = Readonly<Record<string, Texts>>;

const FORMAT = /^(narrowSymbol|symbol|code)$|\{amount\}/;
let sources: TextsByLanguage[] = [];

/** Where `formats.currency.<code>` is read, the first source with a format first: texts by language. */
export const useCurrencyFormats = (...texts: TextsByLanguage[]): void => {
  sources = texts;
};

/**
 * `n` in `currency` as `as` says: an Intl `currencyDisplay`, or a pattern of `{amount}`, `{symbol}`,
 * `{narrowSymbol}` and `{code}`. Without `as`: the page's `formats.currency.<code>`, else `symbol` for
 * CAD, AUD, NZD, HKD and MXN and `narrowSymbol` for every other currency.
 */
export function moneyText(
  n: number,
  currency: string,
  locale?: string,
  options?: Intl.NumberFormatOptions,
  as = sources
    .map((texts) => textsIn(texts, locale || 'en')[`formats.currency.${currency}`])
    .find((text) => FORMAT.test(text!)) ?? (/^(CA|AU|NZ|HK)D$|^MXN$/.test(currency) ? 'symbol' : 'narrowSymbol'),
): string {
  const money = (currencyDisplay: string) =>
    formatter(locale, { ...options, style: 'currency', currency, currencyDisplay: currencyDisplay as never });
  return as.includes('{')
    ? as.replace(/\{(amount|narrowSymbol|symbol|code)\}/g, (_, name: string) =>
        money(name === 'amount' ? 'code' : name)
          .formatToParts(n)
          .map((p) => (p.type !== 'literal' && (p.type === 'currency') === (name !== 'amount') ? p.value : ''))
          .join(''),
      )
    : money(as).format(n);
}

export function format(v: Value, currency: string | undefined, locale?: string, override?: string | null): string {
  if (v.value === undefined || v.value === null) return '';
  const type = override === 'currency' ? 'money' : override === 'percentage' ? 'percent' : v.type;
  const n = Number(v.value);
  switch (type) {
    case 'money':
      return currency ? moneyText(n, currency, locale) : n.toFixed(2);
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

/** The language prices and texts are written in: the page's, else the campaign's. */
export const localeOf = (state: Pick<State, 'locale' | 'campaign'>) => state.locale || state.campaign?.language;

export const formatCents = (c: number, state: Pick<State, 'locale' | 'campaign'>): string =>
  format(money(c), state.campaign?.currency, localeOf(state));

export function discountPercent(value: string | undefined, locale?: string): string {
  const n = Number(value);
  if (!value || !Number.isFinite(n)) return '';
  return formatter(locale, { style: 'percent', maximumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n / 100);
}

/** Truthiness of a shown value: an empty list, `0`, `''`, `'false'` and `'0'` are false. */
export function truthyValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (value === undefined || value === null || value === false) return false;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value !== '' && value !== 'false' && value !== '0';
  return true;
}

export const truthy = (v: Value | undefined): boolean => truthyValue(v?.value);
