import { Logger } from '../../../core/logger';
import { SelectorItem } from '../../../types/global';
import { ApiClient } from '../../../api/client';
import { LoadingOverlay } from '../../../shared/components/loading-overlay';
export interface BundleLineItem {
    packageId: number;
    quantity: number;
}
export interface UpsellHandlerContext {
    packageId: number | undefined;
    selectorId: string | undefined;
    selectedItemRef: {
        value: SelectorItem | null;
    };
    quantity: number;
    bundleSelectorId: string | undefined;
    bundleItemsRef: {
        value: BundleLineItem[] | null;
    };
    nextUrl: string | undefined;
    apiClient: ApiClient;
    loadingOverlay: LoadingOverlay;
    logger: Logger;
    emit: (event: string, detail: unknown) => void;
}
//# sourceMappingURL=accept-upsell.types.d.ts.map