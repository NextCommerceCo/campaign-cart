import { EventBus } from '../../../core/events';
import { Logger } from '../../../core/logger';
export interface AutofillDetectionContext {
    eventBus: EventBus;
    fields: Map<string, HTMLElement>;
    hasTrackedShippingInfo: {
        value: boolean;
    };
    logger: Logger;
}
export declare function setupAutofillDetection(ctx: AutofillDetectionContext): () => void;
//# sourceMappingURL=autofill-detection.d.ts.map