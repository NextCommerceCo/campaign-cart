import { BaseEnhancer } from '../../../core/base/base-enhancer';
export declare class CartSummaryEnhancer extends BaseEnhancer {
    private customTemplate?;
    private cartState?;
    private summary?;
    private itemCount;
    initialize(): Promise<void>;
    update(): void;
    private handleCartUpdate;
    private render;
    private resolveTemplate;
}
//# sourceMappingURL=cart-summary.enhancer.d.ts.map