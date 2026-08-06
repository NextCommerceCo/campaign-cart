import { Logger } from '../../../core/logger';
import { BillingAnimationContext } from './billing-animation';
export interface BillingToggleContext {
    animationInProgress: {
        value: boolean;
    };
    debounceTimer: {
        value?: NodeJS.Timeout;
    };
    animation: BillingAnimationContext;
    billingFields: Map<string, HTMLElement>;
    logger: Logger;
}
export declare function handleBillingAddressToggle(ctx: BillingToggleContext, event: Event): void;
//# sourceMappingURL=billing-toggle.d.ts.map