export declare function replaceVarsPreservingTemplates(html: string, vars: Record<string, string>): string;
export type DiscountItem = {
    name?: string;
    amount: string;
    description?: string;
};
interface DiscountsByType {
    offerDiscounts: DiscountItem[];
    voucherDiscounts: DiscountItem[];
}
export declare function renderDiscountContainers(root: HTMLElement, data: DiscountsByType): void;
export declare function renderFlatDiscountContainers(root: HTMLElement, discounts: DiscountItem[]): void;
export {};
//# sourceMappingURL=discountRenderer.d.ts.map