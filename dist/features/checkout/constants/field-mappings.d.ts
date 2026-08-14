import { Payment } from '../../../types/api';
import { CheckoutPaymentMethod } from '../../../types/global';
export declare function toCheckoutPaymentMethod(value: string | null | undefined): CheckoutPaymentMethod | undefined;
export declare function isKnownPaymentMethod(method: string): boolean;
export declare function toApiPaymentMethod(method: string): Payment['payment_method'];
export declare const EXPRESS_PAYMENT_METHOD_MAP: Record<string, 'paypal' | 'apple_pay' | 'google_pay'>;
//# sourceMappingURL=field-mappings.d.ts.map