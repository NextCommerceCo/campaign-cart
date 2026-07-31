import { EventBus } from '@/core/events';
import { useCartStore } from '@/state/cart';
import { optimisticTotals } from './shared';
import { calculateTotals } from './calculate-totals';

export async function removeItem(packageId: number): Promise<void> {
  const removedItem = useCartStore
    .getState()
    .items.find(item => item.packageId === packageId);

  useCartStore.setState(state => {
    const newItems = state.items.filter(item => item.packageId !== packageId);
    return { ...state, items: newItems, ...optimisticTotals(newItems) };
  });

  if (removedItem) {
    EventBus.getInstance().emit('cart:item-removed', { packageId });
  }
  calculateTotals();
}
