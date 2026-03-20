import { BaseEnhancer } from '../base/BaseEnhancer';
export declare class CartSummaryEnhancer extends BaseEnhancer {
    private customTemplate?;
    private totals?;
    private summary?;
    private itemCount;
    initialize(): Promise<void>;
    update(): void;
    private handleCartUpdate;
    private render;
    private renderDefault;
    private renderCustom;
    private renderListContainers;
    private renderLines;
    private buildLineElement;
    private renderDiscountList;
    private clearListItems;
    private renderDiscountItem;
    private renderSummaryLine;
    private updateStateClasses;
    private toggleElementClass;
    private buildVars;
    private resolveTemplate;
}
//# sourceMappingURL=CartSummaryEnhancer.d.ts.map