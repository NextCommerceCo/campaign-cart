import { CountryConfig } from '../../../core/country-service';
export interface BillingAddressValidationContext {
    countryService: any;
    phoneValidator?: (phoneNumber: string, type?: 'shipping' | 'billing') => boolean;
}
export declare function validateBillingAddress(ctx: BillingAddressValidationContext, billingAddress: any, countryConfigs: Map<string, CountryConfig>): {
    isValid: boolean;
    errors: Record<string, string>;
};
//# sourceMappingURL=billing-address-validation.d.ts.map