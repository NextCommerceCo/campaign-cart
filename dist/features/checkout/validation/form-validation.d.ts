import { CountryConfig } from '../../../core/i18n-rules';
import { CreditCardService } from '../services/credit-card-service';
import { PhoneNumberSource } from './phone-validation';
import { FormValidationResult } from './validation.types';
export interface FormValidationContext {
    i18nRules: any;
    phoneSource?: (type: 'shipping' | 'billing') => PhoneNumberSource | undefined;
    creditCardService?: CreditCardService;
}
export declare function billingFieldErrors(ctx: FormValidationContext, billingAddress: unknown, countryConfigs: Map<string, CountryConfig>): Record<string, string>;
export declare function validateForm(ctx: FormValidationContext, formData: Record<string, any>, countryConfigs: Map<string, CountryConfig>, _currentCountryConfig?: CountryConfig, includePayment?: boolean, billingAddress?: any, sameAsShipping?: boolean): Promise<FormValidationResult>;
//# sourceMappingURL=form-validation.d.ts.map