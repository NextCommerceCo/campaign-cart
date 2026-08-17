import { Logger } from '../../../core/logger';
import { EventMap } from '../../../types/global';
export interface PaymentErrorDisplayContext {
    logger: Logger;
    paymentMethod: () => string;
    announcingPaymentError: {
        value: boolean;
    };
    emit: (detail: EventMap['payment:error']) => void;
}
export interface PaymentErrorListenerContext {
    announcingPaymentError: {
        value: boolean;
    };
    on: (handler: (data: EventMap['payment:error']) => void) => void;
    displayPaymentError: (message: string) => void;
}
export declare function listenForPaymentErrors(ctx: PaymentErrorListenerContext): void;
export declare function displayPaymentError(ctx: PaymentErrorDisplayContext, message: string): void;
//# sourceMappingURL=payment-error-display.d.ts.map