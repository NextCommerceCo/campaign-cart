import { Logger } from '../../../utils/logger';
export declare function renderQuantityDisplay(element: HTMLElement, selectorId: string | undefined, quantityMap: Map<string, number>, fallbackQty: number): void;
export declare function renderQuantityToggles(element: HTMLElement, qty: number): void;
export declare function syncOptionSelectionAcrossContainers(selectorId: string, selectedPackageId: number): void;
export declare function syncQuantityAcrossContainers(selectorId: string | undefined, packageId: number | undefined, quantityMap: Map<string, number>, fallbackQty: number): void;
export declare function renderProcessingState(element: HTMLElement, buttons: HTMLElement[], processing: boolean): void;
export declare function showUpsellOffer(element: HTMLElement): void;
export declare function hideUpsellOffer(element: HTMLElement): void;
export declare function renderSuccess(element: HTMLElement): void;
export declare function renderError(element: HTMLElement, message: string, logger: Logger): void;
//# sourceMappingURL=UpsellEnhancer.renderer.d.ts.map