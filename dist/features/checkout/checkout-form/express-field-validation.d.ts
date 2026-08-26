import { PhoneNumberSource } from '../validation/phone-validation';
import { FormValidationResult } from '../validation/validation.types';
export interface ExpressFieldValidationContext {
    phoneSource?: (type: 'shipping' | 'billing') => PhoneNumberSource | undefined;
}
export declare function validateExpressFields(ctx: ExpressFieldValidationContext, formData: Record<string, unknown>, requiredFields: string[]): FormValidationResult;
//# sourceMappingURL=express-field-validation.d.ts.map