import { SummaryLine } from '../../../types/api';
import { DiscountItem } from './CartSummaryEnhancer.types';
export interface ItemContext {
    packageId: number;
    name: string;
    image: string;
    quantity: number;
    productName: string;
    variantName: string;
    sku: string;
    isRecurring: boolean;
    interval: 'day' | 'month' | null;
    intervalCount: number | null;
    recurringPrice: number | null;
    originalRecurringPrice: number | null;
    price: number;
    originalPrice: number;
    unitPrice: number;
    originalUnitPrice: number;
    discountAmount: number;
    discountPercentage: number;
    hasDiscount: boolean;
    currency: string;
    frequency: string;
}
export interface DiscountContext {
    name: string;
    amount: number;
    amountFormatted: string;
    description: string;
}
export interface LocalContext {
    item?: ItemContext;
    line?: ItemContext;
    discount?: DiscountContext;
}
export declare function buildItemContext(line: SummaryLine): ItemContext;
export declare function buildDiscountContext(d: DiscountItem): DiscountContext;
type EvalResult = {
    handled: true;
    visible: boolean;
} | {
    handled: false;
};
export declare function evaluateLocalCondition(parsed: unknown, ctx: LocalContext): EvalResult;
export declare function applyLocalConditions(rootEl: Element, ctx: LocalContext, warn?: (msg: string) => void): boolean;
export {};
//# sourceMappingURL=CartSummaryEnhancer.conditions.d.ts.map