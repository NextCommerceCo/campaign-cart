import { Iti } from 'intl-tel-input';
import { Logger } from '../../../core/logger';
export type PhoneFieldType = 'shipping' | 'billing';
export interface PhoneInputContext {
    isIntlTelInputAvailable: boolean;
    fields: Map<string, HTMLElement>;
    billingFields: Map<string, HTMLElement>;
    phoneInputs: Map<string, Iti>;
    detectedCountryCode: string;
    updateFormData: (data: Record<string, string>) => void;
    logger: Logger;
}
export declare function injectIntlTelInputStyles(): void;
export declare function awaitPhoneUtils(phoneInputs: Map<string, Iti>, timeoutMs?: number): Promise<boolean>;
export declare function initializePhoneInputs(ctx: PhoneInputContext): void;
//# sourceMappingURL=phone-input.d.ts.map