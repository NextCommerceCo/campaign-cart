import { calculateTotals } from './calculate-totals';
import { useCheckoutStore } from '@/state/checkout';
import { normalizeVoucherCode } from '@/utils/voucher';

export async function applyCoupon(
  code: string
): Promise<{ success: boolean; message: string }> {
  const checkoutState = useCheckoutStore.getState();

  const normalizedCode = normalizeVoucherCode(code);

  // Compare normalised on both sides, not just the incoming code: a voucher
  // can also reach `vouchers` un-normalised, via bundle-selector's direct
  // `checkoutStore.addVoucher(code)` calls (bundle-configured codes are not
  // routed through this function). Comparing only `normalizedCode` against
  // raw stored entries would miss that duplicate.
  const alreadyApplied = checkoutState.vouchers.some(
    v => normalizeVoucherCode(v) === normalizedCode
  );
  if (alreadyApplied) {
    return { success: false, message: 'Coupon already applied' };
  }

  checkoutState.addVoucher(normalizedCode);
  calculateTotals();

  return {
    success: true,
    message: `Coupon ${normalizedCode} applied successfully`,
  };
}
