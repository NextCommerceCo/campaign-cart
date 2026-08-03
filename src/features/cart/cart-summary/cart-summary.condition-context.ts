/**
 * Context builders for CartSummary local condition evaluation.
 *
 * Converts raw `SummaryLine` / `DiscountItem` API data into the flat
 * `ItemContext` / `DiscountContext` shapes consumed by the local condition
 * evaluator (`./cart-summary.conditions`) and by the line renderer's
 * `{item.*}` / `{line.*}` template token substitution
 * (`./cart-summary.line-renderer`).
 */

import type { SummaryLine } from '@/types/api';
import type { DiscountItem } from './cart-summary.types';

// ─── Context shapes ──────────────────────────────────────────────────────────

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
  // `line` is a 1:1 alias of `item` so templates can use invoice/order
  // vocabulary interchangeably with the cart-shopper vocabulary. Both fields
  // hold the same `ItemContext` value at the call site.
  line?: ItemContext;
  discount?: DiscountContext;
}

// ─── Context builders ────────────────────────────────────────────────────────

function num(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function nullableNum(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

// Shared by buildItemContext (item.frequency) and the line renderer's
// {item.frequency} / {line.frequency} template token — a single definition
// so the two call sites cannot drift out of sync with each other.
export function computeFrequency(
  interval: 'day' | 'month' | null | undefined,
  count: number | null | undefined
): string {
  if (!interval) return '';
  const n = count ?? 1;
  if (interval === 'day') return n === 1 ? 'Daily' : `Every ${n} days`;
  if (interval === 'month') return n === 1 ? 'Monthly' : `Every ${n} months`;
  return '';
}

export function buildItemContext(line: SummaryLine): ItemContext {
  const unitPrice = num(line.unit_price);
  const originalUnitPrice = num(line.original_unit_price);
  const discountAmount = num(line.total_discount);
  const discountPercentage =
    originalUnitPrice > 0 && originalUnitPrice > unitPrice
      ? Math.round(((originalUnitPrice - unitPrice) / originalUnitPrice) * 100)
      : 0;

  return {
    packageId: line.package_id,
    name: line.name ?? '',
    image: line.image ?? '',
    quantity: line.quantity,
    productName: line.product_name ?? '',
    variantName: line.product_variant_name ?? '',
    sku: line.product_sku ?? '',
    isRecurring: line.is_recurring === true,
    interval: line.interval ?? null,
    intervalCount: line.interval_count ?? null,
    recurringPrice: nullableNum(line.price_recurring),
    originalRecurringPrice: nullableNum(line.original_recurring_price),
    price: num(line.total),
    originalPrice: num(line.subtotal),
    unitPrice,
    originalUnitPrice,
    discountAmount,
    discountPercentage,
    hasDiscount: discountAmount > 0,
    currency: line.currency ?? '',
    frequency: computeFrequency(line.interval, line.interval_count),
  };
}

export function buildDiscountContext(d: DiscountItem): DiscountContext {
  // The renderer always passes a formatted amount string. Strip any non-numeric
  // characters (currency symbols, separators) to recover a comparable number.
  const amountFormatted = d.amount ?? '';
  const stripped = amountFormatted.replace(/[^0-9.\-]/g, '');
  const amount = stripped ? parseFloat(stripped) : 0;
  const percentage = num(d.percentage);
  return {
    name: d.name ?? '',
    amount: Number.isFinite(amount) ? amount : 0,
    amountFormatted,
    description: d.description ?? '',
    percentage,
  };
}
