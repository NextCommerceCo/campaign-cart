import { Logger } from '../../../utils/logger';
export interface HandlerContext {
    packageId: number;
    confirmRemoval: boolean;
    confirmMessage: string;
    logger: Logger;
    setProcessing: (value: boolean) => void;
    emitRemoved: (packageId: number) => void;
    renderFeedback: () => void;
}
//# sourceMappingURL=RemoveItemEnhancer.types.d.ts.map