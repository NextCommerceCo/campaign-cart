import { CountryConfig } from '../../../core/country-service';
import { Logger } from '../../../core/logger';
import { CreditCardService } from '../services/credit-card-service';
import { PhoneNumberSource } from './phone-validation';
import { FormValidationResult, ValidationResult } from './validation.types';
export { VALIDATION_PATTERNS } from './validation-patterns';
export type { FormValidationResult, ValidationResult, ValidationRule, } from './validation.types';
export declare class CheckoutValidator {
    private logger;
    private countryService;
    private errorManager;
    private creditCardService?;
    private phoneSource?;
    private rules;
    private errors;
    constructor(logger: Logger, countryService: any);
    setCreditCardService(creditCardService: CreditCardService): void;
    setPhoneSource(resolve: (type: 'shipping' | 'billing') => PhoneNumberSource | undefined): void;
    private formContext;
    private errorContext;
    validateField(name: string, value: any, context?: any): ValidationResult;
    validateStep(step: number, formData: Record<string, any>, countryConfigs: Map<string, CountryConfig>, currentCountryConfig?: CountryConfig, billingAddress?: any, sameAsShipping?: boolean): Promise<FormValidationResult>;
    validateForm(formData: Record<string, any>, countryConfigs: Map<string, CountryConfig>, currentCountryConfig?: CountryConfig, includePayment?: boolean, billingAddress?: any, sameAsShipping?: boolean): Promise<FormValidationResult>;
    isValidEmail(email: string): boolean;
    isValidPhone(phone: string): boolean;
    isValidName(name: string): boolean;
    isValidCity(city: string): boolean;
    setError(fieldName: string, message: string): void;
    clearError(fieldName: string): void;
    clearAllErrors(): void;
    showError(fieldName: string, message: string): void;
    focusFirstErrorField(firstErrorField?: string): void;
    isValid(): boolean;
    destroy(): void;
}
//# sourceMappingURL=checkout-validator.d.ts.map