import { CountryConfig, CountryStatesData, LocationData, State } from './i18n-rules';
import { PhoneNumberResult, PhoneRules } from './i18n-rules.phone';
export declare function flagUrl(countryCode: string, baseUrl?: string): string;
export interface RulesField {
    label_id?: string;
    label: string;
    label_optional?: string;
    errors?: Readonly<Record<string, string>>;
    required: boolean;
    autocomplete: string;
    input: {
        type: 'text' | 'email' | 'tel' | 'select';
        input_mode?: 'text' | 'numeric' | 'tel' | 'email';
        auto_capitalize?: 'none' | 'words' | 'characters';
        max_length?: number;
        placeholder?: string;
        options?: 'countries' | 'states';
        span?: number;
    };
    format?: {
        pattern?: string;
        example?: string;
        masks?: string[] | PhoneRules['masks'];
        calling_code?: string;
        national_prefix?: string;
        national_prefix_for_parsing?: string;
        national_prefix_transform_rule?: string;
        national_number_pattern?: string;
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
export interface PostcodeResult {
    valid: boolean | null;
    value?: string;
    error?: {
        code: string;
        message: string;
    };
    state?: string;
}
export declare function fetchPhoneNumber(number: string, country: string, lang?: string, baseUrl?: string): Promise<PhoneNumberResult | undefined>;
export declare function fetchPostcode(postcode: string, country: string, state: string | undefined, lang?: string, baseUrl?: string): Promise<PostcodeResult | undefined>;
export declare function fetchTexts(lang: string, baseUrl?: string): Promise<{
    texts: Record<string, string>;
    lang: string;
} | undefined>;
export declare function fetchLocationData(baseUrl?: string, lang?: string): Promise<LocationData>;
export declare function fetchCountryStates(countryCode: string, baseUrl?: string, lang?: string): Promise<CountryStatesData>;
//# sourceMappingURL=i18n-rules.api.d.ts.map