import { CountryConfig } from '../../../core/country-service';
import { FormValidationContext } from './form-validation';
import { FormValidationResult } from './validation.types';
export declare function validateStep(ctx: FormValidationContext, step: number, formData: Record<string, any>, countryConfigs: Map<string, CountryConfig>, currentCountryConfig?: CountryConfig, billingAddress?: any, sameAsShipping?: boolean): Promise<FormValidationResult>;
//# sourceMappingURL=step-validation.d.ts.map