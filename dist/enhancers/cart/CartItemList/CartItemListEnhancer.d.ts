import { BaseEnhancer } from '../../base/BaseEnhancer';
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
//# sourceMappingURL=CartItemListEnhancer.d.ts.map