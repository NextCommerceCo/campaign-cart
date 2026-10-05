import { CountryConfig } from '../../../core/i18n-rules';
import { PhoneNumberSource } from './phone-validation';
export interface BillingAddressValidationContext {
    i18nRules: any;
    phoneSource?: (type: 'shipping' | 'billing') => PhoneNumberSource | undefined;
}
export declare function validateBillingAddress(ctx: BillingAddressValidationContext, billingAddress: any, countryConfigs: Map<string, CountryConfig>): {
    isValid: boolean;
    errors: Record<string, string>;
};
//# sourceMappingURL=billing-address-validation.d.ts.map