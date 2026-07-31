import { calculateTotals } from './calculate-totals';

export async function removeCoupon(code: string): Promise<void> {
  const { useCheckoutStore } = await import('@/state/checkout.state');
  useCheckoutStore.getState().removeVoucher(code);
  calculateTotals();
}
