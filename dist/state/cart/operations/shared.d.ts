import { default as Decimal } from 'decimal.js';
import { CartItem } from '../../../types/global';
export declare const logger: import('../../../core/logger').Logger;
export declare function scheduleCalculate(fn: (signal: AbortSignal) => Promise<void>): void;
export declare function optimisticTotals(items: CartItem[]): {
    subtotal: Decimal;
    total: Decimal;
    totalQuantity: number;
    isEmpty: boolean;
};
//# sourceMappingURL=shared.d.ts.map