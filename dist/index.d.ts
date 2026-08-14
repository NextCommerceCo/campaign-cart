export { NextCommerce } from './core/next-commerce';
export { SDKInitializer } from './core/sdk-initializer';
export { useCartStore } from './state/cart';
export { useCampaignStore } from './state/campaign';
export { useConfigStore } from './state/config';
export { useCheckoutStore } from './state/checkout';
export { useOrderStore } from './state/order';
export type * from './types/global';
export type { Order, OrderLine, OrderLineProperty, OrderUser, OrderAddress, MarketingAttribution, PaymentMethod, } from './types/api';
export { Logger } from './core/logger';
export { EventBus } from './core/events';
export { ApiClient } from './api/client';
declare global {
    interface Window {
        __NEXT_SDK_VERSION__?: string;
    }
}
export declare const VERSION: string;
//# sourceMappingURL=index.d.ts.map