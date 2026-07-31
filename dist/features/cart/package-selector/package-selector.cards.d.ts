import { SelectorItem } from '../../../types/global';
import { SelectorHandlerContext } from './package-selector.types';
type HandlerMap = Map<HTMLElement, (e: Event) => void>;
export declare function scanCards(ctx: SelectorHandlerContext, clickHandlers: HandlerMap, quantityHandlers: HandlerMap): void;
export declare function registerCard(el: HTMLElement, ctx: SelectorHandlerContext, clickHandlers: HandlerMap, quantityHandlers: HandlerMap): void;
export declare function updateItemPackageData(item: SelectorItem): void;
export declare function handlePackageIdChange(el: HTMLElement, ctx: SelectorHandlerContext, clickHandlers: HandlerMap, quantityHandlers: HandlerMap): void;
export declare function handleCardRemoval(el: HTMLElement, ctx: SelectorHandlerContext, clickHandlers: HandlerMap, quantityHandlers: HandlerMap): void;
export declare function initializeSelection(ctx: SelectorHandlerContext): void;
export {};
//# sourceMappingURL=package-selector.cards.d.ts.map