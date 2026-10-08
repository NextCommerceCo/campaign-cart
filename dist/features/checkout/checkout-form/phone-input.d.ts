import { PhoneNumberResult, PhoneRules } from '../../../core/i18n-rules';
import { Logger } from '../../../core/logger';
import { PhoneNumberSource } from '../validation/phone-validation';
export type PhoneFieldType = 'shipping' | 'billing';
export interface PhoneInputContext {
    fields: Map<string, HTMLElement>;
    billingFields: Map<string, HTMLElement>;
    phoneInputs: Map<string, PhoneField>;
    detectedCountryCode: string;
    loadPhoneRules: (countryCode: string) => Promise<PhoneRules | undefined>;
    readPhoneNumber: (number: string, country: string) => Promise<PhoneNumberResult | undefined>;
    updateFormData: (data: Record<string, string>) => void;
    onCountryRead?: (type: PhoneFieldType, input: HTMLInputElement) => void;
    logger: Logger;
}
interface PhoneFieldOptions {
    fallbackCountry: string;
    countryField?: HTMLSelectElement | undefined;
    loadRules: (countryCode: string) => Promise<PhoneRules | undefined>;
    readNumber: (number: string, country: string) => Promise<PhoneNumberResult | undefined>;
    onNumber: (value: string) => void;
    onCountryRead?: () => void;
}
export declare function phoneFieldFor(input: HTMLInputElement): PhoneField | undefined;
export declare class PhoneField implements PhoneNumberSource {
    private readonly input;
    private readonly options;
    private readonly flag;
    private readonly placeholder;
    private readonly padding;
    private readonly layout;
    private readonly addedClasses;
    private readonly listeners;
    private country;
    private rules;
    private loading;
    private loads;
    private read;
    private reading;
    private pause;
    constructor(input: HTMLInputElement, options: PhoneFieldOptions);
    getNumber(): string;
    isValidNumber(): boolean | null;
    invalidMessage(): Promise<string | undefined>;
    whenReady(): Promise<void>;
    destroy(): void;
    private placeFlag;
    private addClass;
    private key;
    private current;
    private handleInput;
    private update;
    private writeAsciiDigits;
    private settle;
    private readNow;
    private showWritten;
    private publish;
    private showCountry;
    follow(): void;
    private render;
}
export interface PhoneVerdictContext {
    showError: (name: string, message: string) => void;
    clearError: (name: string) => void;
}
export declare function showPhoneVerdict(ctx: PhoneVerdictContext, fieldName: string, input: HTMLInputElement): Promise<void>;
export declare function awaitPhoneRules(phoneInputs: ReadonlyMap<string, PhoneField>, timeoutMs?: number): Promise<boolean>;
export declare function initializePhoneInputs(ctx: PhoneInputContext): void;
export {};
//# sourceMappingURL=phone-input.d.ts.map