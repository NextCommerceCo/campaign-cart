import { default as Decimal } from 'decimal.js';
import { EventMap } from '../../../types/global';
import { Logger } from '../../../utils/logger';
import { DiscountItem } from '../../../shared/utils/discountRenderer';
export interface ClassNames {
    bundleCard: string;
    selected: string;
    inCart: string;
    variantSelected: string;
    variantUnavailable: string;
    bundleSlot: string;
    slotVariantGroup: string;
}
export interface BundleItem {
    packageId: number;
    quantity: number;
    configurable?: boolean;
    noSlot?: boolean;
}
export interface BundleDef {
    id: string;
    items: BundleItem[];
    vouchers?: string[];
    shippingId?: string;
    selected?: boolean;
    [key: string]: unknown;
}
export interface BundleSlot {
    slotIndex: number;
    unitIndex: number;
    originalPackageId: number;
    activePackageId: number;
    quantity: number;
    noSlot?: boolean;
    configurable: boolean;
    variantSelected: boolean;
}
export interface BundlePackageState {
    packageId: number;
    name: string;
    image: string;
    productName: string;
    variantName: string;
    sku: string | null;
    isRecurring: boolean;
    interval: 'day' | 'month' | null;
    intervalCount: number | null;
    recurringPrice: Decimal;
    originalRecurringPrice: Decimal;
    unitPrice: Decimal;
    originalUnitPrice: Decimal;
    discountAmount: Decimal;
    discountPercentage: Decimal;
    originalPrice: Decimal;
    price: Decimal;
    hasDiscount: boolean;
    currency: string;
    discounts: DiscountItem[];
}
export interface BundlePriceSummary {
    price: Decimal;
    originalPrice: Decimal;
    discountAmount: Decimal;
    discountPercentage: Decimal;
    unitPrice: Decimal;
    originalUnitPrice: Decimal;
    quantity: number;
    hasDiscount: boolean;
    currency: string;
}
export interface BundleCard {
    element: HTMLElement;
    bundleId: string;
    name: string;
    items: BundleItem[];
    slots: BundleSlot[];
    isPreSelected: boolean;
    vouchers: string[];
    shippingId?: string;
    packageStates: Map<number, BundlePackageState>;
    bundlePrice: BundlePriceSummary | null;
    slotVarsCache: Map<number, Record<string, string>>;
    offerDiscounts: DiscountItem[];
    voucherDiscounts: DiscountItem[];
}
export interface BundleCardPublicState {
    name: string;
    isSelected: boolean;
    bundlePrice: BundlePriceSummary | null;
}
export interface RenderContext {
    slotTemplate: string;
    variantOptionTemplate: string;
    variantSelectorTemplate: string;
    selectHandlers: Map<HTMLSelectElement, EventListener>;
    logger: Logger;
    classNames: ClassNames;
    onSelectChange: (select: HTMLSelectElement, bundleId: string, slotIndex: number) => Promise<void>;
}
export interface HandlerContext {
    mode: 'swap' | 'select';
    logger: Logger;
    classNames: ClassNames;
    isApplyingRef: {
        value: boolean;
    };
    externalSlotsEl: HTMLElement | null;
    containerElement: HTMLElement;
    isUpsellContext: boolean;
    selectorId: string | null;
    selectCard: (card: BundleCard) => void;
    getSelectedCard: () => BundleCard | null;
    fetchAndUpdateBundlePrice: (card: BundleCard) => Promise<void>;
    emit: <K extends 'bundle:selected' | 'bundle:selection-changed'>(event: K, detail: EventMap[K]) => void;
}
export interface PriceContext {
    includeShipping: boolean;
    allBundleVouchers: Set<string>;
    isUpsellContext: boolean;
    logger: Logger;
}
//# sourceMappingURL=BundleSelectorEnhancer.types.d.ts.map