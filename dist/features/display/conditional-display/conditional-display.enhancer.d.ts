import { BaseEnhancer } from '../../../core/base/base-enhancer';
export declare class ConditionalDisplayEnhancer extends BaseEnhancer {
    private condition;
    private showCondition;
    private packageContext;
    private selectorId;
    private dependsOnCart;
    private dependsOnPackage;
    private dependsOnSelection;
    private dependsOnOrder;
    private dependsOnShipping;
    private dependsOnParams;
    private selectionChangeHandler;
    initialize(): Promise<void>;
    update(): void;
    private get context();
    private analyzeDependencies;
    private handleCampaignUpdate;
    private handleOrderUpdate;
    private handlePackageUpdate;
    private handleShippingUpdate;
    private handleParamsUpdate;
    private handleStateUpdate;
    private handleSelectionChange;
    private handleSelectionUpdate;
    private detectSelectorContext;
    destroy(): void;
}
//# sourceMappingURL=conditional-display.enhancer.d.ts.map