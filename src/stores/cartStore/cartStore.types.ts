import type { CartItem, CartState } from '@/types/global';

export interface CartItemsSlice {
  reset: () => void;
  setLastCurrency: (currency: string) => void;
  hasItem: (packageId: number) => boolean;
  getItem: (packageId: number) => CartItem | undefined;
  getItemQuantity: (packageId: number) => number;
  getTotalWeight: () => number;
  getTotalItemCount: () => number;
  getCoupons: () => string[];
}

export interface CartUiSlice {
  swapInProgress: boolean;
  setSwapInProgress: (value: boolean) => void;
  isCalculating: boolean;
}

export interface CartApiSlice {
  addItem: (
    item: Partial<CartItem> & { isUpsell: boolean | undefined }
  ) => Promise<void>;
  removeItem: (packageId: number) => Promise<void>;
  updateQuantity: (packageId: number, quantity: number) => Promise<void>;
  swapPackage: (
    removePackageId: number,
    addItem: Partial<CartItem> & { isUpsell: boolean | undefined }
  ) => Promise<void>;
  swapCart: (
    items: Array<{ packageId: number; quantity: number }>
  ) => Promise<void>;
  clear: () => void;
  syncWithAPI: () => Promise<void>;
  calculateTotals: () => void;
  refreshItemPrices: () => Promise<void>;
  setShippingMethod: (methodId: number) => Promise<void>;
  applyCoupon: (code: string) => Promise<{ success: boolean; message: string }>;
  removeCoupon: (code: string) => Promise<void>;
}

/**
 * Full shape of the cart store: cart state combined with its items, UI, and API
 * action slices. This is the type returned by `useCartStore.getState()`.
 */
export type CartStore = CartState & CartItemsSlice & CartUiSlice & CartApiSlice;
