import { BaseDisplayEnhancer } from '../../../core/base/base-display-enhancer';
export declare class OrderDisplayEnhancer extends BaseDisplayEnhancer {
    private apiClient?;
    private orderState;
    initialize(): Promise<void>;
    protected setupStoreSubscriptions(): void;
    protected getPropertyValue(): any;
    update(data?: any): void;
    private checkAndLoadOrderFromUrl;
    private handleOrderUpdate;
    protected updateElementContent(value: string): void;
}
//# sourceMappingURL=order-display.enhancer.d.ts.map