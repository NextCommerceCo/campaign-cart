import { BaseDisplayEnhancer } from '../../../core/base/base-display-enhancer';
export declare class SelectionDisplayEnhancer extends BaseDisplayEnhancer {
    private selectorId?;
    private selectedItem;
    private packageData?;
    private campaignState?;
    private cartState?;
    private selectionChangeHandler;
    initialize(): Promise<void>;
    protected parseDisplayAttributes(): void;
    protected setupStoreSubscriptions(): void;
    private handleCampaignUpdate;
    private handleCartUpdate;
    private handleSelectionChange;
    private applySelectedItem;
    private applyPackageData;
    private getPriceContext;
    protected getPropertyValue(): any;
    protected performInitialUpdate(): Promise<void>;
    protected updateDisplay(): Promise<void>;
    destroy(): void;
}
//# sourceMappingURL=selection-display.enhancer.d.ts.map