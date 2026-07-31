import type { Logger } from '@/core/logger';
import type { LoadingOverlay } from '@/core/ui/loading-overlay';
import type { ApiClient } from '@/api/client';
import type { EventMap } from '@/types/global';

/** One line of a bundle selection: which package, how many, and its own properties. */
export interface UpsellBundleItem {
  packageId: number;
  quantity: number;
  properties?: Record<string, string>;
}

/**
 * The upsell offer's live, mutable state.
 *
 * This object is owned by `UpsellEnhancer` and handed to the interaction
 * handlers **by reference** — they read and write it in place. That is
 * deliberate: several handlers run from DOM listeners and from the (synchronous)
 * event bus long after they were registered, and must see the current values,
 * not a snapshot taken at registration time. Never copy it into a snapshot
 * before calling a handler.
 */
export interface UpsellState {
  /** Package the offer will add. Reassigned by option selection. */
  packageId: number | undefined;
  /**
   * How many units the offer adds — the **single source of truth** for the
   * quantity, in selector mode as much as in direct mode.
   *
   * Seeded from `data-next-quantity` while the enhancer initializes, and
   * written only by `setQuantity` after that. The selector-keyed map the
   * renderers and the handler context take is projected from this number by
   * `quantitySnapshot` and thrown away, so there is no second copy that can
   * disagree with it.
   */
  quantity: number;
  /** `data-next-selector-id` on the container, if any. Set once at initialize. */
  selectorId: string | undefined;
  /** Package chosen in selector mode; `undefined` once the dropdown is cleared. */
  selectedPackageId: number | undefined;
  /** Option elements by package id, populated while scanning selector mode. */
  options: Map<number, HTMLElement>;
  /**
   * Selector id the quantity is currently addressed by — the one a `+`/`-`
   * control named, when it named one. It decides which elements on the page a
   * repaint writes to; it does not hold a quantity of its own.
   */
  currentQuantitySelectorId: string | undefined;
  /** `[data-next-upsell-action]` buttons found by the last scan. */
  actionButtons: HTMLElement[];
  /**
   * Undo functions for the listeners the last `scanUpsellElements` attached.
   * `update()` re-scans the same container, so the previous scan's listeners
   * have to come off first — otherwise one press steps the quantity twice.
   */
  scanTeardowns: (() => void)[];
}

/** What the interaction handlers need: the container, the live state, logging, events. */
export interface UpsellInteractionContext {
  element: HTMLElement;
  state: UpsellState;
  logger: Logger;
  emit: <K extends keyof EventMap>(event: K, detail: EventMap[K]) => void;
}

export interface UpsellHandlerContext {
  isProcessingRef: { value: boolean };
  element: HTMLElement;
  packageId: number | undefined;
  isSelector: boolean;
  selectedPackageId: number | undefined;
  selectorId: string | undefined;
  /** How many units to submit. Authoritative. */
  quantity: number;
  /**
   * `quantity` keyed by the selector it is addressed by — a projection of
   * `quantity` built fresh for every click, not a separate store. It is here
   * because the same number has to be found by selector id when the offer
   * appears in more than one container.
   */
  quantityBySelectorId: Map<string, number>;
  currentQuantitySelectorId: string | undefined;
  actionButtons: HTMLElement[];
  loadingOverlay: LoadingOverlay;
  apiClient: ApiClient;
  bundleItems?: UpsellBundleItem[] | null;
  bundleVouchers?: string[];
  defaultProperties?: Record<string, string>;
  properties?: Record<string, string>;
  currentPagePath: string | undefined;
  logger: Logger;
  emit: <K extends keyof EventMap>(event: K, detail: EventMap[K]) => void;
}
