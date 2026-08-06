import { Logger } from '../../../../core/logger';
import { CartState } from '../../../../types/global';
export declare class UIService {
    private form;
    private fields;
    private billingFields?;
    private logger;
    private errorManager;
    private eventManager;
    private floatingLabels;
    private periodicCheck;
    private loadingStates;
    private lastErrorsString;
    constructor(form: HTMLFormElement, fields: Map<string, HTMLElement>, logger: Logger, billingFields?: Map<string, HTMLElement>);
    initialize(): void;
    private loadingContext;
    private fieldErrorContext;
    private paymentFormContext;
    private floatingLabelContext;
    showLoading(section: string): void;
    hideLoading(section: string): void;
    updateProgress(step: number): void;
    displayErrors(errors: Record<string, string>, scrollToField?: string): void;
    focusFirstError(fieldName: string): void;
    updateFieldState(fieldName: string, state: 'valid' | 'invalid' | 'neutral'): void;
    handleCheckoutUpdate(state: any, displayErrors: (errors: Record<string, string>) => void): void;
    handleCartUpdate(cartState: CartState): void;
    initializePaymentForms(): void;
    updatePaymentFormVisibility(paymentMethod: string): void;
    handleSpreedlyFieldFocus(fieldName: 'number' | 'cvv'): void;
    handleSpreedlyFieldBlur(fieldName: 'number' | 'cvv', hasValue: boolean): void;
    handleSpreedlyFieldInput(fieldName: 'number' | 'cvv', hasValue: boolean): void;
    setupFloatingLabel(field: HTMLInputElement | HTMLSelectElement, label?: HTMLLabelElement): void;
    updateLabelsForPopulatedData(): void;
    handleResponsiveUI(): void;
    enhanceAccessibility(): void;
    destroy(): void;
}
//# sourceMappingURL=ui-service.d.ts.map