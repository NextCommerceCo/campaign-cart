import { Logger } from '../../../utils/logger';
import { LoadingOverlay } from '../../../components/LoadingOverlay';
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
    }[] | null;
    bundleVouchers?: string[];
    currentPagePath: string | undefined;
    logger: Logger;
    emit: <K extends keyof EventMap>(event: K, detail: EventMap[K]) => void;
}
//# sourceMappingURL=UpsellEnhancer.types.d.ts.map