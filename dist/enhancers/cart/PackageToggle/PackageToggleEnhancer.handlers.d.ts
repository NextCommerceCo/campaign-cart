import { CartState, EventMap } from '../../../types/global';
import { Logger } from '../../../utils/logger';
import { ToggleCard } from './PackageToggleEnhancer.types';
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
export declare function updateSyncedQuantity(card: ToggleCard, cartState: CartState): void;
export declare function handleSyncUpdate(card: ToggleCard, _cartState: CartState, _logger: Logger): Promise<void>;
//# sourceMappingURL=PackageToggleEnhancer.handlers.d.ts.map