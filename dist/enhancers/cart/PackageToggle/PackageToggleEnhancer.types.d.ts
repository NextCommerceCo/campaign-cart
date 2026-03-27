export interface PackageDef {
    packageId: number;
    selected?: boolean;
    [key: string]: unknown;
}
export interface ToggleCard {
    element: HTMLElement;
    packageId: number;
    isPreSelected: boolean;
    quantity: number;
    isSyncMode: boolean;
    syncPackageIds: number[];
    isUpsell: boolean;
    stateContainer: HTMLElement;
    addText: string | null;
    removeText: string | null;
}
//# sourceMappingURL=PackageToggleEnhancer.types.d.ts.map