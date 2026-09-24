import { CountryConfig, CountryStatesData, LocationData } from './country-service';
import { PhoneRules } from './country-service.phone';
export declare function flagUrl(countryCode: string, baseUrl?: string): string;
interface FieldSpec {
    label?: string;
    required?: boolean;
    pattern?: string;
    example?: string;
    maxLength?: number;
}
interface CountrySpec {
    country: string;
    layout: string[][];
    fields: Record<string, FieldSpec | undefined>;
    postcode?: {
        formatter?: string;
    };
    phone?: PhoneRules;
}
export declare function toCountryConfig(spec: CountrySpec, currencyCode?: string | null): CountryConfig;
export declare function fetchLocationData(baseUrl?: string): Promise<LocationData>;
export declare function fetchCountryStates(countryCode: string, baseUrl?: string): Promise<CountryStatesData>;
export {};
//# sourceMappingURL=country-service.next-address.d.ts.map