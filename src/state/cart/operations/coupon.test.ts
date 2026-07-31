import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useCheckoutStore } from '@/state/checkout';
import { useCartStore } from '@/state/cart';
import { applyCoupon } from './apply-coupon';
import { removeCoupon } from './remove-coupon';

/**
 * Regression coverage for code-findings.md #4: `applyCoupon` normalises the
 * code it stores (`toUpperCase().trim()`), but `removeCoupon` used to pass
 * the raw string straight into `removeVoucher`'s `v !== code` filter. So
 * `applyCoupon('save10')` followed by `removeCoupon('save10')` removed
 * nothing and reported no error, while `calculateTotals()` still ran and the
 * shopper kept a discount the page believed it had removed.
 *
 * Fake timers keep `calculateTotals`'s 150ms debounce from ever firing during
 * the test (no timer is advanced), so no network mocking is needed — the
 * synchronous `isCalculating` flip it does before scheduling is enough to
 * prove a recalculation was triggered.
 */
describe('apply-coupon / remove-coupon round trip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useCheckoutStore.getState().reset();
    useCartStore.getState().reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('removes a coupon applied and removed with the exact same casing', async () => {
    await applyCoupon('save10');
    expect(useCheckoutStore.getState().vouchers).toEqual(['SAVE10']);

    await removeCoupon('save10');

    expect(useCheckoutStore.getState().vouchers).toEqual([]);
    expect(useCartStore.getState().isCalculating).toBe(true);
  });

  it('removes a coupon applied lower-case when removed upper-case', async () => {
    await applyCoupon('save10');

    await removeCoupon('SAVE10');

    expect(useCheckoutStore.getState().vouchers).toEqual([]);
  });

  it('removes a coupon regardless of surrounding whitespace and mixed case', async () => {
    await applyCoupon('save10');

    await removeCoupon(' Save10 ');

    expect(useCheckoutStore.getState().vouchers).toEqual([]);
  });

  it('treats differently-cased codes as the same coupon on a second apply', async () => {
    await applyCoupon('save10');

    const result = await applyCoupon('SAVE10');

    expect(result).toEqual({
      success: false,
      message: 'Coupon already applied',
    });
    expect(useCheckoutStore.getState().vouchers).toEqual(['SAVE10']);
  });
});
