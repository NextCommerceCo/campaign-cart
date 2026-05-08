import { Package, VariantAttribute } from '../../types/campaign';
export interface VariantOptionInfo {
    value: string;
    packageId: number;
    package: Package;
    isAvailable: boolean;
    sku?: string | null;
}
export interface VariantAttributeInfo {
    code: string;
    name: string;
    values: string[];
    options: VariantOptionInfo[];
}
export declare function extractVariantAttributes(packages: Package[]): VariantAttributeInfo[];
export declare function getRelatedVariants(packages: Package[], basePackage: Package): Package[];
export declare function findPackageByVariant(packages: Package[], variantValues: Record<string, string>): Package | undefined;
export declare function getVariantValues(packages: Package[], attributeCode: string): string[];
export declare function getVariantAttribute(pkg: Package, attributeCode: string): VariantAttribute | undefined;
export declare function isPackageAvailable(pkg: Package): boolean;
export interface VariantMatrixEntry {
    combination: Record<string, string>;
    package: Package;
    isAvailable: boolean;
}
export declare function buildVariantMatrix(packages: Package[], attributeCodes: string[]): VariantMatrixEntry[];
export declare function resolveVariantPackage(packages: Package[], selectedVariants: Record<string, string>): Package | undefined;
export declare function formatVariantOption(attributeCode: string, value: string, pkg?: Package): string;
export declare function areSameProduct(pkg1: Package, pkg2: Package): boolean;
export declare function getVariantCombinations(packages: Package[]): Map<string, Package>;
//# sourceMappingURL=VariantHelper.d.ts.map