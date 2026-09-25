export interface PhoneNumberSource {
    getNumber?(): string;
    isValidNumber?(): boolean | null;
}
export type PhoneVerdict = 'valid' | 'invalid' | 'unknown';
export type PhoneReason = 'empty' | 'rule' | 'digit-count' | 'rule-not-loaded' | 'no-instance';
export interface PhoneCheck {
    verdict: PhoneVerdict;
    value: string;
    isE164: boolean;
    reason: PhoneReason;
}
export declare function e164FromWidget(widget?: PhoneNumberSource): string | undefined;
export declare function checkPhone(raw: string | undefined | null, source?: PhoneNumberSource): PhoneCheck;
export declare function isValidPhone(raw: string | undefined | null, source?: PhoneNumberSource): boolean;
export declare function normalizePhone(raw: string | undefined | null, source?: PhoneNumberSource): string;
export declare function isPhoneMarkedRequired(): boolean;
//# sourceMappingURL=phone-validation.d.ts.map