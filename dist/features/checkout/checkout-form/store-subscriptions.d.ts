import { Logger } from '../../../core/logger';
import { CartState } from '../../../types/global';
import { CheckoutValidator } from '../validation/checkout-validator';
import { CreditCardService } from '../services/credit-card-service';
import { SubmitControl } from './field-scanning';
export interface CheckoutUpdateContext {
    validator: CheckoutValidator;
    submitButton: SubmitControl | undefined;
    showLocationFields: () => void;
}
export interface CartUpdateContext {
    logger: Logger;
}
export interface ConfigUpdateContext {
    logger: Logger;
    creditCardService: CreditCardService | undefined;
    initializeCreditCard: (environmentKey: string, debug: boolean) => Promise<void>;
}
export declare function handleCheckoutUpdate(ctx: CheckoutUpdateContext, state: any): void;
export declare function handleCartUpdate(ctx: CartUpdateContext, cartState: CartState): void;
export declare function handleConfigUpdate(ctx: ConfigUpdateContext, configState: any): Promise<void>;
//# sourceMappingURL=store-subscriptions.d.ts.map