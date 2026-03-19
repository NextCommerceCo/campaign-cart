import { BaseEnhancer } from '../base/BaseEnhancer';
export declare class CartItemSlotsEnhancer extends BaseEnhancer {
    private template;
    private emptyTemplate;
    private variantOptionTemplate;
    private slots;
    private isUpdating;
    private selectHandlers;
    private slotFilter;
    private boundVariantOptionClick;
    initialize(): Promise<void>;
    update(): void;
    private handleCartUpdate;
    private matchesFilter;
    private renderSlots;
    private createSlotElement;
    private renderVariantSelectors;
    private renderCustomOptions;
    private handleVariantOptionClick;
    private handleVariantChange;
    private syncCart;
    private cleanupSelectHandlers;
    protected cleanupEventListeners(): void;
    destroy(): void;
}
//# sourceMappingURL=CartItemSlotsEnhancer.d.ts.map