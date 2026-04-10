import { useCampaignStore } from '@/stores/campaignStore';
import type { Package } from '@/types/campaign';
import type { ToggleCard } from './PackageToggleEnhancer.types';

type PriceFields = Pick<ToggleCard,
  | 'price' | 'unitPrice' | 'originalPrice' | 'originalUnitPrice'
  | 'discountAmount' | 'discountPercentage' | 'hasDiscount'
  | 'isRecurring' | 'recurringPrice' | 'originalRecurringPrice'
  | 'interval' | 'intervalCount' | 'frequency' | 'currency'
>;

function buildFrequency(pkg: Package): string {
  if (!pkg.is_recurring) return 'One time';
  if (pkg.interval_count != null && pkg.interval_count > 1) {
    return `Every ${pkg.interval_count} ${pkg.interval}s`;
  }
  return `Per ${pkg.interval}`;
}

/**
 * Build provisional price fields from campaign package data.
 * Used at card registration so price slots render immediately with baseline
 * prices before fetchAndUpdateTogglePrice resolves.
 */
export function makeProvisionalPrices(pkg?: Package | null): PriceFields {
  return {
    price: pkg ? parseFloat(pkg.price_total || '0') : 0,
    unitPrice: pkg ? parseFloat(pkg.price || '0') : 0,
    originalPrice: null,
    originalUnitPrice: null,
    discountAmount: 0,
    discountPercentage: 0,
    hasDiscount: false,
    currency: useCampaignStore.getState().currency ?? '',
    isRecurring: pkg?.is_recurring ?? false,
    recurringPrice: pkg?.price_recurring_total != null
      ? parseFloat(pkg.price_recurring_total)
      : null,
    originalRecurringPrice: null,
    interval: pkg?.interval ?? null,
    intervalCount: pkg?.interval_count ?? null,
    frequency: pkg ? buildFrequency(pkg) : 'One time',
  };
}
