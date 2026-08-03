import { BaseDisplayEnhancer } from '../../../core/base/base-display-enhancer';
export declare class ProductDisplayEnhancer extends BaseDisplayEnhancer {
    private campaignState?;
    private packageId?;
    private contextPackageId?;
    private packageData?;
    private multiplyByQuantity;
    private currentQuantity;
    private quantitySelectorId?;
    initialize(): Promise<void>;
    protected setupStoreSubscriptions(): void;
    private handleCampaignUpdate;
    private handleCartUpdate;
    protected setupCurrencyChangeListener(): void;
    private setupQuantityListeners;
    private detectPackageContext;
    private loadPackageData;
    protected getPropertyValue(): any;
    protected updateElementContent(value: string): void;
    protected hideElement(): void;
    protected showElement(): void;
    update(data?: any): void;
    getPackageProperty(property: string): any;
    setPackageContext(packageId: number): void;
}
//# sourceMappingURL=product-display.enhancer.d.ts.map