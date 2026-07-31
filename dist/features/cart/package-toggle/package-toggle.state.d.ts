import { Package } from '../../../types/campaign';
import { ToggleCard } from './package-toggle.types';
type PriceFields = Pick<ToggleCard, 'price' | 'unitPrice' | 'originalPrice' | 'originalUnitPrice' | 'discountAmount' | 'discountPercentage' | 'hasDiscount' | 'isRecurring' | 'recurringPrice' | 'originalRecurringPrice' | 'interval' | 'intervalCount' | 'frequency' | 'currency'>;
export declare function makeProvisionalPrices(pkg?: Package | null): PriceFields;
export {};
//# sourceMappingURL=package-toggle.state.d.ts.map