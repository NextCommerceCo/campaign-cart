import { CountryConfig } from '../../../core/i18n-rules';
import { FormValidationContext } from './form-validation';
import { FormValidationResult } from './validation.types';
export declare function validateStep(ctx: FormValidationContext, step: number, formData: Record<string, any>, countryConfigs: Map<string, CountryConfig>, currentCountryConfig?: CountryConfig, billingAddress?: any, sameAsShipping?: boolean, billingOnPage?: boolean): Promise<FormValidationResult>;
//# sourceMappingURL=step-validation.d.ts.map