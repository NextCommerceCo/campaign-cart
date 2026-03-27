import type { EventMap } from '@/types/global';
import type { SummaryLine } from '@/types/api';
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
}

export interface BundleCard {
  element: HTMLElement;
  bundleId: string;
  items: BundleItem[];
  slots: BundleSlot[];
  isPreSelected: boolean;
  /** Voucher/coupon codes to apply when this bundle is selected. */
  vouchers: string[];
}

/** Shared context passed to renderer functions. */
export interface RenderContext {
  slotTemplate: string;
  variantOptionTemplate: string;
  variantSelectorTemplate: string;
  selectHandlers: Map<HTMLSelectElement, EventListener>;
  previewLines: Map<string, SummaryLine[]>;
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
  selectCard: (card: BundleCard) => void;
  getEffectiveItems: (card: BundleCard) => BundleItem[];
  fetchAndUpdateBundlePrice: (card: BundleCard) => Promise<void>;
  renderSlotsForCard: (card: BundleCard) => void;
  emit: <K extends 'bundle:selected' | 'bundle:selection-changed'>(
    event: K,
    detail: EventMap[K],
  ) => void;
}

/** Shared context passed to the price fetcher. */
export interface PriceContext {
  includeShipping: boolean;
  previewLines: Map<string, SummaryLine[]>;
  cards: BundleCard[];
  logger: Logger;
  slotTemplate: string;
  renderSlotsForCard: (card: BundleCard) => void;
  getEffectiveItems: (card: BundleCard) => BundleItem[];
}
