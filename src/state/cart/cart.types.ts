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
  setItemProperties: (
    packageId: number,
    properties: Record<string, string> | undefined
  ) => void;
}

export interface CartUiSlice {
  swapInProgress: boolean;
  setSwapInProgress: (value: boolean) => void;
  isCalculating: boolean;
}

/**
 * Cart business-logic operations. The implementations live in
 * `@/state/cart/operations` and are exposed as `sdk.cart.*`. The store keeps
 * thin delegators to these for backward compatibility.
 */
export interface CartOperations {
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
    items: Array<{
      packageId: number;
      quantity: number;
      properties?: Record<string, string>;
    }>
  ) => Promise<void>;
  clear: () => void;
  calculateTotals: () => void;
  refreshItemPrices: () => Promise<void>;
  setShippingMethod: (methodId: number) => Promise<void>;
  applyCoupon: (code: string) => Promise<{ success: boolean; message: string }>;
  removeCoupon: (code: string) => Promise<void>;
}

/**
 * @deprecated The cart's async methods have moved to `@/state/cart/operations`
 * (`cartOperations` / `sdk.cart.*`). The store still exposes them as thin
 * delegators for backward compatibility; migrate callers off the store.
 */
export type CartApiSlice = CartOperations;

export type CartStore = CartState &
  CartItemsSlice &
  CartUiSlice &
  CartOperations;
