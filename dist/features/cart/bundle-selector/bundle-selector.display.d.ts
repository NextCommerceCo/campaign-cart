import { BaseDisplayEnhancer } from '../../display/display-core';
import { FormatType } from '../../display/display-types';
export declare class BundleDisplayEnhancer extends BaseDisplayEnhancer {
    private selectorId?;
    private selectionHandler;
    private priceHandler;
    protected parseDisplayAttributes(): void;
    protected setupStoreSubscriptions(): void;
    protected getPropertyValue(): unknown;
    protected getDefaultFormatType(property: string): FormatType;
    destroy(): void;
}
//# sourceMappingURL=bundle-selector.display.d.ts.map