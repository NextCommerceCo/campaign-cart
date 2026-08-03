import { Logger } from '../../../core/logger';
export interface BillingFormSetupContext {
    form: HTMLElement;
    billingFields: Map<string, HTMLElement>;
    logger: Logger;
}
export declare function scanBillingFields(ctx: BillingFormSetupContext): void;
export declare function convertShippingFieldsToBilling(billingForm: HTMLElement): void;
export declare function setInitialBillingFormState(ctx: BillingFormSetupContext): void;
export declare function setupBillingForm(ctx: BillingFormSetupContext): boolean;
//# sourceMappingURL=billing-form-setup.d.ts.map