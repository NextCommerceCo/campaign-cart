export { NextCommerce } from './core/next-commerce';
export { SDKInitializer } from './core/sdk-initializer';
export { useCartStore } from './state/cart';
export { useCampaignStore } from './state/campaign';
export { useConfigStore } from './state/config.state';
export { useCheckoutStore } from './state/checkout.state';
export { useOrderStore } from './state/order.state';
export type * from './types/global';
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