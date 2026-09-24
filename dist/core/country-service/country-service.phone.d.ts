export interface PhoneRules {
    callingCode?: string;
    nationalPrefix?: string;
    mask?: string;
    pattern: string;
    example?: string;
}
export declare function formatPhone(text: string, rules?: PhoneRules): string;
export declare function isPlausiblePhone(text: string, rules: PhoneRules): boolean;
export declare function toE164(text: string, rules?: PhoneRules): string;
//# sourceMappingURL=country-service.phone.d.ts.map