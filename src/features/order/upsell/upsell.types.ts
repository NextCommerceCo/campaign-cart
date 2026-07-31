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
  /** Quantity used in direct mode, and as the fallback for quantity displays. */
  quantity: number;
  /** `data-next-selector-id` on the container, if any. Set once at initialize. */
  selectorId: string | undefined;
  /** Package chosen in selector mode; `undefined` once the dropdown is cleared. */
  selectedPackageId: number | undefined;
  /** Option elements by package id, populated while scanning selector mode. */
  options: Map<number, HTMLElement>;
  /** Per-selector quantity, so two selectors on one page keep separate counts. */
  quantityBySelectorId: Map<string, number>;
  /** Selector whose quantity was touched last — the one to read on submit. */
  currentQuantitySelectorId: string | undefined;
  /** `[data-next-upsell-action]` buttons found in the container. */
  actionButtons: HTMLElement[];
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
  quantity: number;
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
