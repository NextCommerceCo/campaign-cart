import { Logger } from '../../../core/logger';
import { CheckoutState } from '../../../state/checkout';
import { StateFieldsContext } from './state-fields';
export interface BillingFormSetupContext {
    form: HTMLElement;
    billingFields: Map<string, HTMLElement>;
    logger: Logger;
}
export declare function scanBillingFields(ctx: BillingFormSetupContext): void;
export declare function convertShippingFieldsToBilling(billingForm: HTMLElement): void;
export declare function setInitialBillingFormState(ctx: BillingFormSetupContext): void;
export declare function reconcileBillingToggle(ctx: BillingFormSetupContext, storedSameAsShipping: boolean): boolean;
export declare function setupBillingForm(ctx: BillingFormSetupContext): boolean;
export interface BillingAddressRestoreContext extends BillingFormSetupContext {
    stateFields: StateFieldsContext;
}
export declare function restoreBillingAddressFields(ctx: BillingAddressRestoreContext, billingAddress: CheckoutState['billingAddress']): Promise<void>;
//# sourceMappingURL=billing-form-setup.d.ts.map