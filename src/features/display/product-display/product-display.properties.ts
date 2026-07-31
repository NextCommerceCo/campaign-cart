/**
 * Product Display - Property Reading
 * Direct property/value access helpers used by ProductDisplayEnhancer.
 */

import { PropertyResolver } from '@/core/base/base-display-enhancer';
import { getPropertyMapping } from '@/core/base/display-types';
import type { Logger } from '@/core/logger';
import type { Package } from '@/types/global';

export function getPackageValue(packageData: Package, property: string): any {
  // Check for mapped properties
  const mappedPath = getPropertyMapping('package', property);
  if (mappedPath && !mappedPath.startsWith('_calculated.')) {
    return PropertyResolver.getNestedProperty(packageData, mappedPath);
  }

  // For unmapped properties, use PropertyResolver for nested access
  return PropertyResolver.getNestedProperty(packageData, property);
}

export function getCampaignProperty(
  campaignState: any,
  property: string,
  logger: Logger
): any {
  const campaignData = campaignState.data;

  if (!campaignData) {
    return '';
  }

  switch (property) {
    case 'name':
      return campaignData.name;

    case 'currency':
      return campaignData.currency;

    case 'language':
      return campaignData.language;

    default:
      logger.warn(`Unknown campaign property: ${property}`);
      return '';
  }
}

export function isPriceProperty(property: string): boolean {
  const priceProperties = [
    'price',
    'price_total',
    'price_retail',
    'price_retail_total',
    'discountedPrice',
    'discountedPriceTotal',
    'finalPrice',
    'finalPriceTotal',
    'savingsAmount',
    'discountAmount',
  ];
  return priceProperties.includes(property);
}

export function parseNumericValue(value: any): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    // Remove currency symbols and parse
    const cleaned = value.replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}
