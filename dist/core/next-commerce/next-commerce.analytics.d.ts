import { Logger } from '../logger';
export declare function trackViewItemList(logger: Logger, packageIds: (string | number)[], _listId?: string, listName?: string): Promise<void>;
export declare function trackViewItem(logger: Logger, packageId: string | number): Promise<void>;
export declare function trackAddToCart(logger: Logger, packageId: string | number, quantity?: number): Promise<void>;
export declare function trackRemoveFromCart(logger: Logger, packageId: string | number, quantity?: number): Promise<void>;
export declare function trackBeginCheckout(logger: Logger): Promise<void>;
export declare function trackPurchase(logger: Logger, orderData: any): Promise<void>;
export declare function trackCustomEvent(logger: Logger, eventName: string, data?: Record<string, any>): Promise<void>;
export declare function trackSignUp(logger: Logger, email: string): Promise<void>;
export declare function trackLogin(logger: Logger, email: string): Promise<void>;
export declare function setDebugMode(logger: Logger, enabled: boolean): Promise<void>;
export declare function invalidateAnalyticsContext(logger: Logger): Promise<void>;
//# sourceMappingURL=next-commerce.analytics.d.ts.map