import { BaseEnhancer } from '../../core/base/base-enhancer';
export declare class QuantityTextEnhancer extends BaseEnhancer {
    private template;
    private currentQuantity;
    private quantitySelectorId?;
    private containerPackageId?;
    initialize(): Promise<void>;
    private setupQuantityListeners;
    private getInitialQuantity;
    private updateText;
    update(): void;
    destroy(): void;
}
//# sourceMappingURL=quantity-text.enhancer.d.ts.map