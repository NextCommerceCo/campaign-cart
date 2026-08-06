import { CheckoutState } from '../../../state/checkout';
import { PostalCodeFormatContext } from './postal-code-format';
import { StateFieldsContext } from './state-fields';
export interface BillingFieldRoutingContext {
    billingFields: Map<string, HTMLElement>;
    postalCodeFormat: PostalCodeFormatContext;
    stateFields: StateFieldsContext;
}
type BillingAddress = CheckoutState['billingAddress'];
interface BillingAddressStore {
    billingAddress?: BillingAddress;
    formData: {
        province?: string;
    } & Record<string, unknown>;
    setBillingAddress: (address: BillingAddress) => void;
}
export declare function routeBillingFieldValue(fieldName: string, value: string, checkoutStore: BillingAddressStore): void;
export declare function routeBillingField(ctx: BillingFieldRoutingContext, fieldName: string, target: HTMLInputElement | HTMLSelectElement, checkoutStore: BillingAddressStore): Promise<void>;
export {};
//# sourceMappingURL=billing-field-routing.d.ts.map