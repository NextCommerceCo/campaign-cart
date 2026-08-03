import { Package, SelectorItem, CartState } from '../../../types/global';
export interface SelectionPriceContext {
    selectedItem: SelectorItem | null;
    packageData: Package | undefined;
    cartState: CartState | undefined;
}
export interface LoadPackageDataResult {
    changed: boolean;
    packageData?: Package;
}
//# sourceMappingURL=selection-display.types.d.ts.map