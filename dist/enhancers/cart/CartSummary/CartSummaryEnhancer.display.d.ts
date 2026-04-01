import { BaseDisplayEnhancer } from '../../display/DisplayEnhancerCore';
import { FormatType } from '../../display/DisplayEnhancerTypes';
import { CartState } from '../../../types/global';
export declare class CartDisplayEnhancer extends BaseDisplayEnhancer {
    private includeDiscounts;
    initialize(): Promise<void>;
    protected parseDisplayAttributes(): void;
    protected setupStoreSubscriptions(): void;
    protected getPropertyValue(): unknown;
    private resolveValue;
    protected getDefaultFormatType(property: string): FormatType;
    getCartProperty(cartState: CartState, property: string): unknown;
    refreshDisplay(): void;
}
//# sourceMappingURL=CartSummaryEnhancer.display.d.ts.map