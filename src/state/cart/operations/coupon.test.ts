import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Decimal from 'decimal.js';
import { EventBus } from '@/core/events';
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
import { recheckUncheckedVouchers } from './voucher-check';
import { calculateTotals } from './calculate-totals';

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

/** What the calculate API answers for a set of vouchers, as far as the check reads it. */
interface Answer {
  voucher?: Discount[];
  shipping?: Discount[];
  total?: string;
}

const respondWith = (answer: (vouchers: string[]) => Answer) =>
  vi
    .mocked(calculateCart)
    .mockImplementation(async (params: CalculateCartParams) => {
      const {
        voucher = [],
        shipping = [],
        total = '81.00',
      } = answer(params.vouchers ?? []);
      return {
        vouchers: params.vouchers ?? [],
        total: new Decimal(total),
        summary: {
          lines: [],
          voucher_discounts: voucher,
          offer_discounts: [],
          shipping_method: { discounts: shipping },
        } as unknown as CartSummary,
      } as unknown as CalculateCartResult;
    });

const SAVE10: Discount = { offer_id: 7, amount: '8.10', name: 'Save 10%' };
const ITEM = { id: 1, packageId: 3, quantity: 1, price: 81 } as CartItem;

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
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(calculateCart).mockReset();
    useCheckoutStore.getState().reset();
    useCartStore.getState().reset();
    useCartStore.setState({ items: [ITEM] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects a code the server ignores and does not store it', async () => {
    respondWith(() => ({}));

    const result = await applyCoupon('primal_5');

    expect(result).toEqual({
      success: false,
      message: "Coupon PRIMAL_5 isn't valid for this order.",
    });
    expect(useCheckoutStore.getState().vouchers).toEqual([]);
  });

  it('accepts a code that adds a voucher discount', async () => {
    respondWith(v => ({ voucher: v.includes('SAVE10') ? [SAVE10] : [] }));

    const result = await applyCoupon('save10');

    expect(result).toEqual({
      success: true,
      message: 'Coupon SAVE10 applied.',
    });
    expect(useCheckoutStore.getState().vouchers).toEqual(['SAVE10']);
    expect(useCheckoutStore.getState().uncheckedVouchers).toEqual([]);
  });

  it('accepts a code whose only discount is on shipping', async () => {
    const freeShipping = { offer_id: 9, amount: '5.00', name: 'Free ship' };
    respondWith(v => ({
      shipping: v.includes('SHIPFREE') ? [freeShipping] : [],
    }));

    expect((await applyCoupon('shipfree')).success).toBe(true);
  });

  it('accepts a code that lowers the total without naming a discount', async () => {
    respondWith(v => ({ total: v.includes('SHIPFREE') ? '76.00' : '81.00' }));

    expect((await applyCoupon('shipfree')).success).toBe(true);
  });

  it('rejects a second code that adds nothing beyond the applied one', async () => {
    useCheckoutStore.getState().addVoucher('SAVE10');
    respondWith(v => ({ voucher: v.includes('SAVE10') ? [SAVE10] : [] }));

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
    expect(useCheckoutStore.getState().uncheckedVouchers).toEqual(['SAVE10']);
  });
});

describe('recheckUncheckedVouchers once the cart has items', () => {
  let refused: ReturnType<typeof vi.fn>;
  let off: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(calculateCart).mockReset();
    useCheckoutStore.getState().reset();
    useCartStore.getState().reset();
    useCheckoutStore.getState().addVoucher('PRIMAL_5', { unchecked: true });
    useCartStore.setState({ items: [ITEM] });
    refused = vi.fn();
    off = EventBus.getInstance().on('coupon:validation-failed', refused);
  });

  afterEach(() => {
    off();
    vi.useRealTimers();
  });

  it('takes off a code that gives no discount and reports it', async () => {
    respondWith(() => ({}));

    await recheckUncheckedVouchers();

    expect(useCheckoutStore.getState().vouchers).toEqual([]);
    expect(useCheckoutStore.getState().uncheckedVouchers).toEqual([]);
    expect(refused).toHaveBeenCalledWith({
      code: 'PRIMAL_5',
      message: "Coupon PRIMAL_5 isn't valid for this order.",
    });
  });

  it('keeps a code that gives a discount and stops checking it', async () => {
    respondWith(v => ({ voucher: v.includes('PRIMAL_5') ? [SAVE10] : [] }));

    await recheckUncheckedVouchers();

    expect(useCheckoutStore.getState().vouchers).toEqual(['PRIMAL_5']);
    expect(useCheckoutStore.getState().uncheckedVouchers).toEqual([]);
    expect(refused).not.toHaveBeenCalled();
  });

  it('leaves a code unchecked when the check cannot reach the API', async () => {
    vi.mocked(calculateCart).mockRejectedValue(new Error('offline'));

    await recheckUncheckedVouchers();

    expect(useCheckoutStore.getState().vouchers).toEqual(['PRIMAL_5']);
    expect(useCheckoutStore.getState().uncheckedVouchers).toEqual(['PRIMAL_5']);
  });

  it('checks nothing while the cart is empty', async () => {
    useCartStore.setState({ items: [] });

    await recheckUncheckedVouchers();

    expect(calculateCart).not.toHaveBeenCalled();
    expect(useCheckoutStore.getState().uncheckedVouchers).toEqual(['PRIMAL_5']);
  });

  it('runs after a cart calculation that has items', async () => {
    respondWith(() => ({}));

    calculateTotals();
    await vi.advanceTimersByTimeAsync(150);
    await vi.waitFor(() =>
      expect(useCheckoutStore.getState().vouchers).toEqual([])
    );
  });
});
