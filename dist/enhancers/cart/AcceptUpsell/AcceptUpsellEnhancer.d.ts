import { BaseActionEnhancer } from '../../base/BaseActionEnhancer';
export declare class AcceptUpsellEnhancer extends BaseActionEnhancer {
    private packageId?;
    private quantity;
    private selectorId?;
    private bundleSelectorId?;
    private bundleItemsRef;
    private nextUrl?;
    private apiClient;
    private loadingOverlay;
    private selectedItemRef;
    private readonly boundHandleClick;
    private readonly boundHandlePageShow;
    private readonly boundHandleSelectorChange;
    private readonly boundHandleBundleSelectionChange;
    initialize(): Promise<void>;
    private setupSelectorListener;
    private setupBundleSelectorListener;
    private findBundleSelectorElement;
    private readBundleItems;
    private handleBundleSelectionChange;
    private findSelectorElement;
    private readSelectedItem;
    private handleSelectorChange;
    private handlePageShow;
    private updateButtonState;
    private setEnabled;
    private makeContext;
    private handleClick;
    triggerAcceptUpsell(): Promise<void>;
    update(_data?: unknown): void;
    destroy(): void;
}
//# sourceMappingURL=AcceptUpsellEnhancer.d.ts.map