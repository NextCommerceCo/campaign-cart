import { CartItem, CartState, AppliedCoupon } from '../../types/global';
export interface CartItemsSlice {
    reset: () => void;
    setLastCurrency: (currency: string) => void;
    hasItem: (packageId: number) => boolean;
    getItem: (packageId: number) => CartItem | undefined;
    getItemQuantity: (packageId: number) => number;
    getTotalWeight: () => number;
    getTotalItemCount: () => number;
    getCoupons: () => AppliedCoupon[];
}
export interface CartUiSlice {
    swapInProgress: boolean;
    setSwapInProgress: (value: boolean) => void;
}
export interface CartApiSlice {
    addItem: (item: Partial<CartItem> & {
        isUpsell: boolean | undefined;
    }) => Promise<void>;
    removeItem: (packageId: number) => Promise<void>;
    updateQuantity: (packageId: number, quantity: number) => Promise<void>;
    swapPackage: (removePackageId: number, addItem: Partial<CartItem> & {
        isUpsell: boolean | undefined;
    }) => Promise<void>;
    swapCart: (items: Array<{
        packageId: number;
        quantity: number;
    }>) => Promise<void>;
    clear: () => void;
    syncWithAPI: () => Promise<void>;
    calculateTotals: () => void;
    refreshItemPrices: () => Promise<void>;
    setShippingMethod: (methodId: number) => Promise<void>;
    applyCoupon: (code: string) => Promise<{
        success: boolean;
        message: string;
    }>;
    removeCoupon: (code: string) => Promise<void>;
}
export type CartStore = CartState & CartItemsSlice & CartUiSlice & CartApiSlice;
//# sourceMappingURL=cartStore.types.d.ts.map