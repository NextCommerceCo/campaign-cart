import type { Logger } from '@/utils/logger';
import type { SelectorItem } from '@/types/global';
import type { ApiClient } from '@/api/client';
import type { LoadingOverlay } from '@/components/LoadingOverlay';

export interface UpsellHandlerContext {
  packageId: number | undefined;
  selectorId: string | undefined;
  selectedItemRef: { value: SelectorItem | null };
  quantity: number;
  nextUrl: string | undefined;
  apiClient: ApiClient;
  loadingOverlay: LoadingOverlay;
  logger: Logger;
  emit: (event: string, detail: unknown) => void;
}
