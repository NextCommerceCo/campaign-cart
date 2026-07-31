import { BaseDisplayEnhancer } from '../../../core/base/base-display-enhancer';
export declare class ShippingDisplayEnhancer extends BaseDisplayEnhancer {
    private shippingId?;
    private shippingMethod?;
    initialize(): Promise<void>;
    protected setupStoreSubscriptions(): void;
    private handleCampaignUpdate;
    private detectShippingContext;
    private loadShippingMethod;
    protected getPropertyValue(): any;
    private getCalculatedProperty;
    update(): void;
}
//# sourceMappingURL=shipping-display.enhancer.d.ts.map