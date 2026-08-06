import { DataLayerEvent } from '../types';
export declare function createAcceptedUpsellEvent(data: {
    orderId: string;
    packageId: number | string;
    packageName?: string;
    quantity?: number;
    value?: number;
    discount?: number;
    coupon?: string;
    currency?: string;
    upsellNumber?: number;
    item?: any;
}): DataLayerEvent;
//# sourceMappingURL=ecommerce-events.upsell.d.ts.map