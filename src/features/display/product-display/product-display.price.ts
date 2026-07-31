/**
 * Product Display - Price Maths
 * Calculated price/savings properties for a package, delegating raw metrics
 * to PriceCalculator and layering discount/savings logic on top.
 */

import { DisplayFormatter } from '@/core/base/base-display-enhancer';
import { getPropertyMapping } from '@/core/base/display-types';
import { PriceCalculator } from '@/features/display/display-core';
import type { Logger } from '@/core/logger';
import type { Package } from '@/types/global';

// PRESERVE: Advanced calculations
export function getCalculatedProperty(
  packageData: Package | undefined,
  property: string,
  logger: Logger
): any {
  if (!packageData) return undefined;

  // Use PriceCalculator for all price metrics
  const calculatorInput = {
    price: parseFloat(packageData.price || '0'),
    retailPrice: parseFloat(packageData.price_retail || '0'),
    quantity: packageData.qty || 1,
    priceTotal: parseFloat(packageData.price_total || '0'),
    retailPriceTotal: parseFloat(packageData.price_retail_total || '0'),
  };

  const metrics = PriceCalculator.calculatePackageMetrics(calculatorInput);

  // Debug logging for savings calculation
  // if (property === 'savingsAmount' || property === 'hasSavings') {
  //   this.logger.debug('[SAVINGS DEBUG] Package savings calculation:', {
  //     packageId: packageData.ref_id,
  //     packageName: packageData.name,
  //     input: calculatorInput,
  //     output: {
  //       totalSavings: metrics.totalSavings,
  //       hasSavings: metrics.hasSavings,
  //       totalPrice: metrics.totalPrice,
  //       totalRetailPrice: metrics.totalRetailPrice
  //     }
  //   });
  // }

  // Check for mapped properties first
  const mappedPath = getPropertyMapping('package', property);
  if (mappedPath && mappedPath.startsWith('_calculated.')) {
    const calculatedProp = mappedPath.replace('_calculated.', '');
    switch (calculatedProp) {
      case 'savingsAmount':
        return metrics.totalSavings;
      case 'savingsPercentage':
        return metrics.totalSavingsPercentage;
      case 'hasSavings':
        return metrics.hasSavings;
      case 'isBundle':
        return (packageData.qty || 1) > 1;
      case 'discountedPrice':
        return calculateDiscountedPrice(packageData);
      case 'discountedPriceTotal':
        return calculateDiscountedPriceTotal(packageData);
      case 'discountAmount':
        return calculatePackageDiscountAmount(packageData);
      case 'hasDiscount':
        return calculatePackageDiscountAmount(packageData) > 0;
      case 'finalPrice':
        return calculateFinalPrice(packageData);
      case 'finalPriceTotal':
        return calculateFinalPriceTotal(packageData);
      case 'totalSavingsAmount':
        return calculateTotalSavingsAmount(packageData);
      case 'totalSavingsPercentage':
        return calculateTotalSavingsPercentage(packageData);
      case 'totalSavingsWithDiscounts':
        return calculateTotalSavingsAmount(packageData); // Alias
      case 'totalSavingsPercentageWithDiscounts':
        return calculateTotalSavingsPercentage(packageData); // Alias
      case 'hasTotalSavings':
        return calculateHasTotalSavings(packageData);
    }
  }

  switch (property) {
    // Standardized camelCase properties
    case 'savingsAmount':
      return metrics.totalSavings;

    case 'savingsPercentage':
      logger.debug(`Savings percentage: ${metrics.totalSavingsPercentage}%`);
      return metrics.totalSavingsPercentage;

    case 'unitPrice':
      return DisplayFormatter.formatCurrency(metrics.unitPrice);

    case 'unitRetailPrice':
      return DisplayFormatter.formatCurrency(metrics.unitRetailPrice);

    case 'unitSavings':
      return DisplayFormatter.formatCurrency(metrics.unitSavings);

    case 'unitSavingsPercentage':
      logger.debug('Returning unitSavingsPercentage', {
        unitSavingsPercentage: metrics.unitSavingsPercentage,
        unitSavingsPercentageType: typeof metrics.unitSavingsPercentage,
      });
      return metrics.unitSavingsPercentage;

    // Boolean helpers
    case 'hasSavings':
      return metrics.hasSavings;

    case 'hasRetailPrice':
      return (
        metrics.unitRetailPrice > 0 &&
        metrics.unitRetailPrice !== metrics.unitPrice
      );

    case 'isBundle':
      return (packageData.qty || 1) > 1;

    case 'isRecurring':
      return packageData.is_recurring === true;

    // Raw values for calculations
    case 'savingsAmount.raw':
      return metrics.totalSavings;

    case 'savingsPercentage.raw':
      return metrics.totalSavingsPercentage;

    case 'unitPrice.raw':
      return metrics.unitPrice;

    case 'unitRetailPrice.raw':
      return metrics.unitRetailPrice;

    // Discount-adjusted prices
    case 'discountedPrice':
      return calculateDiscountedPrice(packageData);

    case 'discountedPriceTotal':
      return calculateDiscountedPriceTotal(packageData);

    case 'discountAmount':
      return calculatePackageDiscountAmount(packageData);

    case 'hasDiscount':
      return calculatePackageDiscountAmount(packageData) > 0;

    case 'finalPrice':
      return calculateFinalPrice(packageData);

    case 'finalPriceTotal':
      return calculateFinalPriceTotal(packageData);

    // Total savings (retail + discounts)
    case 'totalSavingsAmount':
    case 'totalSavingsWithDiscounts':
      return calculateTotalSavingsAmount(packageData);

    case 'totalSavingsPercentage':
    case 'totalSavingsPercentageWithDiscounts':
      return calculateTotalSavingsPercentage(packageData);

    case 'hasTotalSavings':
      return calculateHasTotalSavings(packageData);

    // Raw values for total savings
    case 'totalSavingsAmount.raw':
    case 'totalSavingsWithDiscounts.raw':
      return calculateTotalSavingsAmountRaw(packageData);

    case 'totalSavingsPercentage.raw':
    case 'totalSavingsPercentageWithDiscounts.raw':
      return calculateTotalSavingsPercentageRaw(packageData);

    default:
      return undefined;
  }
}

function calculatePackageDiscountAmount(_packageData: Package): number {
  // Discount amounts are computed server-side and returned in cartState.voucherDiscounts /
  // offerDiscounts. Per-package breakdown is not available here.
  return 0;
}

function calculateDiscountedPrice(packageData: Package): number {
  if (!packageData) return 0;

  const unitPrice = parseFloat(packageData.price || '0');
  const quantity = packageData.qty || 1;
  const discountAmount = calculatePackageDiscountAmount(packageData);

  // Distribute discount across units
  const discountPerUnit = quantity > 0 ? discountAmount / quantity : 0;
  return Math.max(0, unitPrice - discountPerUnit);
}

function calculateDiscountedPriceTotal(packageData: Package): number {
  if (!packageData) return 0;

  const packageTotal =
    parseFloat(packageData.price_total || '0') ||
    parseFloat(packageData.price || '0') * (packageData.qty || 1);
  const discountAmount = calculatePackageDiscountAmount(packageData);

  return Math.max(0, packageTotal - discountAmount);
}

function calculateFinalPrice(packageData: Package): number {
  // Final price is the discounted unit price (same as discountedPrice)
  return calculateDiscountedPrice(packageData);
}

function calculateFinalPriceTotal(packageData: Package): number {
  // Final total is the discounted package total (same as discountedPriceTotal)
  return calculateDiscountedPriceTotal(packageData);
}

function calculateTotalSavingsAmount(packageData: Package): number {
  if (!packageData) return 0;

  // Get retail savings (vs retail price)
  const calculatorInput = {
    price: parseFloat(packageData.price || '0'),
    retailPrice: parseFloat(packageData.price_retail || '0'),
    quantity: packageData.qty || 1,
    priceTotal: parseFloat(packageData.price_total || '0'),
    retailPriceTotal: parseFloat(packageData.price_retail_total || '0'),
  };

  const metrics = PriceCalculator.calculatePackageMetrics(calculatorInput);
  const retailSavings = metrics.totalSavings || 0;

  // Get discount amount from cart coupons
  const discountAmount = calculatePackageDiscountAmount(packageData);

  // Total savings = retail savings + discount amount
  return retailSavings + discountAmount;
}

function calculateTotalSavingsAmountRaw(packageData: Package): number {
  // Return unformatted value
  return calculateTotalSavingsAmount(packageData);
}

function calculateTotalSavingsPercentage(packageData: Package): number {
  if (!packageData) return 0;

  // Get the original retail price (or regular price if no retail)
  const retailTotal =
    parseFloat(packageData.price_retail_total || '0') ||
    parseFloat(packageData.price_total || '0');

  if (retailTotal <= 0) return 0;

  // Final price after all discounts
  const finalPrice = calculateFinalPriceTotal(packageData);

  // Calculate percentage saved from original retail price
  const totalSavings = retailTotal - finalPrice;
  const percentage = (totalSavings / retailTotal) * 100;

  return Math.min(100, Math.max(0, percentage));
}

function calculateTotalSavingsPercentageRaw(packageData: Package): number {
  // Return unformatted value
  return calculateTotalSavingsPercentage(packageData);
}

function calculateHasTotalSavings(packageData: Package): boolean {
  if (!packageData) return false;

  // Check if there's any savings (retail or discount)
  const totalSavings = calculateTotalSavingsAmount(packageData);
  return totalSavings > 0;
}
