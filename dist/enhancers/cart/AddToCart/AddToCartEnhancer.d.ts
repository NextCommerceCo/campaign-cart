import { BaseActionEnhancer } from '../../base/BaseActionEnhancer';
export declare class AddToCartEnhancer extends BaseActionEnhancer {
    private packageId?;
    private quantity;
    private selectorId?;
    private redirectUrl?;
    private clearCart;
    private selectedItemRef;
    private clickHandler?;
    private selectorChangeHandler?;
    initialize(): Promise<void>;
    private setupSelectorListener;
    private findSelectorElement;
    private getSelectedItemFromElement;
    private updateButtonState;
    private setEnabled;
    private handleClick;
    private resolveAddTarget;
    private makeHandlerContext;
    update(_data?: unknown): void;
    destroy(): void;
}
//# sourceMappingURL=AddToCartEnhancer.d.ts.map