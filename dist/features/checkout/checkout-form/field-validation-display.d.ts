import { CheckoutValidator } from '../validation/checkout-validator';
export interface PressGate {
    wait: () => Promise<void> | undefined;
}
export declare function createPressGate(listen: (target: Document, type: string, handler: () => void, options: {
    capture: boolean;
}) => void): PressGate;
export interface FieldValidationContext {
    validator: CheckoutValidator;
    getFieldByName: (fieldName: string) => HTMLElement | null;
}
export declare function resetFieldDisplay(ctx: FieldValidationContext, fieldName: string): void;
export declare function updateFieldValidationDisplay(ctx: FieldValidationContext, eventType: string, fieldName: string, value: string): void;
//# sourceMappingURL=field-validation-display.d.ts.map