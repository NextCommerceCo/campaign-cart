import { BaseEnhancer } from '../../core/base/base-enhancer';
export declare class CheckoutReviewEnhancer extends BaseEnhancer {
    private configs;
    private unsubscribe?;
    constructor(element: HTMLElement);
    initialize(): Promise<void>;
    update(): void;
    enhance(): Promise<void>;
    private updateDisplay;
    private getFieldValue;
    private formatValue;
    private formatCurrency;
    private formatAddress;
    private formatName;
    private formatPhone;
    private getCountryName;
    destroy(): void;
}
//# sourceMappingURL=checkout-review.enhancer.d.ts.map