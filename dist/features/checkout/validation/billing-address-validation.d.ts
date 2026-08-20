import { CountryConfig } from '../../../core/country-service';
import { PhoneNumberSource } from './phone-validation';
export interface BillingAddressValidationContext {
    countryService: any;
    phoneSource?: (type: 'shipping' | 'billing') => PhoneNumberSource | undefined;
}
export declare function validateBillingAddress(ctx: BillingAddressValidationContext, billingAddress: any, countryConfigs: Map<string, CountryConfig>): {
    isValid: boolean;
    errors: Record<string, string>;
};
//# sourceMappingURL=billing-address-validation.d.ts.map