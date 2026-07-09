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
    private buildContextProps;
    private isRudderStackLoaded;
    protected isReady(): boolean;
    protected getDebugDetails(): Record<string, string | number | boolean>;
    sendEvent(event: DataLayerEvent): unknown | Promise<unknown>;
    private waitForRudderStack;
    private buildPlan;
    private buildPageViewPlan;
    private buildUserDataPlan;
    private mapEventName;
    private buildEventProperties;
    private toNumber;
    private buildProductViewedProps;
    private buildProductListViewedProps;
    private buildProductAddedRemovedProps;
    private buildCartViewedProps;
    private buildShippingStepProps;
    private buildPaymentInfoProps;
    private buildCheckoutStartedProps;
    private buildOrderCompletedProps;
    private buildUpsellProps;
    private identifyFromUserProperties;
    private formatProduct;
    private formatProducts;
    private getPageMetadata;
    private getCampaignData;
}
//# sourceMappingURL=RudderStackAdapter.d.ts.map