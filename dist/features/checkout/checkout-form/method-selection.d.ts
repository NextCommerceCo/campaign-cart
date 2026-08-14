import { Logger } from '../../../core/logger';
import { UIService } from '../services/ui-service';
export interface PaymentMethodContext {
    ui: UIService;
    logger: Logger;
}
export interface ShippingMethodContext {
    hasTrackedShippingInfo: {
        value: boolean;
    };
    logger: Logger;
}
export declare function handlePaymentMethodChange(ctx: PaymentMethodContext, event: Event): void;
export declare function handleShippingMethodChange(ctx: ShippingMethodContext, event: Event): void;
//# sourceMappingURL=method-selection.d.ts.map