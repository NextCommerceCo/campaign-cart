import { CartSummary, LineWithUpsell } from '../../types/api';
import { CartTotals } from '../../types/global';
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
}
export interface CalculateCartParams {
    lines: LineWithUpsell[];
    vouchers?: string[];
    currency?: string | null;
    shippingMethod?: number;
    exclude_shipping?: boolean;
    signal?: AbortSignal;
}
export interface CalculateCartResult {
    totals: CartTotals;
    summary: CartSummary;
}
export declare function calculateCart(params: CalculateCartParams): Promise<CalculateCartResult>;
export declare function calculateBundlePrice(items: BundlePriceItem[], options?: BundlePriceOptions): Promise<CalculateCartResult>;
export declare function buildCartTotals(response: CartSummary, options?: {
    exclude_shipping?: boolean;
    compareTotal?: number;
}): CartTotals;
//# sourceMappingURL=CartCalculator.d.ts.map