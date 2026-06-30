import { describe, it, expect } from 'vitest';
import { reconcileValue } from '@/utils/analytics/validation/reconcileValue';

// reconcileValue is the single source of truth shared by the runtime
// EventValidator and the debug EcommerceEventValidator.
//
// GA4 rule (all events, purchase included): value === Σ(price × quantity).
// Tax and shipping are NEVER part of value — they have their own fields.

describe('reconcileValue', () => {
  it('reconciles when itemsTotal equals value exactly', () => {
    expect(reconcileValue(30, 30).reconciles).toBe(true);
  });

  it('reconciles regardless of tax/shipping fields (they are not part of value)', () => {
    // A purchase with tax 10 + shipping 5, value = item revenue 100. Correct.
    expect(reconcileValue(100, 100, 10, 5).reconciles).toBe(true);
  });

  it('flags a genuine item/value mismatch', () => {
    expect(reconcileValue(50, 30).reconciles).toBe(false);
  });

  describe('diagnosis of a value that wrongly includes tax/shipping', () => {
    it('detects value inflated by shipping', () => {
      // items 100, value 105, shipping 5 → value = items + shipping (the bug).
      const r = reconcileValue(100, 105, 0, 5);
      expect(r.reconciles).toBe(false);
      expect(r.diagnosis).toMatch(/includes shipping/);
    });

    it('detects value inflated by tax + shipping (the grand-total mistake)', () => {
      // items 100, value 115, tax 10, shipping 5 → value = grand total.
      const r = reconcileValue(100, 115, 10, 5);
      expect(r.reconciles).toBe(false);
      expect(r.diagnosis).toMatch(/includes tax.*and shipping/);
    });

    it('detects value inflated by tax only', () => {
      const r = reconcileValue(100, 110, 10, 0);
      expect(r.reconciles).toBe(false);
      expect(r.diagnosis).toMatch(/includes tax/);
    });

    it('leaves diagnosis undefined when the gap is unexplained', () => {
      // 350 vs 70 with no tax/shipping — not a tax/shipping inflation.
      const r = reconcileValue(350, 70);
      expect(r.reconciles).toBe(false);
      expect(r.diagnosis).toBeUndefined();
    });
  });

  describe('tolerance', () => {
    it('absorbs sub-cent rounding drift', () => {
      expect(reconcileValue(30.004, 30).reconciles).toBe(true);
    });

    it('scales with order size (0.5% relative)', () => {
      // 0.4% of a 10,000 order = 40, within tolerance.
      expect(reconcileValue(10040, 10000).reconciles).toBe(true);
      // 1% = 100, outside tolerance.
      expect(reconcileValue(10100, 10000).reconciles).toBe(false);
    });
  });
});
