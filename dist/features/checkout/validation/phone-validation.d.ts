export interface PhoneNumberSource {
    getNumber?(format?: number): string;
    isValidNumber?(): boolean | null;
}
export type PhoneVerdict = 'valid' | 'invalid' | 'unknown';
export type PhoneReason = 'empty' | 'library-length' | 'digit-count' | 'utils-not-loaded' | 'no-instance';
export interface PhoneCheck {
    verdict: PhoneVerdict;
    value: string;
    isE164: boolean;
    reason: PhoneReason;
}
export declare function checkPhone(raw: string | undefined | null, source?: PhoneNumberSource): PhoneCheck;
export declare function isValidPhone(raw: string | undefined | null, source?: PhoneNumberSource): boolean;
export declare function normalizePhone(raw: string | undefined | null, source?: PhoneNumberSource): string;
//# sourceMappingURL=phone-validation.d.ts.map