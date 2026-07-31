import { BaseDisplayEnhancer } from '../../display/display-core';
import { FormatType } from '../../display/display-types';
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