import { BaseDisplayEnhancer } from '../../display/display-core';
import { FormatType } from '../../display/display-types';
import { CartState } from '../../../types/global';
export declare class CartDisplayEnhancer extends BaseDisplayEnhancer {
    protected setupStoreSubscriptions(): void;
    protected getPropertyValue(): unknown;
    private resolveValue;
    protected getDefaultFormatType(property: string): FormatType;
    getCartProperty(cartState: CartState, property: string): unknown;
    refreshDisplay(): void;
}
//# sourceMappingURL=cart-summary.display.d.ts.map