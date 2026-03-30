import { create } from 'zustand';
import { subscribeWithSelector, persist } from 'zustand/middleware';
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
export const useCartStore = cartStoreInstance;
