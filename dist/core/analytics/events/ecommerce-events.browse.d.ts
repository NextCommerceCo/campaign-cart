import { DataLayerEvent } from '../types';
import { CartItem, EnrichedCartLine } from '../../../types/global';
export declare function createViewItemListEvent(items: (CartItem | EnrichedCartLine | any)[], listId?: string, listName?: string): DataLayerEvent;
export declare function createViewItemEvent(item: CartItem | EnrichedCartLine | any): DataLayerEvent;
export declare function createSelectItemEvent(item: CartItem | EnrichedCartLine | any, listId?: string, listName?: string): DataLayerEvent;
export declare function createViewSearchResultsEvent(items: (CartItem | EnrichedCartLine | any)[], searchTerm?: string): DataLayerEvent;
//# sourceMappingURL=ecommerce-events.browse.d.ts.map