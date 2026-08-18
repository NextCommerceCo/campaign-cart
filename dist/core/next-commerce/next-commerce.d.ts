import { Campaign, CallbackType, CallbackData, EventMap } from '../../types/global';
import { ShippingMethodInfo, SelectedShippingMethod } from './next-commerce.shipping';
import { ExitIntentOptions } from './next-commerce.popups';
import { AddUpsellOptions } from './next-commerce.upsells';
export declare class NextCommerce {
    private static instance;
    private logger;
    private eventBus;
    private callbacks;
    private popupsState;
    private constructor();
    static getInstance(): NextCommerce;
    get cart(): import('../../state/cart').CartOperations;
    hasItemInCart(options: {
        packageId?: number;
    }): boolean;
    addItem(options: {
        packageId?: number;
        quantity?: number;
    }): Promise<void>;
    removeItem(options: {
        packageId?: number;
    }): Promise<void>;
    updateQuantity(options: {
        packageId?: number;
        quantity: number;
    }): Promise<void>;
    clearCart(): Promise<void>;
    swapCart(items: Array<{
        packageId: number;
        quantity: number;
    }>): Promise<void>;
    getCartData(): CallbackData;
    getCartTotals(): {
        subtotal: import('decimal.js').Decimal;
        total: import('decimal.js').Decimal;
        hasDiscounts: boolean;
        totalDiscount: import('decimal.js').Decimal;
        totalDiscountPercentage: import('decimal.js').Decimal;
        shippingMethod: import('../../types/global').ShippingMethod | undefined;
    };
    getCartCount(): number;
    getCampaignData(): Campaign | null;
    getPackage(id: number): any | null;
    getVariantsByProductId(productId: number): any | null;
    getAvailableVariantAttributes(productId: number, attributeCode: string): string[];
    getPackageByVariantSelection(productId: number, selectedAttributes: Record<string, string>): any | null;
    createVariantKey(attributes: Record<string, string>): string;
    on<K extends keyof EventMap>(event: K, handler: (data: EventMap[K]) => void): void;
    off<K extends keyof EventMap>(event: K, handler: Function): void;
    registerCallback(type: CallbackType, callback: (data: CallbackData) => void): void;
    unregisterCallback(type: CallbackType, callback: Function): void;
    triggerCallback(type: CallbackType, data: CallbackData): void;
    private get eventsContext();
    trackViewItemList(packageIds: (string | number)[], _listId?: string, listName?: string): Promise<void>;
    trackViewItem(packageId: string | number): Promise<void>;
    trackAddToCart(packageId: string | number, quantity?: number): Promise<void>;
    trackRemoveFromCart(packageId: string | number, quantity?: number): Promise<void>;
    trackBeginCheckout(): Promise<void>;
    trackPurchase(orderData: any): Promise<void>;
    trackCustomEvent(eventName: string, data?: Record<string, any>): Promise<void>;
    trackSignUp(email: string): Promise<void>;
    trackLogin(email: string): Promise<void>;
    setDebugMode(enabled: boolean): Promise<void>;
    invalidateAnalyticsContext(): Promise<void>;
    addMetadata(key: string, value: any): void;
    setMetadata(metadata: Record<string, any>): void;
    clearMetadata(): void;
    getMetadata(): Record<string, any> | undefined;
    setAttribution(attribution: Record<string, any>): void;
    getAttribution(): Record<string, any> | undefined;
    debugAttribution(): void;
    getShippingMethods(): ShippingMethodInfo[];
    getSelectedShippingMethod(): SelectedShippingMethod | null;
    setShippingMethod(methodId: number): Promise<void>;
    getVersion(): string;
    formatPrice(amount: number, currency?: string): string;
    validateCheckout(): {
        valid: boolean;
        errors: string[];
    };
    applyCoupon(code: string): Promise<{
        success: boolean;
        message: string;
    }>;
    removeCoupon(code: string): void;
    getCoupons(): string[];
    exitIntent(options: ExitIntentOptions): Promise<void>;
    disableExitIntent(): void;
    addUpsell(options: AddUpsellOptions): Promise<any>;
    canAddUpsells(): boolean;
    getCompletedUpsells(): string[];
    isUpsellAlreadyAdded(packageId: number): boolean;
    setParam(key: string, value: string): void;
    setParams(params: Record<string, string>): void;
    getParam(key: string): string | null;
    getAllParams(): Record<string, string>;
    hasParam(key: string): boolean;
    clearParam(key: string): void;
    clearAllParams(): void;
    mergeParams(params: Record<string, string>): void;
}
//# sourceMappingURL=next-commerce.d.ts.map