import { CountryConfig, I18nRules, CountryStatesData } from '../../../core/i18n-rules';
import { Logger } from '../../../core/logger';
import { CountryFieldsContext } from './country-fields';
export interface StateFieldsContext {
    stateLoadingPromises: Map<string, Promise<CountryStatesData>>;
    i18nRules: I18nRules;
    logger: Logger;
    countryFields: CountryFieldsContext;
    countryConfigs: Map<string, CountryConfig>;
}
export interface BillingStateFieldsContext extends StateFieldsContext {
    setBillingProvince: (province: string) => void;
}
export interface ShippingStateFieldsContext extends StateFieldsContext {
    currentCountryConfig: {
        value: CountryConfig | undefined;
    };
    updateFormData: (data: Record<string, unknown>) => void;
    clearError: (field: string) => void;
}
export declare function loadCountryConfig(ctx: StateFieldsContext, country: string): Promise<CountryConfig | undefined>;
export declare function updateStateOptions(ctx: ShippingStateFieldsContext, country: string, provinceField: HTMLSelectElement): Promise<void>;
export declare function updateBillingStateOptions(ctx: BillingStateFieldsContext, country: string, billingProvinceField: HTMLSelectElement, province?: string): Promise<void>;
//# sourceMappingURL=state-fields.d.ts.map