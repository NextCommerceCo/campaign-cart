import { BaseEnhancer } from '../base/BaseEnhancer';
interface BundleItem {
    packageId: number;
    quantity: number;
    configurable?: boolean;
    noSlot?: boolean;
}
interface BundleSlot {
    slotIndex: number;
    unitIndex: number;
    originalPackageId: number;
    activePackageId: number;
    quantity: number;
    noSlot?: boolean;
}
interface BundleCard {
    element: HTMLElement;
    bundleId: string;
    items: BundleItem[];
    slots: BundleSlot[];
    isPreSelected: boolean;
    vouchers: string[];
}
export declare class BundleSelectorEnhancer extends BaseEnhancer {
    private mode;
    private template;
    private slotTemplate;
    private variantOptionTemplate;
    private cards;
    private selectedCard;
    private clickHandlers;
    private selectHandlers;
    private mutationObserver;
    private boundVariantOptionClick;
    private boundCurrencyChangeHandler;
    private isApplying;
    private includeShipping;
    private previewLines;
    private currencyChangeTimeout;
    initialize(): Promise<void>;
    private renderBundleTemplate;
    private scanCards;
    private registerCard;
    private setupMutationObserver;
    private renderSlotsForCard;
    private createSlotElement;
    private renderVariantSelectors;
    private isVariantValueAvailable;
    private renderCustomOptions;
    private handleVariantOptionClick;
    private handleSelectVariantChange;
    private applyVariantChange;
    private handleCardClick;
    private selectCard;
    private getEffectiveItems;
    private applyBundle;
    private applyEffectiveChange;
    private fetchAndUpdateBundlePrice;
    private parseVouchers;
    private applyVoucherSwap;
    private syncWithCart;
    update(): void;
    getSelectedCard(): BundleCard | null;
    protected cleanupEventListeners(): void;
    destroy(): void;
}
export {};
//# sourceMappingURL=BundleSelectorEnhancer.d.ts.map