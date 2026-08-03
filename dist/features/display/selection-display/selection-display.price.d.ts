import { SelectionPriceContext } from './selection-display.types';
export declare function getSelectionPrice(ctx: SelectionPriceContext): number;
export declare function getSelectionTotal(ctx: SelectionPriceContext): number;
export declare function getSelectionCompareTotal(ctx: SelectionPriceContext): number;
export declare function getSelectionMetrics(ctx: SelectionPriceContext): {
    total: number;
    compareTotal: number;
    savings: number;
    savingsPercentage: number;
};
export declare function getSelectionSavingsAmount(ctx: SelectionPriceContext): number;
export declare function getSelectionSavingsPercentageFormatted(ctx: SelectionPriceContext): number;
export declare function getSelectionHasSavings(ctx: SelectionPriceContext): boolean;
export declare function getSelectionUnitPrice(ctx: SelectionPriceContext): number;
export declare function getSelectionTotalUnits(ctx: SelectionPriceContext): number;
export declare function getSelectionDiscountAmount(ctx: SelectionPriceContext): number;
export declare function getSelectionIsBundle(ctx: SelectionPriceContext): boolean;
export declare function calculateSelectionDiscountAmount(_ctx: SelectionPriceContext): number;
export declare function calculateSelectionDiscountedPrice(ctx: SelectionPriceContext): number;
export declare function getSelectionHasDiscount(ctx: SelectionPriceContext): boolean;
export declare function getSelectionDiscountPercentage(_ctx: SelectionPriceContext): number;
export declare function getSelectionAppliedDiscounts(_ctx: SelectionPriceContext): Array<{
    code: string;
    amount: number;
}>;
export declare function parseCalculatedField(field: string, ctx: SelectionPriceContext, resolvePropertyValue: (property: string) => unknown): number | undefined;
//# sourceMappingURL=selection-display.price.d.ts.map