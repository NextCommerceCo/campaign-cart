import { CallbackData } from '../../types/global';
import { Logger } from '../logger';
export declare function hasItemInCart(options: {
    packageId?: number;
}): boolean;
export declare function addItem(options: {
    packageId?: number;
    quantity?: number;
}): Promise<void>;
export declare function removeItem(options: {
    packageId?: number;
}): Promise<void>;
export declare function updateQuantity(options: {
    packageId?: number;
    quantity: number;
}): Promise<void>;
export declare function clearCart(): Promise<void>;
export declare function swapCart(ctx: {
    logger: Logger;
}, items: Array<{
    packageId: number;
    quantity: number;
}>): Promise<void>;
export declare function getCartData(): CallbackData;
export declare function getCartTotals(): {
    subtotal: import('decimal.js').Decimal;
    total: import('decimal.js').Decimal;
    hasDiscounts: boolean;
    totalDiscount: import('decimal.js').Decimal;
    totalDiscountPercentage: import('decimal.js').Decimal;
    shippingMethod: import('../../types/global').ShippingMethod | undefined;
};
export declare function getCartCount(): number;
//# sourceMappingURL=next-commerce.cart.d.ts.map