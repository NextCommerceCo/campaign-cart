import { couponTexts } from '@/state/cart/coupon-texts';
import { calculateTotals } from './calculate-totals';
import { logger } from './shared';
import { voucherAddsDiscount } from './voucher-check';
import { useCartStore } from '@/state/cart';
import { useCheckoutStore } from '@/state/checkout';
import { normalizeVoucherCode } from '@/utils/voucher';

export async function applyCoupon(
  code: string
): Promise<{ success: boolean; message: string }> {
  const checkoutState = useCheckoutStore.getState();

  const normalizedCode = normalizeVoucherCode(code);
  const texts = couponTexts(normalizedCode);

  // Compare normalised on both sides, not just the incoming code: a voucher
  // can also reach `vouchers` un-normalised, via bundle-selector's direct
  // `checkoutStore.addVoucher(code)` calls (bundle-configured codes are not
  // routed through this function). Comparing only `normalizedCode` against
  // raw stored entries would miss that duplicate.
  const isApplied = (vouchers: string[]): boolean =>
    vouchers.some(v => normalizeVoucherCode(v) === normalizedCode);

  if (isApplied(checkoutState.vouchers)) {
    return {
      success: false,
      message: (await texts)('coupon.errors.already_applied'),
    };
  }

  // An empty cart has no lines to price the code against, so it is stored
  // unchecked, and `recheckUncheckedVouchers` checks it once items arrive.
  const unchecked = useCartStore.getState().items.length === 0;
  if (!unchecked) {
    let accepted: boolean;
    try {
      accepted = await voucherAddsDiscount(
        checkoutState.vouchers,
        normalizedCode
      );
    } catch (error) {
      logger.error('Failed to verify coupon:', error);
      return {
        success: false,
        message: (await texts)('coupon.errors.network'),
      };
    }
    if (!accepted) {
      return {
        success: false,
        message: (await texts)('coupon.errors.invalid'),
      };
    }
    // A second apply of the same code may have resolved during the await.
    if (isApplied(useCheckoutStore.getState().vouchers)) {
      return {
        success: false,
        message: (await texts)('coupon.errors.already_applied'),
      };
    }
  }

  useCheckoutStore.getState().addVoucher(normalizedCode, { unchecked });
  calculateTotals();

  return { success: true, message: (await texts)('coupon.applied') };
}
