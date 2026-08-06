import { ValidationRule } from './validation.types';
export interface FieldRuleContext {
    countryService: any;
    phoneInputManager?: any;
}
export declare function createValidationRules(): Map<string, ValidationRule[]>;
export declare function applyRule(ctx: FieldRuleContext, rule: ValidationRule, value: any, context?: any): boolean;
//# sourceMappingURL=field-rules.d.ts.map