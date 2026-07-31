import { BaseEnhancer } from '../../core/base/base-enhancer';
export declare class ExpressCheckoutContainerEnhancer extends BaseEnhancer {
    private buttonsContainer?;
    private buttonInstances;
    private buttonClickHandlers;
    private paymentConfig?;
    private availableExpressMethods?;
    private orderManager?;
    private expressProcessor?;
    private loadingOverlay;
    private errorElement?;
    private errorTextElement?;
    constructor(element: HTMLElement);
    initialize(): Promise<void>;
    private handleConfigUpdate;
    private handleCampaignUpdate;
    private updateExpressCheckoutButtons;
    private hideContainer;
    private showContainer;
    private clearButtons;
    private handleButtonClick;
    private handleCartUpdate;
    private createPayPalButton;
    private createApplePayButton;
    private createGooglePayButton;
    private createButton;
    update(): void;
    destroy(): void;
}
//# sourceMappingURL=express-checkout-container.enhancer.d.ts.map