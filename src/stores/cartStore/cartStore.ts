import { create } from 'zustand';
import { subscribeWithSelector, persist } from 'zustand/middleware';
import Decimal from 'decimal.js';
import { sessionStorageManager, CART_STORAGE_KEY } from '@/utils/storage';
import { createLogger } from '@/utils/logger';
import { createCartItemsSlice, initialCartState } from './cartSlice.items';
import { createCartUiSlice } from './cartSlice.ui';
import { createCartApiSlice } from './cartSlice.api';
import type { CartStore } from './cartStore.types';

const logger = createLogger('CartStore');

const cartStoreInstance = create<CartStore>()(
  persist(
    subscribeWithSelector((...a) => ({
      ...initialCartState,
      ...createCartItemsSlice(...a),
      ...createCartUiSlice(...a),
      ...createCartApiSlice(...a),
    })),
    {
      name: CART_STORAGE_KEY,
      storage: {
        getItem: name => sessionStorageManager.get<any>(name),
        setItem: (name, value) => sessionStorageManager.set(name, value),
        removeItem: name => sessionStorageManager.remove(name),
      },
      onRehydrateStorage: () => state => {
        if (state) {
          logger.debug('Cart store rehydrated, recalculating totals...');
          if (state.shippingMethod) {
            const sm = state.shippingMethod;
            state.shippingMethod = {
              ...sm,
              price: new Decimal(sm.price),
              originalPrice: new Decimal(sm.originalPrice),
              discountAmount: new Decimal(sm.discountAmount),
              discountPercentage: new Decimal(sm.discountPercentage),
            };
          }
          state.calculateTotals();
        }
      },
      partialize: state =>
        ({
          items: state.items,
          vouchers: state.vouchers,
          shippingMethod: state.shippingMethod,
          totalQuantity: state.totalQuantity,
          isEmpty: state.isEmpty,
          enrichedItems: [],
        }) as unknown as CartStore,
    }
  )
);

export const cartStore = cartStoreInstance;

/**
 * Zustand store holding cart state: line items, totals, applied coupons, and
 * the selected shipping method. Persisted to `sessionStorage`.
 *
 * Read a snapshot with `getState()`, mutate through the store's actions
 * (`addItem`, `removeItem`, `applyCoupon`, …), and subscribe for reactive
 * updates. Inside an enhancer, prefer `this.subscribe(useCartStore, …)` so the
 * subscription is cleaned up on `destroy()`.
 *
 * @example
 * ```ts
 * const { items, total } = useCartStore.getState();
 * await useCartStore.getState().addItem({ packageId: 2, quantity: 1 });
 *
 * const unsubscribe = useCartStore.subscribe((state) => {
 *   console.log('Cart total is now', state.total);
 * });
 * ```
 *
 * @see {@link CartStore} for the full state and action shape.
 */
export const useCartStore = cartStoreInstance;
