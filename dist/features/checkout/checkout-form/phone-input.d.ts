import { PhoneRules } from '../../../core/country-service';
import { Logger } from '../../../core/logger';
import { PhoneNumberSource } from '../validation/phone-validation';
export type PhoneFieldType = 'shipping' | 'billing';
export interface PhoneInputContext {
    fields: Map<string, HTMLElement>;
    billingFields: Map<string, HTMLElement>;
    phoneInputs: Map<string, PhoneField>;
    detectedCountryCode: string;
    loadPhoneRules: (countryCode: string) => Promise<PhoneRules | undefined>;
    updateFormData: (data: Record<string, string>) => void;
    logger: Logger;
}
interface PhoneFieldOptions {
    fallbackCountry: string;
    countryField?: HTMLSelectElement | undefined;
    loadRules: (countryCode: string) => Promise<PhoneRules | undefined>;
    onNumber: (value: string) => void;
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
    constructor(input: HTMLInputElement, options: PhoneFieldOptions);
    getNumber(): string;
    isValidNumber(): boolean | null;
    whenReady(): Promise<void>;
    destroy(): void;
    private placeFlag;
    private addClass;
    private handleInput;
    private follow;
    private render;
}
export declare function awaitPhoneRules(phoneInputs: ReadonlyMap<string, PhoneField>, timeoutMs?: number): Promise<boolean>;
export declare function initializePhoneInputs(ctx: PhoneInputContext): void;
export {};
//# sourceMappingURL=phone-input.d.ts.map