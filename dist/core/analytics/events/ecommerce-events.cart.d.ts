import { DataLayerEvent, EcommerceData } from '../types';
import { CartItem, EnrichedCartLine } from '../../../types/global';
export declare function buildCartEcommerce(): EcommerceData;
export declare function createAddToCartEvent(item: CartItem | EnrichedCartLine | any, listId?: string, listName?: string): DataLayerEvent;
export declare function createRemoveFromCartEvent(item: CartItem | EnrichedCartLine | any): DataLayerEvent;
export declare function createPackageSwappedEvent(previousItem: CartItem | any, newItem: CartItem | any, priceDifference: number): DataLayerEvent;
export declare function createViewCartEvent(): DataLayerEvent;
export declare function createCartUpdatedEvent(): DataLayerEvent;
export declare function createAddShippingInfoEvent(shippingTier?: string): DataLayerEvent;
export declare function createAddPaymentInfoEvent(paymentType?: string): DataLayerEvent;
//# sourceMappingURL=ecommerce-events.cart.d.ts.map