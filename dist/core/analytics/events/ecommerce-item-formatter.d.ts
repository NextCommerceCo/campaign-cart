import { EcommerceItem } from '../types';
import { MinimalCartItem } from './event-builder.types';
export declare function sumItemsValue(items: EcommerceItem[]): number;
export declare function getCurrency(): string;
export declare function formatEcommerceItem(item: MinimalCartItem, index?: number, list?: {
    id?: string;
    name?: string;
}): EcommerceItem;
//# sourceMappingURL=ecommerce-item-formatter.d.ts.map