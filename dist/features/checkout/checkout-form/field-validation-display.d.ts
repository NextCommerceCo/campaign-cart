import { CheckoutValidator } from '../validation/checkout-validator';
export interface FieldValidationContext {
    validator: CheckoutValidator;
    getFieldByName: (fieldName: string) => HTMLElement | null;
}
export declare function updateFieldValidationDisplay(ctx: FieldValidationContext, eventType: string, fieldName: string, value: string): void;
//# sourceMappingURL=field-validation-display.d.ts.map