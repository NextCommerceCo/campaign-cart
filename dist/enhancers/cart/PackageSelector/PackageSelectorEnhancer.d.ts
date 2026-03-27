import { BaseEnhancer } from '../../base/BaseEnhancer';
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
    initialize(): Promise<void>;
    private makeHandlerContext;
    private scanCards;
    private registerCard;
    private updateItemPackageData;
    private setupMutationObserver;
    private handlePackageIdChange;
    private handleCardRemoval;
    private syncWithCart;
    update(): void;
    getSelectedItem(): SelectorItem | null;
    protected cleanupEventListeners(): void;
    destroy(): void;
}
//# sourceMappingURL=PackageSelectorEnhancer.d.ts.map