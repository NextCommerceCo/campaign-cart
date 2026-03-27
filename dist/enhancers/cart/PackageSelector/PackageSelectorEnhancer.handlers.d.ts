import { SelectorItem } from '../../../types/global';
import { SelectorHandlerContext } from './PackageSelectorEnhancer.types';
export declare function selectItem(item: SelectorItem, ctx: SelectorHandlerContext): void;
export declare function handleCardClick(e: Event, item: SelectorItem, ctx: SelectorHandlerContext): Promise<void>;
export declare function updateCart(previous: SelectorItem | null, selected: SelectorItem, items: SelectorItem[]): Promise<void>;
export declare function setShippingMethod(shippingId: string, ctx: Pick<SelectorHandlerContext, 'logger'>): Promise<void>;
export declare function handleQuantityChange(item: SelectorItem, ctx: SelectorHandlerContext): Promise<void>;
export declare function setupQuantityControls(item: SelectorItem, ctx: SelectorHandlerContext, quantityHandlers: Map<HTMLElement, (e: Event) => void>): void;
//# sourceMappingURL=PackageSelectorEnhancer.handlers.d.ts.map