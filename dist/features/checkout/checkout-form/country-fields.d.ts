import { Country, CountryConfig } from '../../../core/country-service';
export interface CountryFieldsContext {
    form: HTMLElement;
    fields: Map<string, HTMLElement>;
    billingFields: Map<string, HTMLElement>;
    countries: Country[];
}
export declare function populateCountryDropdown(countrySelect: HTMLSelectElement, countries: Country[], defaultCountry?: string): void;
export declare function populateBillingCountryDropdown(ctx: CountryFieldsContext): void;
export declare function updateFormLabels(ctx: CountryFieldsContext, countryConfig: CountryConfig): void;
export declare function updateBillingFormLabels(ctx: CountryFieldsContext, countryConfig: CountryConfig): void;
//# sourceMappingURL=country-fields.d.ts.map