import type { Logger } from '@/utils/logger';
import type { Package } from '@/types/campaign';
import type { BundleCard, BundleItem, BundlePackageState } from './BundleSelectorEnhancer.types';

/**
 * Build a BundlePackageState from a campaign Package.
 * Used when registering cards and when a variant change introduces a new packageId.
 * Prices are provisional (campaign baseline) until fetchAndUpdateBundlePrice runs.
 */
export function makePackageState(pkg: Package): BundlePackageState {
  return {
    packageId: pkg.ref_id,
    name: pkg.name || '',
    image: pkg.image || '',
    qty: pkg.qty ?? 1,
    productName: pkg.product_name || '',
    variantName: pkg.product_variant_name || '',
    sku: pkg.product_sku ?? null,
    isRecurring: pkg.is_recurring,
    unitPrice: pkg.price || '',
    packagePrice: pkg.price_total || '',
    originalUnitPrice: pkg.price || '',
    originalPackagePrice: pkg.price_total || '',
    totalDiscount: '0',
    subtotal: pkg.price_total || '',
    total: pkg.price_total || '',
    hasDiscount: false,
    hasSavings: pkg.price_retail != null && pkg.price_retail !== pkg.price,
  };
}

/** Derive the effective BundleItem list from a card's current slot state. */
export function getEffectiveItems(card: BundleCard): BundleItem[] {
  const qtyCounts = new Map<number, number>();
  for (const slot of card.slots) {
    qtyCounts.set(
      slot.activePackageId,
      (qtyCounts.get(slot.activePackageId) ?? 0) + slot.quantity,
    );
  }
  return Array.from(qtyCounts.entries()).map(([packageId, quantity]) => ({
    packageId,
    quantity,
  }));
}

/** Parse the `data-next-bundle-vouchers` attribute into a string array. */
export function parseVouchers(attr: string | null, logger: Logger): string[] {
  if (!attr) return [];
  const trimmed = attr.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed)
        ? parsed.filter((v): v is string => typeof v === 'string')
        : [];
    } catch {
      logger.warn('Invalid JSON in data-next-bundle-vouchers', attr);
      return [];
    }
  }
  return trimmed.split(',').map(s => s.trim()).filter(Boolean);
}
