import { CountryConfig, CountryStatesData, LocationData, State } from './country-service';
import { PhoneRules } from './country-service.phone';
export declare function flagUrl(countryCode: string, baseUrl?: string): string;
export interface RulesField {
    label: string;
    labelOptional?: string;
    errors?: Readonly<Record<string, string>>;
    required: boolean;
    autocomplete: string;
    input: {
        type: 'text' | 'email' | 'tel' | 'select';
        inputMode?: 'text' | 'numeric' | 'tel' | 'email';
        autoCapitalize?: 'none' | 'words' | 'characters';
        maxLength?: number;
        placeholder?: string;
        options?: 'countries' | 'states';
        span?: number;
    };
    format?: {
        pattern?: string;
        example?: string;
        masks?: string[] | PhoneRules['masks'];
        callingCode?: string;
        nationalPrefix?: string;
    };
}
export type FixedValues = Partial<Record<'city' | 'state' | 'postcode', string>>;
export interface CountryRules {
    country: string;
    lang?: string;
    curated?: boolean;
    address: {
        layout: string[][];
        fixed?: FixedValues;
    };
    fields: Record<string, RulesField | undefined>;
    states?: State[];
}
export declare function toCountryConfig(rules: CountryRules, currencyCode?: string | null): CountryConfig;
export declare function readCountryRules(body: unknown, url: string): CountryRules;
export declare function fetchTexts(lang: string, baseUrl?: string): Promise<{
    texts: Record<string, string>;
    lang: string;
} | undefined>;
export declare function fetchLocationData(baseUrl?: string, lang?: string): Promise<LocationData>;
export declare function fetchCountryStates(countryCode: string, baseUrl?: string, lang?: string): Promise<CountryStatesData>;
//# sourceMappingURL=country-service.next-address.d.ts.map