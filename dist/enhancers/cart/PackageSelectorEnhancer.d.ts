import { BaseEnhancer } from '../base/BaseEnhancer';
import { SelectorItem } from '../../types/global';
export declare class PackageSelectorEnhancer extends BaseEnhancer {
    private selectorId;
    private mode;
    private template;
    private items;
    private selectedItem;
    private clickHandlers;
    private quantityHandlers;
    private mutationObserver;
    private boundCurrencyChangeHandler;
    private currencyChangeTimeout;
    private includeShipping;
    initialize(): Promise<void>;
    private renderPackageTemplate;
    private scanCards;
    private registerCard;
    private updateItemPackageData;
    private setupQuantityControls;
    private handleQuantityChange;
    private setupMutationObserver;
    private handlePackageIdChange;
    private handleCardRemoval;
    private handleCardClick;
    private selectItem;
    private updateCart;
    private setShippingMethod;
    private fetchAndUpdatePrice;
    private syncWithCart;
    update(): void;
    getSelectedItem(): SelectorItem | null;
    protected cleanupEventListeners(): void;
    destroy(): void;
}
//# sourceMappingURL=PackageSelectorEnhancer.d.ts.map