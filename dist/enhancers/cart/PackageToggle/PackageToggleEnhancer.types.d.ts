export interface PackageDef {
    packageId: number;
    selected?: boolean;
    [key: string]: unknown;
}
export interface TogglePackageState {
    packageId: number;
    name: string;
    image: string;
    quantity: number;
    productId: number | null;
    variantId: number | null;
    variantName: string;
    productName: string;
    sku: string | null;
    isRecurring: boolean;
    interval: 'day' | 'month' | null;
    intervalCount: number | null;
}
export interface TogglePriceSummary {
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
    interval: 'day' | 'month' | null;
    intervalCount: number | null;
    frequency: string;
}
export interface ToggleCardPublicState {
    name: string;
    isSelected: boolean;
    togglePrice: TogglePriceSummary | null;
}
export interface ToggleCard {
    element: HTMLElement;
    packageId: number;
    name: string;
    isPreSelected: boolean;
    isSelected: boolean;
    quantity: number;
    isSyncMode: boolean;
    syncPackageIds: number[];
    isUpsell: boolean;
    stateContainer: HTMLElement;
    addText: string | null;
    removeText: string | null;
    togglePrice: TogglePriceSummary | null;
}
//# sourceMappingURL=PackageToggleEnhancer.types.d.ts.map