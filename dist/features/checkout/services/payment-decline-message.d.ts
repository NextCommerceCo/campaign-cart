import { I18nRules } from '../../../core/i18n-rules';
export interface PaymentDecline {
    payment_response_code?: unknown;
    payment_details?: unknown;
}
export declare class PaymentDeclinedError extends Error {
    readonly code?: string | undefined;
    constructor(message: string, code?: string | undefined);
}
export declare function isPaymentDecline(answer: unknown): answer is PaymentDecline;
export declare function declineCode(answer: PaymentDecline): string | undefined;
export declare function paymentDeclineMessage(answer: PaymentDecline, lang?: string, service?: I18nRules): Promise<string>;
//# sourceMappingURL=payment-decline-message.d.ts.map