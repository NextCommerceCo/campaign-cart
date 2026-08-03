import { useCartStore } from '@/state/cart';
import { optimisticTotals } from './shared';
import { calculateTotals } from './calculate-totals';

export function clear(): void {
  useCartStore.setState(state => ({
    ...state,
    items: [],
    ...optimisticTotals([]),
  }));
  calculateTotals();
}
