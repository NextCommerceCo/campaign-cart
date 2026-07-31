import { PropertyResolver } from '@/core/base/base-display-enhancer';
import { PriceCalculator } from '@/features/display/display-core';
import { useCampaignStore } from '@/state/campaign';
import type { Package } from '@/types/campaign';
import type { ConditionalDisplayContext } from './conditional-display.types';

/**
 * Reads a `package.*` property for the package this element sits inside.
 */
export function getPackagePropertyValue(
  ctx: ConditionalDisplayContext,
  property: string
): any {
  if (!ctx.packageContext) {
    ctx.logger.warn('Package condition used but no package context found');
    return null;
  }

  try {
    const campaignStore = useCampaignStore.getState();
    const packageData = campaignStore.getPackage(ctx.packageContext);

    if (!packageData) {
      ctx.logger.warn(
        `Package ${ctx.packageContext} not found in campaign data`
      );
      return null;
    }

    // Use direct property access - legacy mapping has been removed
    return calculatePackageProperty(packageData, property);
  } catch (error) {
    ctx.logger.error(`Error getting package property ${property}:`, error);
    return null;
  }
}

/**
 * Resolves one property name against a package's raw campaign data,
 * deriving price/savings metrics through `PriceCalculator`.
 */
export function calculatePackageProperty(
  packageData: Package,
  property: string
): any {
  const price = parseFloat(packageData.price) || 0;
  const priceRetail =
    parseFloat(packageData.price_retail || packageData.price) || 0;
  const priceTotal =
    parseFloat(packageData.price_total || '0') ||
    price * (packageData.qty || 1);
  const priceRetailTotal =
    parseFloat(packageData.price_retail_total || '0') ||
    priceRetail * (packageData.qty || 1);
  const quantity = packageData.qty || 1;

  // Use PriceCalculator for price metrics
  const metrics = PriceCalculator.calculatePackageMetrics({
    price,
    retailPrice: priceRetail,
    quantity,
    priceTotal,
    retailPriceTotal: priceRetailTotal,
  });

  // Handle property access with standardized names
  switch (property) {
    // Basic properties
    case 'name':
      return packageData.name;
    case 'price':
      return price;
    case 'quantity':
    case 'qty':
      return quantity;
    case 'image':
      return packageData.image;
    case 'isRecurring':
      return packageData.is_recurring;
    case 'interval':
      return packageData.interval;
    case 'intervalCount':
      return packageData.interval_count;

    // Calculated properties using PriceCalculator
    case 'hasRetailPrice':
      return priceRetail > 0 && priceRetail !== price;
    case 'hasSavings':
      return metrics.hasSavings;
    case 'savingsAmount':
      return metrics.totalSavings;
    case 'savingsPercentage':
      return metrics.totalSavingsPercentage;

    // Total calculations
    case 'priceRetailTotal':
      return metrics.totalRetailPrice;
    case 'totalSavings':
      return metrics.totalSavings;
    case 'totalSavingsPercentage':
      return metrics.totalSavingsPercentage;

    // Unit pricing
    case 'unitPrice':
      return metrics.unitPrice;
    case 'unitRetailPrice':
      return metrics.unitRetailPrice;
    case 'unitSavings':
      return metrics.unitSavings;
    case 'unitSavingsPercentage':
      return metrics.unitSavingsPercentage;

    // Boolean checks
    case 'isBundle':
      return quantity > 1;
    case 'hasDiscount':
      return metrics.hasSavings;
    case 'isSubscription':
      return packageData.is_recurring === true;
    case 'isOneTime':
      return !packageData.is_recurring;

    // Raw value access
    case 'price.raw':
      return price;
    case 'priceRetail.raw':
      return priceRetail;
    case 'savingsAmount.raw':
      return metrics.totalSavings;

    default:
      // Use PropertyResolver for direct property access as fallback
      return PropertyResolver.getNestedProperty(packageData, property);
  }
}
