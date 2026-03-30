export type TemplateVars = Record<string, string>;
export type DiscountItem = {
    name?: string;
    amount: string;
    description?: string;
};
export interface SummaryFlags {
    isEmpty: boolean;
    hasDiscounts: boolean;
    isFreeShipping: boolean;
    hasShippingDiscount: boolean;
}
//# sourceMappingURL=CartSummaryEnhancer.types.d.ts.map