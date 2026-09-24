import { BaseEnhancer } from '../../../core/base/base-enhancer';
export declare class AddressFormEnhancer extends BaseEnhancer {
    private form;
    private lang?;
    private baseUrl?;
    private renderedCountry?;
    private requestedCountry?;
    private requestId;
    initialize(): Promise<void>;
    destroy(): void;
    private readonly handleLocaleChange;
    update(): void;
    private readConfiguration;
    private collectedElsewhere;
    private setState;
    private resolveLang;
    private renderCountry;
}
//# sourceMappingURL=address-form.enhancer.d.ts.map