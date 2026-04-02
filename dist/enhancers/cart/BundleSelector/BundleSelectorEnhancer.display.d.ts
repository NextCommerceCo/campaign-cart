import { BaseDisplayEnhancer } from '../../display/DisplayEnhancerCore';
import { FormatType } from '../../display/DisplayEnhancerTypes';
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
//# sourceMappingURL=BundleSelectorEnhancer.display.d.ts.map