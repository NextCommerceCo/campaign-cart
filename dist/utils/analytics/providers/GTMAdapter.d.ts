import { ProviderAdapter } from './ProviderAdapter';
import { DataLayerEvent } from '../types';
declare global {
    interface Window {
        dataLayer: any[];
        ElevarDataLayer?: any[];
        ElevarInvalidateContext?: () => void;
    }
}
export declare class GTMAdapter extends ProviderAdapter {
    constructor(config?: {
        blockedEvents?: string[];
    });
    protected isReady(): boolean;
    protected getDebugDetails(): Record<string, string | number | boolean>;
    sendEvent(event: DataLayerEvent): unknown;
    private transformToGTMFormat;
    private buildEcommerceObject;
    private eventHasValue;
    private eventAcceptsCoupon;
    private formatItems;
    private isEcommerceEvent;
    private getEcommerceEventType;
}
//# sourceMappingURL=GTMAdapter.d.ts.map