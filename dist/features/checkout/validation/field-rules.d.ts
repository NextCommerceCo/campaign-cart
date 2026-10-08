import { CountryConfig } from '../../../core/i18n-rules';
import { PhoneNumberSource } from './phone-validation';
import { ValidationRule } from './validation.types';
export interface AddressCountry {
    country: string;
    config: CountryConfig;
}
export interface FieldRuleContext {
    i18nRules: any;
    phoneSource?: (type: 'shipping' | 'billing') => PhoneNumberSource | undefined;
    addressCountry?: (type: 'shipping' | 'billing') => AddressCountry | undefined;
    fieldName?: string;
}
export declare function addressTypeOf(fieldName?: string): 'shipping' | 'billing';
export declare function createValidationRules(): Map<string, ValidationRule[]>;
export declare function applyRule(ctx: FieldRuleContext, rule: ValidationRule, value: any, context?: any): boolean;
//# sourceMappingURL=field-rules.d.ts.map