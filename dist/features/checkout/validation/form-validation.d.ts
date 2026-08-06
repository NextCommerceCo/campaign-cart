import { CountryConfig } from '../../../core/country-service';
import { CreditCardService } from '../services/credit-card-service';
import { FormValidationResult } from './validation.types';
export interface FormValidationContext {
    countryService: any;
    phoneInputManager?: any;
    phoneValidator?: (phoneNumber: string, type?: 'shipping' | 'billing') => boolean;
    creditCardService?: CreditCardService;
}
export declare function validateForm(ctx: FormValidationContext, formData: Record<string, any>, countryConfigs: Map<string, CountryConfig>, currentCountryConfig?: CountryConfig, includePayment?: boolean, billingAddress?: any, sameAsShipping?: boolean): Promise<FormValidationResult>;
//# sourceMappingURL=form-validation.d.ts.map