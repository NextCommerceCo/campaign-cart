import { Logger } from '../logger';
export interface AttributionCtx {
    logger: Logger;
    attributionListenersCleanup: (() => void) | null;
}
export declare function initializeAttribution(ctx: AttributionCtx): Promise<void>;
export declare function setupAttributionListeners(ctx: AttributionCtx): void;
//# sourceMappingURL=sdk-initializer.attribution.d.ts.map