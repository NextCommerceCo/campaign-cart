import { BaseEnhancer } from '../../../core/base/base-enhancer';
import { SelectorItem } from '../../../types/global';
export declare class PackageSelectorEnhancer extends BaseEnhancer {
    private selectorId;
    private mode;
    private template;
    private items;
    private selectedItemRef;
    private clickHandlers;
    private quantityHandlers;
    private mutationObserver;
    private boundCurrencyChangeHandler;
    private currencyChangeTimeout;
    private includeShipping;
    private isUpsellContext;
    initialize(): Promise<void>;
    private makeHandlerContext;
    private setupMutationObserver;
    update(): void;
    getSelectedItem(): SelectorItem | null;
    protected cleanupEventListeners(): void;
    destroy(): void;
}
//# sourceMappingURL=package-selector.enhancer.d.ts.map