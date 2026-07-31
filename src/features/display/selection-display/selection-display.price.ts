/**
 * Price and discount maths for SelectionDisplayEnhancer.
 * Pure functions over an explicit SelectionPriceContext — no reads off `this`.
 */

import { PriceCalculator } from '@/features/display/display-core';
import type { SelectionPriceContext } from './selection-display.types';

export function getSelectionPrice(ctx: SelectionPriceContext): number {
  if (!ctx.selectedItem) return 0;

  if (ctx.packageData) {
    return parseFloat(ctx.packageData.price || '0');
  }

  return ctx.selectedItem.price || 0;
}

export function getSelectionTotal(ctx: SelectionPriceContext): number {
  if (!ctx.selectedItem) return 0;

  if (ctx.packageData) {
    return (
      parseFloat(ctx.packageData.price_total || '0') ||
      parseFloat(ctx.packageData.price || '0') * ctx.selectedItem.quantity
    );
  }

  return (ctx.selectedItem.price || 0) * ctx.selectedItem.quantity;
}

export function getSelectionCompareTotal(ctx: SelectionPriceContext): number {
  if (!ctx.selectedItem || !ctx.packageData) return 0;

  const retailTotal = parseFloat(ctx.packageData.price_retail_total || '0');
  if (retailTotal > 0) return retailTotal;

  const retailPrice = parseFloat(ctx.packageData.price_retail || '0');
  if (retailPrice > 0) {
    return retailPrice * ctx.selectedItem.quantity;
  }

  return getSelectionTotal(ctx);
}

export function getSelectionMetrics(ctx: SelectionPriceContext) {
  const total = getSelectionTotal(ctx);
  const compareTotal = getSelectionCompareTotal(ctx);

  return {
    total,
    compareTotal,
    savings: PriceCalculator.calculateSavings(compareTotal, total),
    savingsPercentage: PriceCalculator.calculateSavingsPercentage(
      compareTotal,
      total
    ),
  };
}

export function getSelectionSavingsAmount(ctx: SelectionPriceContext): number {
  return getSelectionMetrics(ctx).savings;
}

export function getSelectionSavingsPercentageFormatted(
  ctx: SelectionPriceContext
): number {
  return getSelectionMetrics(ctx).savingsPercentage;
}

export function getSelectionHasSavings(ctx: SelectionPriceContext): boolean {
  return getSelectionMetrics(ctx).savings > 0;
}

export function getSelectionUnitPrice(ctx: SelectionPriceContext): number {
  const total = getSelectionTotal(ctx);
  const units = getSelectionTotalUnits(ctx);
  return units > 0 ? total / units : 0;
}

export function getSelectionTotalUnits(ctx: SelectionPriceContext): number {
  if (!ctx.selectedItem) return 0;
  // Return package qty (units in the package) not cart quantity
  return ctx.packageData?.qty || 1;
}

export function getSelectionDiscountAmount(ctx: SelectionPriceContext): number {
  // Same as savings but might be used for different display contexts
  return getSelectionSavingsAmount(ctx);
}

export function getSelectionIsBundle(ctx: SelectionPriceContext): boolean {
  return getSelectionTotalUnits(ctx) > 1;
}

// Discount calculation methods
export function calculateSelectionDiscountAmount(
  _ctx: SelectionPriceContext
): number {
  // Discount amounts are computed server-side and returned in cartState.voucherDiscounts /
  // offerDiscounts. Per-selection breakdown is not available here.
  return 0;
}

export function calculateSelectionDiscountedPrice(
  ctx: SelectionPriceContext
): number {
  return getSelectionPrice(ctx);
}

export function getSelectionHasDiscount(ctx: SelectionPriceContext): boolean {
  return (ctx.cartState?.hasDiscounts ?? false) && !ctx.cartState?.isEmpty;
}

export function getSelectionDiscountPercentage(
  _ctx: SelectionPriceContext
): number {
  return 0;
}

export function getSelectionAppliedDiscounts(
  _ctx: SelectionPriceContext
): Array<{ code: string; amount: number }> {
  return [];
}

/**
 * Parse custom calculated fields with mathematical expressions, e.g.
 * "total*0.1" for 10% of total, or "price+5" for price plus 5.
 *
 * `resolvePropertyValue` lets the caller resolve an arbitrary display
 * property (delegating back to the enhancer's full property router) for the
 * left-hand side of the expression when it isn't one of the known price
 * shorthands.
 */
export function parseCalculatedField(
  field: string,
  ctx: SelectionPriceContext,
  resolvePropertyValue: (property: string) => unknown
): number | undefined {
  if (!ctx.selectedItem || !field) return undefined;

  const operators = ['+', '-', '*', '/'];

  for (const op of operators) {
    if (field.includes(op)) {
      const parts = field.split(op);
      if (parts.length === 2) {
        const leftProperty = parts[0]?.trim() || '';
        const rightValue = parseFloat(parts[1]?.trim() || '0');

        // Get the base value for the left side
        let leftValue: number = 0;
        switch (leftProperty) {
          case 'total':
          case 'price_total':
            leftValue = getSelectionTotal(ctx);
            break;
          case 'price':
            leftValue = getSelectionPrice(ctx);
            break;
          case 'savings':
          case 'savingsAmount':
            leftValue = getSelectionSavingsAmount(ctx);
            break;
          case 'compareTotal':
            leftValue = getSelectionCompareTotal(ctx);
            break;
          default: {
            const value = resolvePropertyValue(leftProperty);
            leftValue = typeof value === 'number' ? value : 0;
          }
        }

        if (!isNaN(rightValue)) {
          switch (op) {
            case '+':
              return leftValue + rightValue;
            case '-':
              return leftValue - rightValue;
            case '*':
              return leftValue * rightValue;
            case '/':
              return rightValue !== 0 ? leftValue / rightValue : 0;
          }
        }
      }
    }
  }

  return undefined;
}
