import { default as Decimal } from 'decimal.js';
import { CartSummary, Discount, LineWithUpsell } from '../../types/api';
import { ShippingMethod } from '../../types/global';
export interface BundlePriceItem {
    packageId: number;
    quantity: number;
}
export interface BundlePriceOptions {
    vouchers?: string[];
    currency?: string | null;
    shippingMethod?: number;
    ttl?: number;
    exclude_shipping?: boolean;
    upsell?: boolean;
}
export interface CalculateCartParams {
    lines: LineWithUpsell[];
    vouchers?: string[];
    currency?: string | null;
    shippingMethod?: number;
    exclude_shipping?: boolean;
    upsell?: boolean;
    signal?: AbortSignal;
}
export interface CalculateCartResult {
    vouchers: string[];
    currency?: string;
    offerDiscounts?: Discount[];
    voucherDiscounts?: Discount[];
    subtotal: Decimal;
    shippingMethod?: ShippingMethod;
    hasDiscounts: boolean;
    totalDiscount: Decimal;
    totalDiscountPercentage: Decimal;
    total: Decimal;
    summary?: CartSummary;
}
export declare function calculateCart(params: CalculateCartParams): Promise<CalculateCartResult>;
export declare function calculateBundlePrice(items: BundlePriceItem[], options?: BundlePriceOptions): Promise<CalculateCartResult>;
export declare function buildCartFields(response: CartSummary): Omit<CalculateCartResult, 'summary' | 'vouchers'>;
//# sourceMappingURL=CartCalculator.d.ts.map