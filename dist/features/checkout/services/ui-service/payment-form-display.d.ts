import { Logger } from '../../../../core/logger';
import { ErrorDisplayManager } from '../../utils/error-display-utils';
export interface PaymentFormDisplayContext {
    form: HTMLFormElement;
    errors: ErrorDisplayManager;
    logger: Logger;
}
export declare function initializePaymentForms(ctx: PaymentFormDisplayContext): void;
export declare function updatePaymentFormVisibility(ctx: PaymentFormDisplayContext, paymentMethod: string): void;
export declare function applyAvailablePaymentMethods(ctx: PaymentFormDisplayContext, availableCodes: readonly string[] | undefined): void;
//# sourceMappingURL=payment-form-display.d.ts.map