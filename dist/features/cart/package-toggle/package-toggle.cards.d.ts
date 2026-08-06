import { Logger } from '../../../core/logger';
import { ToggleCard } from './package-toggle.types';
import { ToggleHandlerContext } from './package-toggle.handlers';
export interface CardRegistrationContext {
    cards: ToggleCard[];
    clickHandlers: Map<HTMLElement, (e: Event) => void>;
    listenerSignal: AbortSignal;
    logger: Logger;
    makeHandlerContext: () => ToggleHandlerContext;
}
export declare function scanCards(containerElement: HTMLElement, ctx: CardRegistrationContext): void;
export declare function registerCard(el: HTMLElement, ctx: CardRegistrationContext): void;
export declare function findStateContainer(el: HTMLElement): HTMLElement;
export declare function resolvePackageId(el: HTMLElement, stateContainer: HTMLElement): number | null;
//# sourceMappingURL=package-toggle.cards.d.ts.map