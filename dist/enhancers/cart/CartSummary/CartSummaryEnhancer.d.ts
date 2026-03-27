import { BaseEnhancer } from '../../base/BaseEnhancer';
export declare class CartSummaryEnhancer extends BaseEnhancer {
    private customTemplate?;
    private totals?;
    private summary?;
    private itemCount;
    initialize(): Promise<void>;
    update(): void;
    private handleCartUpdate;
    private render;
    private resolveTemplate;
}
//# sourceMappingURL=CartSummaryEnhancer.d.ts.map