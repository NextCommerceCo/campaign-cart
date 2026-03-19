import { BaseEnhancer } from '../base/BaseEnhancer';
export declare class FormatCurrencyEnhancer extends BaseEnhancer {
    private rawValue;
    private currencyOverride;
    private hideZeroCents;
    private currencyChangeHandler;
    constructor(element: HTMLElement);
    initialize(): void;
    update(): void;
    destroy(): void;
    private render;
}
//# sourceMappingURL=FormatCurrencyEnhancer.d.ts.map