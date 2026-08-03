import type { Logger } from '@/core/logger';

export interface HandlerContext {
  packageId: number;
  confirmRemoval: boolean;
  confirmMessage: string;
  logger: Logger;
  setProcessing: (value: boolean) => void;
  emitRemoved: (packageId: number) => void;
  renderFeedback: () => void;
}
