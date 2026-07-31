import { calculateTotals } from './calculate-totals';

export async function applyCoupon(
  code: string
): Promise<{ success: boolean; message: string }> {
  const { useCheckoutStore } = await import('@/state/checkout');
  const checkoutState = useCheckoutStore.getState();

  const normalizedCode = code.toUpperCase().trim();

  if (checkoutState.vouchers.includes(normalizedCode)) {
    return { success: false, message: 'Coupon already applied' };
  }

  checkoutState.addVoucher(normalizedCode);
  calculateTotals();

  return {
    success: true,
    message: `Coupon ${normalizedCode} applied successfully`,
  };
}
