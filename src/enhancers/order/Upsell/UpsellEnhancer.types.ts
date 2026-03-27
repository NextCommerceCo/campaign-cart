import type { Logger } from '@/utils/logger';
import type { LoadingOverlay } from '@/components/LoadingOverlay';
import type { ApiClient } from '@/api/client';
import type { EventMap } from '@/types/global';

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
  currentPagePath: string | undefined;
  logger: Logger;
  emit: <K extends keyof EventMap>(event: K, detail: EventMap[K]) => void;
}
