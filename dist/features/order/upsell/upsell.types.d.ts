import { Logger } from '../../../core/logger';
import { LoadingOverlay } from '../../../core/ui/loading-overlay';
import { IApiClient } from '../../../api/client.types';
import { EventMap } from '../../../types/global';
export interface UpsellBundleItem {
    packageId: number;
    quantity: number;
    properties?: Record<string, string>;
}
export interface UpsellState {
    packageId: number | undefined;
    quantity: number;
    selectorId: string | undefined;
    selectedPackageId: number | undefined;
    options: Map<number, HTMLElement>;
    currentQuantitySelectorId: string | undefined;
    actionButtons: HTMLElement[];
    scanTeardowns: (() => void)[];
    selectorTeardowns: (() => void)[];
}
export interface UpsellInteractionContext {
    element: HTMLElement;
    state: UpsellState;
    logger: Logger;
    emit: <K extends keyof EventMap>(event: K, detail: EventMap[K]) => void;
}
export interface UpsellHandlerContext {
    isProcessingRef: {
        value: boolean;
    };
    element: HTMLElement;
    packageId: number | undefined;
    isSelector: boolean;
    selectedPackageId: number | undefined;
    selectorId: string | undefined;
    quantity: number;
    quantityBySelectorId: Map<string, number>;
    currentQuantitySelectorId: string | undefined;
    actionButtons: HTMLElement[];
    loadingOverlay: LoadingOverlay;
    apiClient: IApiClient;
    bundleItems?: UpsellBundleItem[] | null;
    bundleVouchers?: string[];
    defaultProperties?: Record<string, string>;
    properties?: Record<string, string>;
    currentPagePath: string | undefined;
    logger: Logger;
    emit: <K extends keyof EventMap>(event: K, detail: EventMap[K]) => void;
}
//# sourceMappingURL=upsell.types.d.ts.map