export interface ValidationRule {
    type: 'required' | 'email' | 'phone' | 'postal' | 'name' | 'city' | 'custom';
    message?: string;
    validator?: (value: any, context?: any) => boolean;
}
export interface ValidationResult {
    isValid: boolean;
    message?: string;
}
export interface FormValidationResult {
    isValid: boolean;
    firstErrorField?: string;
    errors: Record<string, string>;
}
//# sourceMappingURL=validation.types.d.ts.map