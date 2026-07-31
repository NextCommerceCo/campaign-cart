import { Logger } from '../../../core/logger';
import { OrderManager } from '../managers/order-manager';
import { CartItem } from '../../../types/global';
export declare class ExpressCheckoutProcessor {
    private logger;
    private showLoadingCallback;
    private hideLoadingCallback;
    private emitCallback;
    private orderManager;
    constructor(logger: Logger, showLoadingCallback: () => void, hideLoadingCallback: (immediate?: boolean) => void, emitCallback: (event: string, data: any) => void, orderManager: OrderManager);
    handleExpressCheckout(method: string, cartItems: CartItem[], isCartEmpty: boolean, _resetCart: () => void): Promise<void>;
    private displayPayPalError;
    private displayExpressPaymentError;
    private displayGeneralPaymentError;
}
//# sourceMappingURL=express-checkout-processor.d.ts.map