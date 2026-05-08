import { Logger } from '../../../utils/logger';
import { SelectorItem } from '../../../types/global';
export interface SelectorEvent {
    selectorId?: string;
    packageId?: number;
    quantity?: number;
    item?: SelectorItem;
}
export interface AddToCartHandlerContext {
    selectorId: string | undefined;
    quantity: number;
    clearCart: boolean;
    redirectUrl: string | undefined;
    logger: Logger;
    selectedItemRef: {
        value: SelectorItem | null | undefined;
    };
    updateButtonState: () => void;
    emit: (event: string, detail: unknown) => void;
}
//# sourceMappingURL=AddToCartEnhancer.types.d.ts.map