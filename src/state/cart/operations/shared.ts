import Decimal from 'decimal.js';
import type { CartItem } from '@/types/global';
import { createLogger } from '@/core/logger';

// Logger prefix kept as 'CartStore' so log output is unchanged after the
// api.slice → operations move.
export const logger = createLogger('CartStore');

// Debounce + abort for calculateTotals.
// Debounce coalesces rapid calls (e.g. 3 bundles initializing) into one request.
// AbortController cancels any in-flight fetch when a newer call starts.
const CALC_DEBOUNCE_MS = 150;
let calcTimer: ReturnType<typeof setTimeout> | null = null;
let calcController: AbortController | null = null;

export function scheduleCalculate(
  fn: (signal: AbortSignal) => Promise<void>
): void {
  calcController?.abort();
  calcController = new AbortController();
  const { signal } = calcController;
  if (calcTimer) clearTimeout(calcTimer);
  calcTimer = setTimeout(() => fn(signal), CALC_DEBOUNCE_MS);
}

// Compute subtotal/total/totalQuantity immediately from local item data.
// This gives the UI an instant price update without waiting for the API.
// The API result will override these values with accurate discounts/shipping.
export function optimisticTotals(items: CartItem[]): {
  subtotal: Decimal;
  total: Decimal;
  totalQuantity: number;
  isEmpty: boolean;
} {
  const subtotal = items.reduce(
    (sum, item) => sum.plus(new Decimal(item.price).times(item.quantity)),
    new Decimal(0)
  );
  const totalQuantity = items.reduce((s, i) => s + i.quantity, 0);
  return {
    subtotal,
    total: subtotal,
    totalQuantity,
    isEmpty: items.length === 0,
  };
}
