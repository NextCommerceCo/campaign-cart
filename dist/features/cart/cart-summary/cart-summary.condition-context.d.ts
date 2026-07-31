import { SummaryLine } from '../../../types/api';
import { DiscountItem } from './cart-summary.types';
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
    percentage: number;
}
export interface LocalContext {
    item?: ItemContext;
    line?: ItemContext;
    discount?: DiscountContext;
}
export declare function computeFrequency(interval: 'day' | 'month' | null | undefined, count: number | null | undefined): string;
export declare function buildItemContext(line: SummaryLine): ItemContext;
export declare function buildDiscountContext(d: DiscountItem): DiscountContext;
//# sourceMappingURL=cart-summary.condition-context.d.ts.map