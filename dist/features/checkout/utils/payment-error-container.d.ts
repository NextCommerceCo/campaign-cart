import { Logger } from '../../../core/logger';
export interface PaymentErrorTarget {
    container: HTMLElement;
    text: HTMLElement;
}
export declare function resolvePaymentErrorTarget(method: string | undefined, logger: Logger): PaymentErrorTarget | null;
export declare function showPaymentErrorTarget(target: PaymentErrorTarget): void;
export declare function hideAllPaymentErrors(): void;
//# sourceMappingURL=payment-error-container.d.ts.map