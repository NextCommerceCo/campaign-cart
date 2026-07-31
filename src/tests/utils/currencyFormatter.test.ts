import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  CurrencyFormatter,
  formatCurrency,
  formatNumber,
  formatPercentage,
  getCurrencySymbol,
  formatDiscountPercentage,
} from '@/utils/currencyFormatter';
import { useCampaignStore } from '@/state/campaign/index';
import { useConfigStore } from '@/state/config.state';

// Pin locale so Intl output is deterministic across environments.
const LOCALE = 'en-US';

beforeEach(() => {
  sessionStorage.setItem('next_selected_locale', LOCALE);
  CurrencyFormatter.clearCache();
});

afterEach(() => {
  sessionStorage.removeItem('next_selected_locale');
  CurrencyFormatter.clearCache();
  // Reset store currency between tests
  useCampaignStore.setState({ currency: null });
  useConfigStore.setState({ selectedCurrency: '', detectedCurrency: '' });
});

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Build the expected string via the same Intl path the formatter uses */
function intl(
  value: number,
  currency: string,
  opts?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    ...opts,
  }).format(value);
}

// ─── formatCurrency ───────────────────────────────────────────────────────────

describe('formatCurrency', () => {
  describe('numeric input', () => {
    it('formats a whole dollar amount', () => {
      expect(formatCurrency(10, 'USD')).toBe(intl(10, 'USD'));
    });

    it('formats a decimal amount', () => {
      expect(formatCurrency(10.5, 'USD')).toBe(intl(10.5, 'USD'));
    });

    it('formats zero', () => {
      expect(formatCurrency(0, 'USD')).toBe(intl(0, 'USD'));
    });

    it('formats negative values', () => {
      expect(formatCurrency(-5.99, 'USD')).toBe(intl(-5.99, 'USD'));
    });

    it('formats large amounts with thousands separator', () => {
      expect(formatCurrency(1_234_567.89, 'USD')).toBe(
        intl(1_234_567.89, 'USD')
      );
    });

    it('rounds sub-cent values to two decimals', () => {
      expect(formatCurrency(0.001, 'USD')).toBe(intl(0.001, 'USD'));
    });
  });

  describe('string input', () => {
    it('parses a numeric string', () => {
      expect(formatCurrency('19.99', 'USD')).toBe(intl(19.99, 'USD'));
    });

    it('parses "0"', () => {
      expect(formatCurrency('0', 'USD')).toBe(intl(0, 'USD'));
    });

    it('parses a string with trailing zeros', () => {
      expect(formatCurrency('10.00', 'USD')).toBe(intl(10, 'USD'));
    });

    it('returns empty string for non-numeric string', () => {
      expect(formatCurrency('abc', 'USD')).toBe('');
    });

    it('returns empty string for empty string', () => {
      expect(formatCurrency('', 'USD')).toBe('');
    });
  });

  describe('NaN / invalid', () => {
    it('returns empty string for NaN', () => {
      expect(formatCurrency(NaN, 'USD')).toBe('');
    });

    it('passes Infinity to Intl (isNaN(Infinity) is false) — produces ∞ symbol', () => {
      // The implementation only guards against NaN, not Infinity.
      // Intl.NumberFormat renders Infinity as the ∞ character.
      expect(formatCurrency(Infinity, 'USD')).toContain('∞');
    });

    it('passes -Infinity to Intl — produces negative ∞ symbol', () => {
      expect(formatCurrency(-Infinity, 'USD')).toContain('∞');
    });
  });

  describe('currency codes', () => {
    it('formats EUR', () => {
      expect(formatCurrency(10, 'EUR')).toBe(intl(10, 'EUR'));
    });

    it('formats GBP', () => {
      expect(formatCurrency(10, 'GBP')).toBe(intl(10, 'GBP'));
    });

    it('formats JPY (zero decimal places)', () => {
      expect(formatCurrency(1000, 'JPY')).toBe(intl(1000, 'JPY'));
    });

    it('formats THB', () => {
      expect(formatCurrency(100, 'THB')).toBe(intl(100, 'THB'));
    });

    it('formats AUD', () => {
      expect(formatCurrency(10, 'AUD')).toBe(intl(10, 'AUD'));
    });
  });

  describe('hideZeroCents option', () => {
    it('hides .00 on whole-dollar amounts', () => {
      const result = formatCurrency(10, 'USD', { hideZeroCents: true });
      expect(result).not.toContain('.00');
      expect(result).toContain('10');
    });

    it('keeps cents when non-zero', () => {
      const result = formatCurrency(10.5, 'USD', { hideZeroCents: true });
      expect(result).toContain('.5');
    });

    it('keeps two decimal places for non-zero cents', () => {
      const result = formatCurrency(10.99, 'USD', { hideZeroCents: true });
      expect(result).toBe(
        intl(10.99, 'USD', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        })
      );
    });

    it('keeps standard formatting when hideZeroCents is false', () => {
      expect(formatCurrency(10, 'USD', { hideZeroCents: false })).toBe(
        intl(10, 'USD')
      );
    });
  });

  describe('auto-currency from stores', () => {
    it('uses campaign store currency when no currency arg is given', () => {
      useCampaignStore.setState({ currency: 'EUR' });
      CurrencyFormatter.clearCache();
      const result = formatCurrency(10);
      expect(result).toBe(intl(10, 'EUR'));
    });

    it('falls back to config store currency when campaign store has no currency', () => {
      useCampaignStore.setState({ currency: null });
      useConfigStore.setState({ selectedCurrency: 'GBP' });
      CurrencyFormatter.clearCache();
      const result = formatCurrency(10);
      expect(result).toBe(intl(10, 'GBP'));
    });

    it('explicit currency argument overrides store currency', () => {
      useCampaignStore.setState({ currency: 'EUR' });
      CurrencyFormatter.clearCache();
      expect(formatCurrency(10, 'USD')).toBe(intl(10, 'USD'));
    });
  });

  describe('formatter caching', () => {
    it('produces the same output on repeated calls (cached formatter)', () => {
      const a = formatCurrency(10, 'USD');
      const b = formatCurrency(10, 'USD');
      expect(a).toBe(b);
    });

    it('produces correct output after clearCache', () => {
      const before = formatCurrency(10, 'USD');
      CurrencyFormatter.clearCache();
      const after = formatCurrency(10, 'USD');
      expect(after).toBe(before);
    });

    it('creates separate caches for hideZeroCents true/false', () => {
      const normal = formatCurrency(10, 'USD');
      const noZero = formatCurrency(10, 'USD', { hideZeroCents: true });
      expect(normal).not.toBe(noZero);
    });
  });

  describe('locale awareness', () => {
    it('uses sessionStorage locale override', () => {
      // Already set to en-US in beforeEach — output is deterministic.
      expect(formatCurrency(1000, 'USD')).toBe(intl(1000, 'USD'));
    });

    it('rebuilds formatter after locale override changes', () => {
      sessionStorage.setItem('next_selected_locale', 'de-DE');
      CurrencyFormatter.clearCache();
      const result = formatCurrency(10, 'EUR');
      // de-DE formats EUR differently than en-US; just verify it doesn't throw.
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      // Restore
      sessionStorage.setItem('next_selected_locale', LOCALE);
      CurrencyFormatter.clearCache();
    });
  });
});

// ─── formatNumber ─────────────────────────────────────────────────────────────

describe('formatNumber', () => {
  it('formats an integer with thousands separator', () => {
    expect(formatNumber(1000)).toBe(
      new Intl.NumberFormat(LOCALE, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(1000)
    );
  });

  it('formats a decimal', () => {
    expect(formatNumber(1234.5)).toBe(
      new Intl.NumberFormat(LOCALE, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(1234.5)
    );
  });

  it('truncates to max 2 decimal places', () => {
    const result = formatNumber(1.999);
    expect(result).toBe(
      new Intl.NumberFormat(LOCALE, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(1.999)
    );
  });

  it('formats zero', () => {
    expect(formatNumber(0)).toBe('0');
  });

  it('formats negative', () => {
    expect(formatNumber(-42)).toBe('-42');
  });

  it('parses a numeric string', () => {
    expect(formatNumber('500')).toBe('500');
  });

  it('parses a decimal string', () => {
    expect(formatNumber('1234.5')).toBe(
      new Intl.NumberFormat(LOCALE, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(1234.5)
    );
  });

  it('returns empty string for NaN', () => {
    expect(formatNumber(NaN)).toBe('');
  });

  it('returns empty string for non-numeric string', () => {
    expect(formatNumber('abc')).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(formatNumber('')).toBe('');
  });

  it('passes Infinity to Intl (isNaN(Infinity) is false) — produces ∞ symbol', () => {
    expect(formatNumber(Infinity)).toContain('∞');
  });
});

// ─── formatPercentage ────────────────────────────────────────────────────────

describe('formatPercentage', () => {
  it('formats an integer percentage', () => {
    expect(formatPercentage(10)).toBe('10%');
  });

  it('formats zero', () => {
    expect(formatPercentage(0)).toBe('0%');
  });

  it('formats 100%', () => {
    expect(formatPercentage(100)).toBe('100%');
  });

  it('rounds fractional value to 0 decimals by default', () => {
    expect(formatPercentage(10.6)).toBe('11%');
    expect(formatPercentage(10.4)).toBe('10%');
  });

  it('respects decimals=1', () => {
    expect(formatPercentage(10.55, 1)).toBe('10.6%');
  });

  it('respects decimals=2', () => {
    expect(formatPercentage(10.555, 2)).toBe('10.56%');
  });

  it('formats negative percentages', () => {
    expect(formatPercentage(-5)).toBe('-5%');
  });

  it('formats negative with decimals', () => {
    expect(formatPercentage(-5.25, 2)).toBe('-5.25%');
  });

  it('formats 0 with decimals', () => {
    expect(formatPercentage(0, 2)).toBe('0%');
  });

  it('formats a large percentage', () => {
    expect(formatPercentage(150)).toBe('150%');
  });
});

// ─── getCurrencySymbol ────────────────────────────────────────────────────────

describe('getCurrencySymbol', () => {
  it('returns $ for USD', () => {
    expect(getCurrencySymbol('USD')).toBe('$');
  });

  it('returns € for EUR', () => {
    expect(getCurrencySymbol('EUR')).toBe('€');
  });

  it('returns £ for GBP', () => {
    expect(getCurrencySymbol('GBP')).toBe('£');
  });

  it('returns ¥ for JPY', () => {
    expect(getCurrencySymbol('JPY')).toBe('¥');
  });

  it('returns a non-empty string for any valid ISO 4217 code', () => {
    const symbol = getCurrencySymbol('THB');
    expect(typeof symbol).toBe('string');
    expect(symbol.length).toBeGreaterThan(0);
  });

  it('uses campaign store currency when no arg given', () => {
    useCampaignStore.setState({ currency: 'EUR' });
    CurrencyFormatter.clearCache();
    expect(getCurrencySymbol()).toBe('€');
  });
});

// ─── isAlreadyFormatted ───────────────────────────────────────────────────────

describe('CurrencyFormatter.isAlreadyFormatted', () => {
  it('returns true when string contains the currency symbol', () => {
    expect(CurrencyFormatter.isAlreadyFormatted('$10.00', 'USD')).toBe(true);
  });

  it('returns false when string is a bare number', () => {
    expect(CurrencyFormatter.isAlreadyFormatted('10.00', 'USD')).toBe(false);
  });

  it('returns true for EUR symbol', () => {
    expect(CurrencyFormatter.isAlreadyFormatted('€10.00', 'EUR')).toBe(true);
  });

  it('returns false when symbol belongs to a different currency', () => {
    expect(CurrencyFormatter.isAlreadyFormatted('€10.00', 'USD')).toBe(false);
  });

  it('returns false for a non-string value', () => {
    expect(CurrencyFormatter.isAlreadyFormatted(10 as any, 'USD')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(CurrencyFormatter.isAlreadyFormatted('', 'USD')).toBe(false);
  });

  it('returns false for undefined cast to any', () => {
    expect(CurrencyFormatter.isAlreadyFormatted(undefined as any, 'USD')).toBe(
      false
    );
  });

  it('is case-sensitive for symbol matching (no false positives)', () => {
    // "USD 10.00" doesn't contain "$" — should be false
    expect(CurrencyFormatter.isAlreadyFormatted('USD 10.00', 'USD')).toBe(
      false
    );
  });
});

// ─── clearCache ───────────────────────────────────────────────────────────────

describe('CurrencyFormatter.clearCache', () => {
  it('does not crash when cache is already empty', () => {
    CurrencyFormatter.clearCache();
    expect(() => CurrencyFormatter.clearCache()).not.toThrow();
  });

  it('clears formatters so new locale is picked up', () => {
    const before = formatCurrency(10, 'USD');
    sessionStorage.setItem('next_selected_locale', 'fr-FR');
    CurrencyFormatter.clearCache();
    const after = formatCurrency(10, 'USD');
    // fr-FR formats EUR differently; at minimum the cache was cleared
    expect(typeof after).toBe('string');
    expect(after.length).toBeGreaterThan(0);
    // Restore
    sessionStorage.setItem('next_selected_locale', LOCALE);
    CurrencyFormatter.clearCache();
    expect(formatCurrency(10, 'USD')).toBe(before);
  });
});

// ─── formatDiscountPercentage ─────────────────────────────────────────────────

describe('formatDiscountPercentage', () => {
  describe('invalid / empty inputs', () => {
    it('returns empty string for undefined', () => {
      expect(formatDiscountPercentage(undefined)).toBe('');
    });

    it('returns empty string for empty string', () => {
      expect(formatDiscountPercentage('')).toBe('');
    });

    it('returns empty string for non-numeric string', () => {
      expect(formatDiscountPercentage('abc')).toBe('');
    });

    it('returns empty string for NaN string', () => {
      expect(formatDiscountPercentage('NaN')).toBe('');
    });

    it('returns empty string for Infinity string', () => {
      expect(formatDiscountPercentage('Infinity')).toBe('');
    });
  });

  describe('integer values', () => {
    it('formats 0', () => {
      expect(formatDiscountPercentage('0')).toBe('0%');
    });

    it('formats a typical discount', () => {
      expect(formatDiscountPercentage('10')).toBe('10%');
    });

    it('formats 100', () => {
      expect(formatDiscountPercentage('100')).toBe('100%');
    });

    it('treats "10.00" as integer (parseFloat collapses trailing zeros)', () => {
      expect(formatDiscountPercentage('10.00')).toBe('10%');
    });

    it('treats "10.0" as integer', () => {
      expect(formatDiscountPercentage('10.0')).toBe('10%');
    });
  });

  describe('fractional values', () => {
    it('formats 10.5 with two decimals', () => {
      expect(formatDiscountPercentage('10.5')).toBe('10.5%');
    });

    it('rounds 12.345 to two decimals', () => {
      expect(formatDiscountPercentage('12.345')).toBe('12.35%');
    });

    it('rounds 12.344 to two decimals', () => {
      expect(formatDiscountPercentage('12.344')).toBe('12.34%');
    });

    it('formats 0.5', () => {
      expect(formatDiscountPercentage('0.5')).toBe('0.5%');
    });
  });

  describe('negative values', () => {
    it('formats -5 as integer', () => {
      expect(formatDiscountPercentage('-5')).toBe('-5%');
    });

    it('formats -5.25 as fractional', () => {
      expect(formatDiscountPercentage('-5.25')).toBe('-5.25%');
    });
  });

  describe('parseFloat edge cases', () => {
    it('parses strings with leading whitespace', () => {
      expect(formatDiscountPercentage(' 10')).toBe('10%');
    });

    it('parses strings with trailing non-numeric characters', () => {
      expect(formatDiscountPercentage('10abc')).toBe('10%');
    });

    it('returns empty string for strings starting with letters', () => {
      expect(formatDiscountPercentage('abc10')).toBe('');
    });
  });
});
