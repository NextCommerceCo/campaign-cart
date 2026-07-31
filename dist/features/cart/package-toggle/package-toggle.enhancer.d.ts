import { BaseEnhancer } from '../../../core/base/base-enhancer';
import { ToggleCard } from './package-toggle.types';
export declare class PackageToggleEnhancer extends BaseEnhancer {
    private static _instances;
    static getToggleState(packageId: number): ToggleCard | null;
    private template;
    private cards;
    private clickHandlers;
    private mutationObserver;
    private boundCurrencyChangeHandler;
    private currencyChangeTimeout;
    private priceSyncDebounce;
    private includeShipping;
    private autoAddInProgress;
    private isUpsellContext;
    private isProcessingRef;
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
//# sourceMappingURL=package-toggle.enhancer.d.ts.map