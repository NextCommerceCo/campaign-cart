import { describe, it, expect } from 'vitest';
import { formatDiscountPercentage } from '@/utils/currencyFormatter';

describe('formatDiscountPercentage', () => {
  it('returns empty string for undefined', () => {
    expect(formatDiscountPercentage(undefined)).toBe('');
  });

  it('returns empty string for empty input', () => {
    expect(formatDiscountPercentage('')).toBe('');
  });

  it('returns empty string for non-numeric input', () => {
    expect(formatDiscountPercentage('abc')).toBe('');
  });

  it('formats integer percentages with no decimals', () => {
    expect(formatDiscountPercentage('10')).toBe('10%');
    expect(formatDiscountPercentage('100')).toBe('100%');
    expect(formatDiscountPercentage('0')).toBe('0%');
  });

  it('formats fractional percentages rounded to two decimals (no zero padding)', () => {
    // formatPercentage uses Math.round + number coercion, so trailing zeros
    // are dropped. `10.5` stays `10.5%`, `12.345` rounds to `12.35%`.
    expect(formatDiscountPercentage('10.5')).toBe('10.5%');
    expect(formatDiscountPercentage('12.345')).toBe('12.35%');
  });

  it('treats trailing-zero decimals as integers (parseFloat collapses "10.00" to 10)', () => {
    expect(formatDiscountPercentage('10.00')).toBe('10%');
  });

  it('handles negative percentages', () => {
    expect(formatDiscountPercentage('-5')).toBe('-5%');
    expect(formatDiscountPercentage('-5.25')).toBe('-5.25%');
  });

  it('parses numeric strings with leading/trailing whitespace via parseFloat', () => {
    // parseFloat tolerates leading whitespace and trailing garbage.
    expect(formatDiscountPercentage(' 10')).toBe('10%');
    expect(formatDiscountPercentage('10abc')).toBe('10%');
  });
});
