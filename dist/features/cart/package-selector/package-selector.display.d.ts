import { BaseDisplayEnhancer } from '../../../core/base/base-display-enhancer';
import { FormatType } from '../../../core/base/display-types';
import { CartState } from '../../../types/global';
import { SelectorHandlerContext } from './package-selector.types';
export declare function syncWithCart(cartState: CartState, ctx: SelectorHandlerContext): void;
export declare class PackageSelectorDisplayEnhancer extends BaseDisplayEnhancer {
    private selectorId?;
    private packageId?;
    private cardEl;
    private selectionHandler;
    private priceHandler;
    protected parseDisplayAttributes(): void;
    protected setupStoreSubscriptions(): void;
    private resolveCardEl;
    protected getPropertyValue(): unknown;
    protected getDefaultFormatType(property: string): FormatType;
    destroy(): void;
}
//# sourceMappingURL=package-selector.display.d.ts.map