import { BaseDisplayEnhancer } from '../../../core/base/base-display-enhancer';
import { FormatType } from '../../../core/base/display-types';
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
//# sourceMappingURL=package-toggle.display.d.ts.map