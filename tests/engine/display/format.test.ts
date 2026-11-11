import { afterEach, describe, expect, it } from 'vitest';
import {
  addDollars,
  cents,
  dollars,
  formatCents,
  moneyText,
  pct,
  percentOf,
  savings,
  useCurrencyFormats,
} from '../../../src/engine/display/format';
import type { Campaign } from '../../../src/engine/types';

describe('money helpers', () => {
  it('reads API amounts as cents and dollars', () => {
    expect(cents('19.99')).toBe(1999);
    expect(cents(undefined)).toBe(0);
    expect(dollars('19.995')).toBe(20);
    expect(dollars(0.1 + 0.2)).toBe(0.3);
  });

  it('adds dollar amounts without float drift', () => {
    expect(addDollars([0.1, 0.2])).toBe(0.3);
    expect(addDollars([])).toBe(0);
  });

  it("formats cents in the campaign's currency, in the page's language over the campaign's", () => {
    const campaign = { currency: 'EUR', language: 'en' } as Campaign;
    expect(formatCents(1999, { campaign })).toBe('€19.99');
    expect(formatCents(1999, { campaign, locale: 'de-DE' })).toBe('19,99 €');
    expect(formatCents(1999, {})).toBe('19.99');
  });

  it('takes a share of a whole: unrounded for display, to two decimals for events, 0 of nothing', () => {
    expect(pct(1, 3).value).toBeCloseTo(33.3333333);
    expect(percentOf(1, 3)).toBe(33.33);
    expect([pct(5, 0).value, percentOf(5, 0)]).toEqual([0, 0]);
    expect([savings(12, 10), savings(10, 12)]).toEqual([2, 0]);
  });
});

describe('currency formats', () => {
  afterEach(() => useCurrencyFormats());

  const shown = (locale: string, currencies: string[]) => currencies.map((c) => moneyText(49.9, c, locale));
  const own = (format: string, currency = 'CAD', lang = 'en') => {
    useCurrencyFormats({ [lang]: { [`formats.currency.${currency}`]: format } });
    return moneyText(49.9, currency, lang);
  };

  it('tells the dollars with a prefix of their own from USD in a language without a region', () => {
    expect(shown('en', ['CAD', 'AUD', 'NZD', 'HKD', 'MXN'])).toEqual([
      'CA$49.90',
      'A$49.90',
      'NZ$49.90',
      'HK$49.90',
      'MX$49.90',
    ]);
  });

  it('shows the bare sign for the currency of the page language’s own region', () => {
    expect(shown('en-CA', ['CAD', 'AUD'])).toEqual(['$49.90', 'A$49.90']);
    expect(shown('en-AU', ['AUD', 'USD'])).toEqual(['$49.90', '$49.90']);
    expect(shown('es-MX', ['MXN', 'USD'])).toEqual(['$49.90', '$49.90']);
  });

  it('leaves every other currency on the narrow symbol', () => {
    expect(shown('en', ['USD', 'SGD', 'EUR', 'GBP', 'JPY'])).toEqual(['$49.90', '$49.90', '€49.90', '£49.90', '¥50']);
  });

  it('shows a currency the way the page’s formats.currency.<code> names it', () => {
    expect(own('narrowSymbol')).toBe('$49.90');
    expect(own('code')).toMatch(/^CAD\s49\.90$/);
    expect(own('symbol', 'SGD')).toMatch(/^SGD\s49\.90$/);
    expect(moneyText(49.9, 'AUD', 'en')).toBe('A$49.90');
  });

  it('fills a pattern’s {amount}, {symbol}, {narrowSymbol} and {code}', () => {
    expect(own('C${amount}')).toBe('C$49.90');
    expect(own('{narrowSymbol}{amount} {code}')).toBe('$49.90 CAD');
    expect(own('{symbol}{amount}')).toBe('CA$49.90');
    expect(own('{amount} kr', 'SEK')).toBe('49.90 kr');
    expect(own('{amount} {code}', 'EUR', 'de')).toBe('49,90 EUR');
    useCurrencyFormats({ en: { 'formats.currency.JPY': '{amount}円' } });
    expect(moneyText(5000, 'JPY', 'en')).toBe('5,000円');
  });

  it('reads the format in the page’s language, the base language for a regional one', () => {
    useCurrencyFormats({ en: { 'formats.currency.CAD': 'C${amount}' }, 'fr-ca': { 'formats.currency.CAD': 'code' } });
    expect(moneyText(49.9, 'CAD', 'en-CA')).toBe('C$49.90');
    expect(moneyText(49.9, 'CAD', undefined)).toBe('C$49.90');
    expect(moneyText(49.9, 'CAD', 'fr-CA')).toMatch(/^49,90\sCAD$/);
    expect(moneyText(49.9, 'CAD', 'de')).toMatch(/^49,90\sCA\$$/);
  });

  it('ignores a value that is neither a display name nor a pattern with {amount}', () => {
    expect(own('name')).toBe('CA$49.90');
    expect(own('{symbol}')).toBe('CA$49.90');
    expect(own('')).toBe('CA$49.90');
  });

  it('reads a later source for a currency the first has no format for', () => {
    useCurrencyFormats({ en: { 'formats.currency.CAD': 'code?' } }, { en: { 'formats.currency.CAD': 'C${amount}' } });
    expect(moneyText(49.9, 'CAD', 'en')).toBe('C$49.90');
    useCurrencyFormats({ en: { 'formats.currency.CAD': 'narrowSymbol' } }, { en: { 'formats.currency.CAD': 'code' } });
    expect(moneyText(49.9, 'CAD', 'en')).toBe('$49.90');
  });
});
