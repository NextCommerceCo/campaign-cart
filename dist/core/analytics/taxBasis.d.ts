export type TaxBasis = 'incl' | 'excl';
interface TaxBasisLine {
    package?: number | string;
    quantity?: number | string;
    price_incl_tax_excl_discounts?: string | number;
    price_excl_tax_excl_discounts?: string | number;
}
interface TaxBasisPackage {
    ref_id?: number | string;
    price?: string | number;
}
export declare function resolveOrderTaxBasis(order: {
    lines?: TaxBasisLine[];
} | null | undefined, packages?: TaxBasisPackage[]): TaxBasis;
export {};
//# sourceMappingURL=taxBasis.d.ts.map