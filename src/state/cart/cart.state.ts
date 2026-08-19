import { create } from 'zustand';
import { subscribeWithSelector, persist } from 'zustand/middleware';
import type { StateCreator } from 'zustand';
import Decimal from 'decimal.js';
import { sessionStorageManager, CART_STORAGE_KEY } from '@/core/storage';
import { createLogger } from '@/core/logger';
import type { CartState } from '@/types/global';
import { cartOperations } from './operations';
import type { CartStore, CartItemsSlice, CartUiSlice } from './cart.types';

const logger = createLogger('CartStore');

const initialCartState: CartState = {
  items: [],
  totalQuantity: 0,
  isEmpty: true,
  vouchers: [],
  subtotal: new Decimal(0),
  hasDiscounts: false,
  totalDiscount: new Decimal(0),
  totalDiscountPercentage: new Decimal(0),
  total: new Decimal(0),
  isCalculating: false,
};

// Sync setters — cart items (state container; async/business logic lives in features)
const createCartItemsSlice: StateCreator<CartStore, [], [], CartItemsSlice> = (
  set,
  get
) => ({
  reset: () => set(initialCartState),

  setLastCurrency: currency => set({ currency }),

  hasItem: packageId => get().items.some(item => item.packageId === packageId),

  getItem: packageId => get().items.find(item => item.packageId === packageId),

  getItemQuantity: packageId =>
    get().items.find(item => item.packageId === packageId)?.quantity ?? 0,

  getTotalWeight: () =>
    get().items.reduce((sum, item) => sum + item.quantity, 0),

  getTotalItemCount: () =>
    get().items.reduce((sum, item) => sum + item.quantity, 0),

  getCoupons: () => get().vouchers ?? [],

  setItemProperties: (packageId, properties) =>
    set(state => ({
      items: state.items.map(item =>
        item.packageId === packageId ? { ...item, properties } : item
      ),
    })),
});

// Sync setters — UI flags
const createCartUiSlice: StateCreator<
  CartStore,
  [],
  [],
  CartUiSlice
> = set => ({
  swapInProgress: false,
  setSwapInProgress: value => set({ swapInProgress: value }),
  isCalculating: false,
});

const cartStoreInstance = create<CartStore>()(
  persist(
    subscribeWithSelector((...a) => ({
      ...initialCartState,
      ...createCartItemsSlice(...a),
      ...createCartUiSlice(...a),
      // Async cart logic lives in `./operations` (the thin-state convention).
      // The store exposes them as delegators for backward compatibility;
      // new code should call `sdk.cart.*` / `cartOperations` instead.
      ...cartOperations,
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
        }) as unknown as CartStore,
    }
  )
);

export const cartStore = cartStoreInstance;
/**
 * The cart store. Call `useCartStore.getState()` to read the current
 * {@link CartState} (items, totals, discounts, shipping), or subscribe to react
 * to changes. To *mutate* the cart, use the `sdk.cart.*` operations (add, remove,
 * update quantity, apply coupon…) rather than writing to the store directly.
 *
 * @example
 * ```ts
 * const { total, items } = useCartStore.getState();
 * useCartStore.subscribe(cart => render(cart.total));
 * ```
  * @category Cart
 */
export const useCartStore = cartStoreInstance;
