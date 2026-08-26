import { CountryConfig } from '../../../core/country-service';
import { CreditCardService } from '../services/credit-card-service';
import { PhoneNumberSource } from './phone-validation';
import { FormValidationResult } from './validation.types';
export interface FormValidationContext {
    countryService: any;
    phoneSource?: (type: 'shipping' | 'billing') => PhoneNumberSource | undefined;
    creditCardService?: CreditCardService;
}
export declare function validateForm(ctx: FormValidationContext, formData: Record<string, any>, countryConfigs: Map<string, CountryConfig>, currentCountryConfig?: CountryConfig, includePayment?: boolean, billingAddress?: any, sameAsShipping?: boolean): Promise<FormValidationResult>;
//# sourceMappingURL=form-validation.d.ts.map