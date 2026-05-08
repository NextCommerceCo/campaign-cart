import { BaseDisplayEnhancer } from '../../display/DisplayEnhancerCore';
import { FormatType } from '../../display/DisplayEnhancerTypes';
export declare class PackageToggleDisplayEnhancer extends BaseDisplayEnhancer {
    private packageId?;
    private selectionHandler;
    private priceHandler;
    protected parseDisplayAttributes(): void;
    protected setupStoreSubscriptions(): void;
    protected getPropertyValue(): unknown;
    protected getDefaultFormatType(property: string): FormatType;
    destroy(): void;
}
//# sourceMappingURL=PackageToggleEnhancer.display.d.ts.map