import type { Logger } from '@/utils/logger';
import type { SelectorItem } from '@/types/global';
import type { ApiClient } from '@/api/client';
import type { LoadingOverlay } from '@/components/LoadingOverlay';

export interface BundleLineItem {
  packageId: number;
  quantity: number;
}

export interface UpsellHandlerContext {
  packageId: number | undefined;
  selectorId: string | undefined;
  selectedItemRef: { value: SelectorItem | null };
  quantity: number;
  /** Set when the button is linked to a BundleSelectorEnhancer via data-next-upsell-action-for. */
  bundleSelectorId: string | undefined;
  /** Ref holding the currently selected bundle items — updated on bundle:selection-changed. */
  bundleItemsRef: { value: BundleLineItem[] | null };
  nextUrl: string | undefined;
  apiClient: ApiClient;
  loadingOverlay: LoadingOverlay;
  logger: Logger;
  emit: (event: string, detail: unknown) => void;
}
