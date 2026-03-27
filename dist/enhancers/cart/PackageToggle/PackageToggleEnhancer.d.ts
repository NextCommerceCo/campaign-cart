import { BaseEnhancer } from '../../base/BaseEnhancer';
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
    private makeHandlerContext;
    private scanCards;
    private registerCard;
    private findStateContainer;
    private resolvePackageId;
    private setupMutationObserver;
    private syncWithCart;
    update(): void;
    protected cleanupEventListeners(): void;
    destroy(): void;
}
//# sourceMappingURL=PackageToggleEnhancer.d.ts.map