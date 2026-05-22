import Decimal from 'decimal.js';
import type { Logger } from '@/utils/logger';
import type { Package } from '@/types/campaign';
import { useCampaignStore } from '@/stores/campaignStore';
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
    productName: pkg.product_name || '',
    variantName: pkg.product_variant_name || '',
    sku: pkg.product_sku ?? null,
    isRecurring: pkg.is_recurring,
    interval: pkg.interval ?? null,
    intervalCount: pkg.interval_count ?? null,
    recurringPrice: new Decimal(pkg.price_recurring_total || 0),
    originalRecurringPrice: new Decimal(pkg.price_recurring_total || 0),
    unitPrice: new Decimal(pkg.price_total || 0),
    originalUnitPrice: new Decimal(pkg.price_total || 0),
    discountAmount: new Decimal(0),
    discountPercentage: new Decimal(0),
    originalPrice: new Decimal(pkg.price_total || 0),
    price: new Decimal(pkg.price_total || 0),
    hasDiscount: false,
    currency: useCampaignStore.getState().currency ?? '',
    discounts: [],
  };
}

/**
 * Derive the effective BundleItem list from a card's current slot state.
 * Applies the card's `bundleQuantity` multiplier to every aggregated line —
 * this is the single load-bearing point where the multiplier is folded in,
 * so every downstream consumer (applyBundle, applyEffectiveChange, price
 * fetch, cart sync, event payloads, AddToCart's _getSelectedBundleItems)
 * sees the correctly-multiplied quantities without special-casing.
 */
export function getEffectiveItems(card: BundleCard): BundleItem[] {
  const qtyCounts = new Map<number, number>();
  for (const slot of card.slots) {
    qtyCounts.set(
      slot.activePackageId,
      (qtyCounts.get(slot.activePackageId) ?? 0) + slot.quantity,
    );
  }
  const multiplier = card.bundleQuantity > 0 ? card.bundleQuantity : 1;
  return Array.from(qtyCounts.entries()).map(([packageId, quantity]) => ({
    packageId,
    quantity: quantity * multiplier,
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

/**
 * Extracts nested <template> elements for variant-selector and variant-option
 * wrappers out of a slot template HTML string, returning the stripped slot
 * template plus the extracted template strings (empty when not present).
 *
 * The variant-option template is read from inside the variant-selector
 * template's content because that is the legal authoring structure —
 * [data-next-variant-options] lives inside the variant-selector wrapper.
 */
export function extractNestedVariantTemplates(slotTemplate: string): {
  slot: string;
  variantSelector: string;
  variantOption: string;
} {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = slotTemplate;

  let variantSelector = '';
  let variantOption = '';

  const vsTemplate = wrapper.querySelector<HTMLTemplateElement>(
    '[data-next-variant-selectors] > template',
  );
  if (vsTemplate) {
    const voTemplate = vsTemplate.content.querySelector<HTMLTemplateElement>(
      '[data-next-variant-options] > template',
    );
    if (voTemplate) {
      variantOption = voTemplate.innerHTML.trim();
      voTemplate.remove();
    }
    variantSelector = vsTemplate.innerHTML.trim();
    vsTemplate.remove();
  }

  return { slot: wrapper.innerHTML, variantSelector, variantOption };
}

export interface ForceBundleSpec {
  selectorId: string | null;
  bundleId: string;
}

/**
 * Parse a `forceBundleId` URL-parameter value into per-selector specs.
 *
 * Accepted forms (comma-separated):
 *   "premium"                       → unscoped: matches the first selector containing a card with this id
 *   "tier-selector:premium"         → scoped to selectorId "tier-selector"
 *   "tier:premium,gift:luxury"      → multiple scoped specs
 *
 * Whitespace around tokens is tolerated. Empty/malformed entries are dropped silently
 * (the caller logs at a higher level when nothing matches).
 */
export function parseForceBundleId(raw: string | null | undefined): ForceBundleSpec[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const colonIdx = part.indexOf(':');
      if (colonIdx === -1) {
        return { selectorId: null, bundleId: part };
      }
      const selectorId = part.slice(0, colonIdx).trim();
      const bundleId = part.slice(colonIdx + 1).trim();
      if (!bundleId) return null;
      return { selectorId: selectorId || null, bundleId };
    })
    .filter((s): s is ForceBundleSpec => s !== null);
}

/**
 * Pick the bundleId from a parsed force-spec list that applies to a given selector.
 * Prefers a scoped match (`selectorId:bundleId`) over an unscoped one.
 */
export function resolveForcedBundleId(
  specs: ForceBundleSpec[],
  selectorId: string | null,
): string | null {
  const scoped = specs.find(s => s.selectorId !== null && s.selectorId === selectorId);
  if (scoped) return scoped.bundleId;
  const unscoped = specs.find(s => s.selectorId === null);
  return unscoped ? unscoped.bundleId : null;
}
