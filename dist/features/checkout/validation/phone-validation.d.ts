export interface PhoneNumberSource {
    getNumber?(format?: number): string;
    isValidNumber?(): boolean | null;
    isValidNumberPrecise?(): boolean | null;
    getSelectedCountryData?(): {
        dialCode?: string;
        iso2?: string;
    };
}
export type PhoneVerdict = 'valid' | 'invalid' | 'unknown';
export type PhoneReason = 'empty' | 'junk-pattern' | 'library-length' | 'digit-count' | 'utils-not-loaded' | 'no-instance';
export interface PhoneCheck {
    verdict: PhoneVerdict;
    value: string;
    isE164: boolean;
    reason: PhoneReason;
    precise: boolean | null;
}
export declare const MIN_PHONE_DIGITS = 7;
export declare function isJunkPhoneNumber(nationalDigits: string): boolean;
export declare function checkPhone(raw: string | undefined | null, source?: PhoneNumberSource): PhoneCheck;
export declare function normalizePhone(raw: string | undefined | null, source?: PhoneNumberSource): string;
//# sourceMappingURL=phone-validation.d.ts.map