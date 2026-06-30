import { ProviderAdapter } from './ProviderAdapter';
import { DataLayerEvent } from '../types';
declare global {
    interface Window {
        rudderanalytics: {
            track: (event: string, properties?: any, options?: any) => void;
            page: (category?: string, name?: string, properties?: any, options?: any) => void;
            identify: (userId: string, traits?: any, options?: any) => void;
            reset: () => void;
            ready: (callback: () => void) => void;
        };
    }
}
export declare class RudderStackAdapter extends ProviderAdapter {
    private pageViewSent;
    constructor();
    private isRudderStackLoaded;
    protected isReady(): boolean;
    protected getDebugDetails(): Record<string, string | number | boolean>;
    sendEvent(event: DataLayerEvent): void;
    private waitForRudderStack;
    private sendEventInternal;
    private handlePageView;
    private handleUserData;
    private mapEventName;
    private buildEventProperties;
    private buildProductViewedProps;
    private buildProductListViewedProps;
    private buildProductAddedRemovedProps;
    private buildCartViewedProps;
    private buildShippingInfoProps;
    private buildPaymentInfoProps;
    private buildCheckoutStartedProps;
    private buildOrderCompletedProps;
    private buildUpsellProps;
    private formatProducts;
    private getPageMetadata;
    private getCampaignData;
}
//# sourceMappingURL=RudderStackAdapter.d.ts.map