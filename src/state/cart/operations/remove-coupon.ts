import { calculateTotals } from './calculate-totals';
import { useCheckoutStore } from '@/state/checkout';

export async function removeCoupon(code: string): Promise<void> {
  useCheckoutStore.getState().removeVoucher(code);
  calculateTotals();
}
