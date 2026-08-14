import { PaymentMethod } from '../../../types/api';
import { CheckoutPaymentMethod } from '../../../types/global';
export declare function toCheckoutPaymentMethod(value: string | null | undefined): CheckoutPaymentMethod | undefined;
export declare function isKnownPaymentMethod(method: CheckoutPaymentMethod): method is PaymentMethod;
export declare const EXPRESS_PAYMENT_METHOD_MAP: Record<string, 'paypal' | 'apple_pay' | 'google_pay'>;
//# sourceMappingURL=field-mappings.d.ts.map