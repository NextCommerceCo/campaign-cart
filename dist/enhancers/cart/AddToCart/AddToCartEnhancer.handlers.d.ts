import { SelectorItem } from '../../../types/global';
import { AddToCartHandlerContext, SelectorEvent } from './AddToCartEnhancer.types';
export declare function handleSelectorChange(event: SelectorEvent, findSelectorElement: () => HTMLElement | null, getSelectedItemFromElement: (el: HTMLElement) => SelectorItem | null, ctx: AddToCartHandlerContext): void;
export declare function addToCart(packageId: number, quantity: number, ctx: AddToCartHandlerContext): Promise<void>;
//# sourceMappingURL=AddToCartEnhancer.handlers.d.ts.map