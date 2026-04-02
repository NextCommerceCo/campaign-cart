import type { EventMap } from '@/types/global';
import type { Logger } from '@/utils/logger';

export interface ClassNames {
  bundleCard: string;
  selected: string;
  inCart: string;
  variantSelected: string;
  variantUnavailable: string;
  bundleSlot: string;
  slotVariantGroup: string;
}

export interface BundleItem {
  packageId: number;
  quantity: number;
  /**
   * When true, a quantity > 1 is expanded into individual slots so the visitor
   * can configure color / size (or any variant) independently per unit.
   */
  configurable?: boolean;
  /**
   * When true, no slot row is rendered for this item even when a slot template
   * is configured. Useful for silent add-ons like free gifts.
   */
  noSlot?: boolean;
}

export interface BundleDef {
  id: string;
  items: BundleItem[];
  vouchers?: string[];
  /** When true, pre-selects this card on init. Equivalent to data-next-selected="true" on the rendered element. */
  selected?: boolean;
  [key: string]: unknown;
}

/** Tracks one item slot within a bundle card, with variant override support. */
export interface BundleSlot {
  slotIndex: number;
  /** 0-based index within the units expanded from this item. Always 0 for non-configurable. */
  unitIndex: number;
  /** Package as originally defined in the bundle. */
  originalPackageId: number;
  /** Currently active package (may differ after the user selects a variant). */
  activePackageId: number;
  quantity: number;
  /** When true, no slot row is rendered for this slot. */
  noSlot?: boolean;
  /** When true, the user must select a variant before this slot can be submitted. */
  configurable: boolean;
  /** Set to true once the user has explicitly selected a variant for this slot. */
  variantSelected: boolean;
}

/**
 * Per-package state owned by a BundleCard.
 * Initially populated from campaign package base data (provisional prices).
 * Updated with bundle-computed prices after fetchAndUpdateBundlePrice resolves.
 * This is the single source of truth for slot rendering — no campaign store
 * fallback, no separate previewLines map.
 */
export interface BundlePackageState {
  packageId: number;
  // Static display data from campaign package:
  name: string;
  image: string;
  qty: number;
  productName: string;
  variantName: string;
  sku: string | null;
  isRecurring: boolean;
  // Prices — start as campaign package prices, replaced by bundle-computed after fetch:
  unitPrice: string;
  packagePrice: string;
  originalUnitPrice: string;
  originalPackagePrice: string;
  totalDiscount: string;
  subtotal: string;
  total: string;
  hasDiscount: boolean;
  hasSavings: boolean;
}

/** Aggregate bundle price summary stored on BundleCard after price fetch. */
export interface BundlePriceSummary {
  total: number;
  subtotal: number;
  totalDiscount: number;
  totalDiscountPercentage: number;
}

export interface BundleCard {
  element: HTMLElement;
  bundleId: string;
  /** Display name from data-next-bundle-name on the card element. */
  name: string;
  items: BundleItem[];
  slots: BundleSlot[];
  isPreSelected: boolean;
  /** Voucher/coupon codes to apply when this bundle is selected. */
  vouchers: string[];
  /**
   * Bundle-owned package data. Keyed by packageId (= campaign Package.ref_id).
   * Initially populated from campaign packages on card registration.
   * Updated with bundle-computed prices after fetchAndUpdateBundlePrice.
   */
  packageStates: Map<number, BundlePackageState>;
  /** Aggregate bundle price. Null until first price fetch completes. */
  bundlePrice: BundlePriceSummary | null;
  /** Cached template vars from the last render of each slot. Key = slotIndex. */
  slotVarsCache: Map<number, Record<string, string>>;
}

/** Read-only view of a BundleCard's state exposed to BundleDisplayEnhancer. */
export interface BundleCardPublicState {
  name: string;
  isSelected: boolean;
  bundlePrice: BundlePriceSummary | null;
}

/** Shared context passed to renderer functions. */
export interface RenderContext {
  slotTemplate: string;
  variantOptionTemplate: string;
  variantSelectorTemplate: string;
  selectHandlers: Map<HTMLSelectElement, EventListener>;
  logger: Logger;
  classNames: ClassNames;
  onSelectChange: (
    select: HTMLSelectElement,
    bundleId: string,
    slotIndex: number,
  ) => Promise<void>;
}

/** Shared context passed to handler functions. */
export interface HandlerContext {
  mode: 'swap' | 'select';
  logger: Logger;
  classNames: ClassNames;
  /** Mutable ref so handlers can guard against re-entrant cart updates. */
  isApplyingRef: { value: boolean };
  /** External slots container, when slots are rendered outside the bundle selector element. */
  externalSlotsEl: HTMLElement | null;
  /** The root element of the BundleSelectorEnhancer, used for URL resolution in upsell context. */
  containerElement: HTMLElement;
  /** When true, card clicks submit bundle items to orderStore instead of writing to cart. */
  isUpsellContext: boolean;
  /** The selector's own ID (data-next-selector-id). Used to tag and filter cart items. */
  selectorId: string | null;
  selectCard: (card: BundleCard) => void;
  getSelectedCard: () => BundleCard | null;
  fetchAndUpdateBundlePrice: (card: BundleCard) => Promise<void>;
  emit: <K extends 'bundle:selected' | 'bundle:selection-changed'>(
    event: K,
    detail: EventMap[K],
  ) => void;
}

/** Shared context passed to the price fetcher. */
export interface PriceContext {
  includeShipping: boolean;
  /** Union of every bundle voucher across ALL live BundleSelectorEnhancer instances. */
  allBundleVouchers: Set<string>;
  /** When true, passes ?upsell=true to the calculate API for post-purchase pricing. */
  isUpsellContext: boolean;
  logger: Logger;
}
