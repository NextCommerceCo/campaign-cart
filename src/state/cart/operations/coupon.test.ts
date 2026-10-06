import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useCheckoutStore } from '@/state/checkout';
import { useCartStore } from '@/state/cart';
import {
  calculateCart,
  type CalculateCartParams,
  type CalculateCartResult,
} from '@/state/cart/cart-calculator';
import type { CartItem } from '@/types/global';
import type { CartSummary, Discount } from '@/types/api';
import { applyCoupon } from './apply-coupon';
import { removeCoupon } from './remove-coupon';

vi.mock('@/state/cart/cart-calculator', async importOriginal => ({
  ...(await importOriginal<object>()),
  calculateCart: vi.fn(),
}));

// The only other request is the address-rules service's texts; refused, the
// messages are the English fallbacks asserted below.
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Regression coverage: `applyCoupon` normalises the code it stores
 * (`toUpperCase().trim()`), but `removeCoupon` used to pass the raw string
 * straight into `removeVoucher`'s `v !== code` filter. So
 * `applyCoupon('save10')` followed by `removeCoupon('save10')` removed nothing
 * and reported no error, while `calculateTotals()` still ran and the shopper
 * kept a discount the page believed it had removed.
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
      message: 'Coupon SAVE10 is already applied.',
    });
    expect(useCheckoutStore.getState().vouchers).toEqual(['SAVE10']);
  });
});

describe('applyCoupon voucher check against the calculate response', () => {
  const SAVE10: Discount = { offer_id: 7, amount: '8.10', name: 'Save 10%' };

  // `vouchers -> voucher_discounts`, the only part of the response the check reads.
  const respondWith = (discountsFor: (vouchers: string[]) => Discount[]) =>
    vi.mocked(calculateCart).mockImplementation(
      async (params: CalculateCartParams) =>
        ({
          vouchers: params.vouchers ?? [],
          summary: {
            voucher_discounts: discountsFor(params.vouchers ?? []),
            offer_discounts: [],
            shipping_method: { discounts: [] },
          } as unknown as CartSummary,
        }) as CalculateCartResult
    );

  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(calculateCart).mockReset();
    useCheckoutStore.getState().reset();
    useCartStore.getState().reset();
    useCartStore.setState({
      items: [{ id: 1, packageId: 3, quantity: 1, price: 81 } as CartItem],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects a code the server ignores and does not store it', async () => {
    respondWith(() => []);

    const result = await applyCoupon('primal_5');

    expect(result).toEqual({
      success: false,
      message: "Coupon PRIMAL_5 isn't valid for this order.",
    });
    expect(useCheckoutStore.getState().vouchers).toEqual([]);
  });

  it('accepts a code that adds a voucher discount', async () => {
    respondWith(v => (v.includes('SAVE10') ? [SAVE10] : []));

    const result = await applyCoupon('save10');

    expect(result).toEqual({
      success: true,
      message: 'Coupon SAVE10 applied.',
    });
    expect(useCheckoutStore.getState().vouchers).toEqual(['SAVE10']);
  });

  it('rejects a second code that adds nothing beyond the applied one', async () => {
    useCheckoutStore.getState().addVoucher('SAVE10');
    respondWith(v => (v.includes('SAVE10') ? [SAVE10] : []));

    const result = await applyCoupon('BOGUS');

    expect(result.success).toBe(false);
    expect(useCheckoutStore.getState().vouchers).toEqual(['SAVE10']);
  });

  it('does not store the code when the check cannot reach the API', async () => {
    vi.mocked(calculateCart).mockRejectedValue(new Error('offline'));

    const result = await applyCoupon('save10');

    expect(result).toEqual({
      success: false,
      message: "Couldn't check the coupon. Try again.",
    });
    expect(useCheckoutStore.getState().vouchers).toEqual([]);
  });

  it('stores the code unchecked on an empty cart', async () => {
    useCartStore.setState({ items: [] });

    const result = await applyCoupon('save10');

    expect(result.success).toBe(true);
    expect(calculateCart).not.toHaveBeenCalled();
    expect(useCheckoutStore.getState().vouchers).toEqual(['SAVE10']);
  });
});
