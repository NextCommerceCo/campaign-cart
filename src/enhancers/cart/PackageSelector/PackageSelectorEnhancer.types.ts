import type { Logger } from '@/utils/logger';
import type { SelectorItem } from '@/types/global';

export interface PackageDef {
  packageId: number;
  selected?: boolean;
  [key: string]: unknown;
}

export interface SelectorHandlerContext {
  selectorId: string;
  mode: 'swap' | 'select';
  includeShipping: boolean;
  logger: Logger;
  element: HTMLElement;
  emit: (event: string, detail: unknown) => void;
  selectedItemRef: { value: SelectorItem | null };
  items: SelectorItem[];
}
