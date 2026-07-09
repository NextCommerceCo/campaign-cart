import { ProviderAdapter } from './ProviderAdapter';
import { DataLayerEvent } from '../types';
declare global {
    interface Window {
        fbq: (command: string, event: string, parameters?: any, eventData?: {
            eventID?: string;
        }) => void;
    }
}
export declare class FacebookAdapter extends ProviderAdapter {
    private storeName?;
    private eventMapping;
    private customEvents;
    constructor(config?: {
        blockedEvents?: string[];
        storeName?: string;
    });
    private isFbqLoaded;
    protected isReady(): boolean;
    protected getDebugDetails(): Record<string, string | number | boolean>;
    sendEvent(event: DataLayerEvent): unknown | Promise<unknown>;
    private waitForFbq;
    private sendEventInternal;
    private mapEventName;
    private transformParameters;
    private calculateTotalValue;
    private buildViewContentParams;
    private buildAddToCartParams;
    private buildShippingInfoParams;
    private buildPaymentInfoParams;
    private buildCheckoutParams;
    private buildPurchaseParams;
    private buildSearchParams;
    private buildRegistrationParams;
    private buildUpsellParams;
    private buildGenericParams;
}
//# sourceMappingURL=FacebookAdapter.d.ts.map