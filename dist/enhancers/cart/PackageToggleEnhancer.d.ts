import { BaseEnhancer } from '../base/BaseEnhancer';
export declare class PackageToggleEnhancer extends BaseEnhancer {
    private template;
    private cards;
    private clickHandlers;
    private mutationObserver;
    private boundCurrencyChangeHandler;
    private currencyChangeTimeout;
    private priceSyncDebounce;
    private includeShipping;
    private autoAddInProgress;
    initialize(): Promise<void>;
    private renderToggleTemplate;
    private renderToggleImage;
    private findStateContainer;
    private resolvePackageId;
    private scanCards;
    private registerCard;
    private setupMutationObserver;
    private handleCardClick;
    private addToCart;
    private syncWithCart;
    private updateSyncedQuantity;
    private handleSyncUpdate;
    private fetchAndUpdateTogglePrice;
    private renderTogglePrice;
    update(): void;
    protected cleanupEventListeners(): void;
    destroy(): void;
}
//# sourceMappingURL=PackageToggleEnhancer.d.ts.map