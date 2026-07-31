import { EventMap } from '../../../types/global';
import { UpsellHandlerContext, UpsellInteractionContext, UpsellState } from './upsell.types';
export declare function quantityKey(state: UpsellState): string | undefined;
export declare function quantitySnapshot(state: UpsellState): Map<string, number>;
export declare function setQuantity(ctx: UpsellInteractionContext, quantity: number, qtySelectorId?: string): void;
export declare function initializeSelectorMode(ctx: UpsellInteractionContext): void;
export declare function scanUpsellElements(ctx: UpsellInteractionContext): void;
export declare function adjustQuantity(delta: number, qtySelectorId: string | undefined, ctx: UpsellInteractionContext): void;
export declare function selectOption(packageId: number, ctx: UpsellInteractionContext): void;
export declare function setupEventHandlers(ctx: UpsellInteractionContext, isProcessingRef: {
    value: boolean;
}, makeHandlerContext: () => UpsellHandlerContext): {
    clickHandler: (event: Event) => void;
    keydownHandler: (event: KeyboardEvent) => void;
};
export declare function onQuantityChanged(data: EventMap['upsell:quantity-changed'], ctx: UpsellInteractionContext): void;
export declare function onOptionSelected(data: EventMap['upsell:option-selected'], ctx: UpsellInteractionContext): void;
//# sourceMappingURL=upsell.interaction-handlers.d.ts.map