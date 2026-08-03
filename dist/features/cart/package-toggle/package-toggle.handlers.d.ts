import { CartState, EventMap } from '../../../types/global';
import { Logger } from '../../../core/logger';
import { ToggleCard } from './package-toggle.types';
export declare const autoAddedPackages: Set<number>;
export interface ToggleHandlerContext {
    logger: Logger;
    emit: <K extends keyof EventMap>(event: K, detail: EventMap[K]) => void;
    autoAddInProgress: Set<number>;
    isUpsellContext: boolean;
    isProcessingRef: {
        value: boolean;
    };
    containerElement: HTMLElement;
}
export declare function handleCardClick(e: Event, card: ToggleCard, ctx: ToggleHandlerContext): Promise<void>;
export declare function addToCart(card: ToggleCard): Promise<void>;
export declare function updateCartItemProperties(card: ToggleCard): Promise<void>;
export declare function updateSyncedQuantity(card: ToggleCard, cartState: CartState): void;
export declare function handleSyncUpdate(card: ToggleCard, _cartState: CartState, _logger: Logger): Promise<void>;
export interface ToggleSyncContext {
    cards: ToggleCard[];
    autoAddInProgress: Set<number>;
    emit: <K extends keyof EventMap>(event: K, detail: EventMap[K]) => void;
    logger: Logger;
    includeShipping: boolean;
    getPriceSyncDebounce: () => ReturnType<typeof setTimeout> | null;
    setPriceSyncDebounce: (handle: ReturnType<typeof setTimeout> | null) => void;
}
export declare function syncWithCart(cartState: CartState, ctx: ToggleSyncContext): void;
//# sourceMappingURL=package-toggle.handlers.d.ts.map