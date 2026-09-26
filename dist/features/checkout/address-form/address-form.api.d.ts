import { CountryRules } from '../../../core/country-service';
export declare function builtInRules(countryCode: string): CountryRules;
export declare function fetchCountryRules(countryCode: string, options?: {
    baseUrl?: string;
    lang?: string;
}): Promise<CountryRules>;
//# sourceMappingURL=address-form.api.d.ts.map