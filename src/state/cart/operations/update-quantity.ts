import { EventBus } from '@/core/events';
import { useCartStore } from '@/state/cart';
import { optimisticTotals } from './shared';
import { calculateTotals } from './calculate-totals';
import { removeItem } from './remove-item';

export async function updateQuantity(
  packageId: number,
  quantity: number
): Promise<void> {
  if (quantity <= 0) {
    return removeItem(packageId);
  }

  const currentItem = useCartStore
    .getState()
    .items.find(item => item.packageId === packageId);
  const oldQuantity = currentItem?.quantity ?? 0;

  useCartStore.setState(state => {
    const newItems = state.items.map(item =>
      item.packageId === packageId ? { ...item, quantity } : item
    );
    return { ...state, items: newItems, ...optimisticTotals(newItems) };
  });

  if (currentItem) {
    EventBus.getInstance().emit('cart:quantity-changed', {
      packageId,
      quantity,
      oldQuantity,
    });
  }
  calculateTotals();
}
