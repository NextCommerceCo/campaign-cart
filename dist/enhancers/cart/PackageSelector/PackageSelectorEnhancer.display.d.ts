import { BaseDisplayEnhancer } from '../../display/DisplayEnhancerCore';
import { FormatType } from '../../display/DisplayEnhancerTypes';
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
//# sourceMappingURL=PackageSelectorEnhancer.display.d.ts.map