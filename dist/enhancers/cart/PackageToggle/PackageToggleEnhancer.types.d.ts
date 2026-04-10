export interface PackageDef {
    packageId: number;
    selected?: boolean;
    packageSync?: string | number[];
    [key: string]: unknown;
}
export interface ToggleCard {
    element: HTMLElement;
    packageId: number;
    name: string;
    image: string;
    productId: number | null;
    variantId: number | null;
    variantName: string;
    productName: string;
    sku: string | null;
    isPreSelected: boolean;
    isSelected: boolean;
    quantity: number;
    isSyncMode: boolean;
    syncPackageIds: number[];
    isUpsell: boolean;
    stateContainer: HTMLElement;
    addText: string | null;
    removeText: string | null;
    price: number;
    unitPrice: number;
    originalPrice: number | null;
    originalUnitPrice: number | null;
    discountAmount: number;
    discountPercentage: number;
    hasDiscount: boolean;
    currency: string;
    isRecurring: boolean;
    recurringPrice: number | null;
    originalRecurringPrice: number | null;
    interval: 'day' | 'month' | null;
    intervalCount: number | null;
    frequency: string;
    discounts: import('../../../shared/utils/discountRenderer').DiscountItem[];
}
//# sourceMappingURL=PackageToggleEnhancer.types.d.ts.map