import { BaseActionEnhancer } from '../../base/BaseActionEnhancer';
export declare class AddToCartEnhancer extends BaseActionEnhancer {
    private packageId?;
    private quantity;
    private selectorId?;
    private redirectUrl?;
    private clearCart;
    private selectedItemRef;
    private propertyContainerSelector?;
    private propertyListenerCleanups;
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
    private attachPropertyInputListeners;
    private syncPropertiesToCart;
    private collectDefaultProperties;
    private collectContainerProperties;
    private resolveProperties;
    private makeHandlerContext;
    update(_data?: unknown): void;
    destroy(): void;
}
//# sourceMappingURL=AddToCartEnhancer.d.ts.map