export interface PhoneRules {
    calling_code?: string;
    national_prefix?: string;
    masks?: {
        start?: string;
        mask: string;
    }[];
    pattern?: string;
    example?: string;
}
export interface PhoneNumberResult {
    valid: boolean;
    value?: string;
    country?: string;
    type?: string;
    national?: string;
    international?: string;
    error?: {
        code: string;
        message: string;
    };
}
export declare function isE164(text: string | null | undefined): text is string;
export declare function asciiDigits(text: string): string;
export declare function formatPhone(text: string, rules?: PhoneRules): string;
export declare function isPlausiblePhone(text: string, rules: PhoneRules): boolean;
//# sourceMappingURL=i18n-rules.phone.d.ts.map