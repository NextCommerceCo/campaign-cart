import Decimal from 'decimal.js';
import type { StateCreator } from 'zustand';
import type { CartState } from '@/types/global';
import type { CartItemsSlice, CartStore } from './cartStore.types';

export const initialCartState: CartState = {
  items: [],
  enrichedItems: [],
  totalQuantity: 0,
  isEmpty: true,
  vouchers: [],
  subtotal: new Decimal(0),
  hasDiscounts: false,
  totalDiscount: new Decimal(0),
  totalDiscountPercentage: new Decimal(0),
  total: new Decimal(0),
};

export const createCartItemsSlice: StateCreator<
  CartStore,
  [],
  [],
  CartItemsSlice
> = (set, get) => ({
  reset: () => set(initialCartState),

  setLastCurrency: currency => set({ currency }),

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

  getCoupons: () => get().vouchers ?? [],
});
