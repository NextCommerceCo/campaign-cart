import { Logger } from '../../../../core/logger';
import { ErrorDisplayManager } from '../../utils/error-display-utils';
export interface FieldErrorDisplayContext {
    form: HTMLFormElement;
    fields: Map<string, HTMLElement>;
    billingFields?: Map<string, HTMLElement>;
    errors: ErrorDisplayManager;
    logger: Logger;
}
export declare function displayErrors(ctx: FieldErrorDisplayContext, errors: Record<string, string>, scrollToField?: string): void;
export declare function focusFirstError(ctx: FieldErrorDisplayContext, fieldName: string): void;
export declare function updateFieldState(ctx: FieldErrorDisplayContext, fieldName: string, state: 'valid' | 'invalid' | 'neutral'): void;
export declare function enhanceAccessibility(ctx: FieldErrorDisplayContext): void;
//# sourceMappingURL=field-error-display.d.ts.map