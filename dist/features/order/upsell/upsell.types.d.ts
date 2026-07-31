import { Logger } from '../../../core/logger';
import { LoadingOverlay } from '../../../shared/components/loading-overlay';
import { ApiClient } from '../../../api/client';
import { EventMap } from '../../../types/global';
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
    apiClient: ApiClient;
    bundleItems?: {
        packageId: number;
        quantity: number;
        properties?: Record<string, string>;
    }[] | null;
    bundleVouchers?: string[];
    defaultProperties?: Record<string, string>;
    properties?: Record<string, string>;
    currentPagePath: string | undefined;
    logger: Logger;
    emit: <K extends keyof EventMap>(event: K, detail: EventMap[K]) => void;
}
//# sourceMappingURL=upsell.types.d.ts.map