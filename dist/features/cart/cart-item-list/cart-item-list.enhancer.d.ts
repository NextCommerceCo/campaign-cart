import { BaseEnhancer } from '../../../core/base/base-enhancer';
export declare class CartItemListEnhancer extends BaseEnhancer {
    private template?;
    private emptyTemplate?;
    private titleMap?;
    private lastRenderedItems;
    private groupItems;
    initialize(): Promise<void>;
    update(data?: unknown): void;
    private handleCartUpdate;
    private renderEmptyCart;
    private renderCartItems;
    private enhanceNewElements;
    getItemCount(): number;
    getItemElements(): NodeListOf<Element>;
    refreshItem(_packageId: number): void;
}
//# sourceMappingURL=cart-item-list.enhancer.d.ts.map