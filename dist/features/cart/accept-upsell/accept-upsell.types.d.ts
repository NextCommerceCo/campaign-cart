import { Logger } from '../../../core/logger';
import { SelectorItem } from '../../../types/global';
import { IApiClient } from '../../../api/client.types';
import { LoadingOverlay } from '../../../core/ui/loading-overlay';
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
    apiClient: IApiClient;
    loadingOverlay: LoadingOverlay;
    logger: Logger;
    emit: (event: string, detail: unknown) => void;
}
//# sourceMappingURL=accept-upsell.types.d.ts.map