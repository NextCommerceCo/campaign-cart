import type { StateCreator } from 'zustand';
import type { CartState } from '@/types/global';
import type { CartItemsSlice, CartStore } from './cartStore.types';

export const initialCartState: CartState = {
  items: [],
  subtotal: 0,
  shipping: 0,
  tax: 0,
  total: 0,
  totalQuantity: 0,
  isEmpty: true,
  appliedCoupons: [],
  enrichedItems: [],
  totals: {
    subtotal: { value: 0, formatted: '$0.00' },
    shipping: { value: 0, formatted: 'FREE' },
    shippingDiscount: { value: 0, formatted: '$0.00' },
    tax: { value: 0, formatted: '$0.00' },
    discounts: { value: 0, formatted: '$0.00' },
    total: { value: 0, formatted: '$0.00' },
    totalExclShipping: { value: 0, formatted: '$0.00' },
    count: 0,
    isEmpty: true,
    savings: { value: 0, formatted: '$0.00' },
    savingsPercentage: { value: 0, formatted: '0%' },
    compareTotal: { value: 0, formatted: '$0.00' },
    hasSavings: false,
    totalSavings: { value: 0, formatted: '$0.00' },
    totalSavingsPercentage: { value: 0, formatted: '0%' },
    hasTotalSavings: false,
  },
};

export const createCartItemsSlice: StateCreator<
  CartStore,
  [],
  [],
  CartItemsSlice
> = (set, get) => ({
  reset: () => set(initialCartState),

  setLastCurrency: currency => set({ lastCurrency: currency }),

  hasItem: packageId =>
    get().items.some(item => item.packageId === packageId),

  getItem: packageId =>
    get().items.find(item => item.packageId === packageId),

  getItemQuantity: packageId =>
    get().items.find(item => item.packageId === packageId)?.quantity ?? 0,

  getTotalWeight: () =>
    get().items.reduce((sum, item) => sum + item.quantity, 0),

  getTotalItemCount: () =>
    get().items.reduce((sum, item) => sum + item.quantity, 0),

  getCoupons: () => get().appliedCoupons ?? [],
});
