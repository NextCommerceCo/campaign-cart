import { CountryConfig, CountryService, CountryStatesData } from '../../../core/country-service';
import { Logger } from '../../../core/logger';
import { CountryFieldsContext } from './country-fields';
export interface StateFieldsContext {
    stateLoadingPromises: Map<string, Promise<CountryStatesData>>;
    countryService: CountryService;
    logger: Logger;
    countryFields: CountryFieldsContext;
}
export interface ShippingStateFieldsContext extends StateFieldsContext {
    countryConfigs: Map<string, CountryConfig>;
    currentCountryConfig: {
        value: CountryConfig | undefined;
    };
    updateFormData: (data: Record<string, unknown>) => void;
    clearError: (field: string) => void;
}
export declare function updateStateOptions(ctx: ShippingStateFieldsContext, country: string, provinceField: HTMLSelectElement): Promise<void>;
export declare function updateBillingStateOptions(ctx: StateFieldsContext, country: string, billingProvinceField: HTMLSelectElement, shippingProvince?: string): Promise<void>;
//# sourceMappingURL=state-fields.d.ts.map