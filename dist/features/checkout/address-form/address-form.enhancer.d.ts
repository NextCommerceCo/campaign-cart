import { BaseEnhancer } from '../../../core/base/base-enhancer';
export declare class AddressFormEnhancer extends BaseEnhancer {
    private form;
    private lang?;
    private baseUrl?;
    private renderedCountry?;
    initialize(): Promise<void>;
    update(): void;
    private readConfiguration;
    private collectedElsewhere;
    private renderCountry;
}
//# sourceMappingURL=address-form.enhancer.d.ts.map