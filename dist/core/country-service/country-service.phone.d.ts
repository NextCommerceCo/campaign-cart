export interface PhoneRules {
    calling_code?: string;
    national_prefix?: string;
    masks?: {
        start?: string;
        mask: string;
    }[];
    pattern?: string;
    example?: string;
    national_prefix_for_parsing?: string;
    national_prefix_transform_rule?: string;
    national_number_pattern?: string;
}
export interface CallingCodeCountry {
    country: string;
    leading_digits?: string;
    pattern?: string;
}
export type CallingCodes = Readonly<Record<string, readonly CallingCodeCountry[]>>;
export declare function isE164(text: string | null | undefined): text is string;
export declare function formatPhone(text: string, rules?: PhoneRules): string;
export declare function isPlausiblePhone(text: string, rules: PhoneRules): boolean;
export declare function toE164(text: string, rules?: PhoneRules): string;
export declare function countryOfNumber(text: string, codes: CallingCodes): string | undefined;
//# sourceMappingURL=country-service.phone.d.ts.map