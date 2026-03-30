import { Logger } from '../../../utils/logger';
import { SelectorItem } from '../../../types/global';
import { ApiClient } from '../../../api/client';
import { LoadingOverlay } from '../../../components/LoadingOverlay';
export interface UpsellHandlerContext {
    packageId: number | undefined;
    selectorId: string | undefined;
    selectedItemRef: {
        value: SelectorItem | null;
    };
    quantity: number;
    nextUrl: string | undefined;
    apiClient: ApiClient;
    loadingOverlay: LoadingOverlay;
    logger: Logger;
    emit: (event: string, detail: unknown) => void;
}
//# sourceMappingURL=AcceptUpsellEnhancer.types.d.ts.map