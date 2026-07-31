import { Logger } from '../../../core/logger';
export interface BillingAnimationContext {
    inProgress: {
        value: boolean;
    };
    timeouts: Set<NodeJS.Timeout>;
    listenerAbort: {
        value: AbortController | null;
    };
    logger: Logger;
}
export declare function expandBillingForm(ctx: BillingAnimationContext, billingSection: HTMLElement): void;
export declare function collapseBillingForm(ctx: BillingAnimationContext, billingSection: HTMLElement): void;
//# sourceMappingURL=billing-animation.d.ts.map