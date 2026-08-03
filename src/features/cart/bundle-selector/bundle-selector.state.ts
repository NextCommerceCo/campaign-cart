import Decimal from 'decimal.js';
import type { Logger } from '@/core/logger';
import type { Package } from '@/types/campaign';
import { useCampaignStore } from '@/state/campaign';
import type {
  BundleCard,
  BundleItem,
  BundlePackageState,
  ClassNames,
} from './bundle-selector.types';

// Re-exported for callers/tests that import these from this module's
// original location — the implementations now live in
// bundle-selector.template-state.ts (template extraction/resolution) and
// bundle-selector.selection-state.ts (default/forced card selection).
export {
  extractNestedSlotTemplate,
  extractNestedVariantTemplates,
  resolveBundleTemplates,
} from './bundle-selector.template-state';
export type { ResolvedBundleTemplates } from './bundle-selector.template-state';
export {
  parseForceBundleId,
  resolveForcedBundleId,
  pickDefaultCard,
  pickAndLogDefaultCard,
} from './bundle-selector.selection-state';
export type {
  ForceBundleSpec,
  DefaultCardChoice,
} from './bundle-selector.selection-state';

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
    offerDiscounts: [],
    voucherDiscounts: [],
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
  const propertiesKey = (p?: Record<string, string>): string =>
    p && Object.keys(p).length > 0
      ? JSON.stringify(Object.fromEntries(Object.entries(p).sort()))
      : '';

  type GroupEntry = {
    packageId: number;
    quantity: number;
    properties?: Record<string, string>;
    excludeProperties?: string;
  };
  const groups = new Map<string, GroupEntry>();

  for (const slot of card.slots) {
    const pk = propertiesKey(slot.properties);
    const key = `${slot.activePackageId}|${pk}`;
    const existing = groups.get(key);
    if (existing) {
      existing.quantity += slot.quantity;
    } else {
      groups.set(key, {
        packageId: slot.activePackageId,
        quantity: slot.quantity,
        ...(slot.properties !== undefined && { properties: slot.properties }),
        ...(slot.excludeProperties && {
          excludeProperties: slot.excludeProperties,
        }),
      });
    }
  }

  const multiplier = card.bundleQuantity > 0 ? card.bundleQuantity : 1;
  return Array.from(groups.values()).map(g => ({
    ...g,
    quantity: g.quantity * multiplier,
  }));
}

/**
 * Wires the `_getSelectedBundleItems` / `_getSelectedBundleVouchers` accessors
 * that AddToCartEnhancer reads off the selector element to submit the current
 * selection. `getSelectedCard` is called lazily on each access so the result
 * always reflects the live selection, not the selection at wiring time.
 */
export function attachBundleAccessors(
  element: HTMLElement,
  getSelectedCard: () => BundleCard | null
): void {
  (element as unknown as Record<string, unknown>)['_getSelectedBundleItems'] =
    () => {
      const card = getSelectedCard();
      if (!card) return null;
      const needsVariant = card.slots.some(
        s => s.configurable && !s.variantSelected
      );
      return needsVariant ? null : getEffectiveItems(card);
    };

  (element as unknown as Record<string, unknown>)[
    '_getSelectedBundleVouchers'
  ] = () => getSelectedCard()?.vouchers ?? [];
}

/**
 * Parses the `data-next-class-*` override attributes into the class-name set
 * used throughout rendering and selection state. Falls back to the SDK's
 * default `next-*` class names when an override attribute is absent.
 */
export function parseClassNames(element: HTMLElement): ClassNames {
  const get = (key: string, fallback: string) =>
    element.getAttribute(`data-next-class-${key}`) ?? fallback;
  return {
    bundleCard: get('bundle-card', 'next-bundle-card'),
    selected: get('selected', 'next-selected'),
    inCart: get('in-cart', 'next-in-cart'),
    variantSelected: get('variant-selected', 'next-variant-selected'),
    variantUnavailable: get('variant-unavailable', 'next-variant-unavailable'),
    bundleSlot: get('bundle-slot', 'next-bundle-slot'),
    slotVariantGroup: get('slot-variant-group', 'next-slot-variant-group'),
  };
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
  return trimmed
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

/** Vouchers defined across a single instance's bundle cards. */
export function getBundleVouchers(cards: BundleCard[]): string[] {
  return cards.flatMap(c => c.vouchers);
}

/** Vouchers defined across ALL live BundleSelectorEnhancer instances. */
export function getAllKnownBundleVouchers(
  allCards: BundleCard[][]
): Set<string> {
  return new Set(allCards.flatMap(cards => getBundleVouchers(cards)));
}
