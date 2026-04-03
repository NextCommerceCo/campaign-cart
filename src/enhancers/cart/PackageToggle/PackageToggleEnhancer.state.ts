import { useCampaignStore } from '@/stores/campaignStore';
import type { Package } from '@/types/campaign';
import type { TogglePriceSummary } from './PackageToggleEnhancer.types';

function buildFrequency(pkg: Package): string {
  if (!pkg.is_recurring) return 'One time';
  if (pkg.interval_count != null && pkg.interval_count > 1) {
    return `Every ${pkg.interval_count} ${pkg.interval}s`;
  }
  return `Per ${pkg.interval}`;
}

/**
 * Build a provisional TogglePriceSummary from campaign package data.
 * Used at card registration so price slots render immediately with baseline
 * prices before fetchAndUpdateTogglePrice resolves.
 */
export function makeTogglePriceSummary(pkg: Package): TogglePriceSummary {
  return {
    price: parseFloat(pkg.price_total || '0'),
    unitPrice: parseFloat(pkg.price || '0'),
    originalPrice: null,
    originalUnitPrice: null,
    discountAmount: 0,
    discountPercentage: 0,
    hasDiscount: false,
    currency: useCampaignStore.getState().currency ?? '',
    isRecurring: pkg.is_recurring,
    recurringPrice: pkg.price_recurring_total != null
      ? parseFloat(pkg.price_recurring_total)
      : null,
    interval: pkg.interval ?? null,
    intervalCount: pkg.interval_count ?? null,
    frequency: buildFrequency(pkg),
  };
}
