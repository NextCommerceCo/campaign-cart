/**
 * Where a `billing-*` field's value goes.
 *
 * The separate billing address is not part of `formData`. It is its own object on the
 * checkout store, keyed by the names the orders API uses (`first_name`, not `fname`), so
 * every billing field is renamed on its way in — that renaming is this module's whole
 * reason to exist, and it is why a billing value never shows up under the name the markup
 * gave it.
 *
 * Two side effects ride along: the postcode is reformatted for the billing country, and
 * changing the billing country rebuilds the billing province dropdown.
 *
 * Extracted from the field-name routing half of `handleFieldChange`. Three dependencies
 * ({@link BillingFieldRoutingContext}) — the billing field map and the two contexts it
 * passes straight through.
 */

import type { CheckoutState } from '@/state/checkout';

import {
  formatPostalCodeInPlace,
  type PostalCodeFormatContext,
} from './postal-code-format';
import {
  updateBillingStateOptions,
  type StateFieldsContext,
} from './state-fields';

/**
 * Billing field name (with the `billing-` prefix already stripped) → the key the orders
 * API expects on a billing address.
 *
 * A name not listed here is written through unchanged, so a page that invents
 * `billing-company` puts `company` on the address rather than dropping it.
 */
const BILLING_ADDRESS_FIELD_MAP: Record<string, string> = {
  fname: 'first_name',
  lname: 'last_name',
  address1: 'address1',
  address2: 'address2',
  city: 'city',
  province: 'province',
  postal: 'postal',
  country: 'country',
  phone: 'phone',
};

/** What this module needs from the checkout form. */
export interface BillingFieldRoutingContext {
  /** Billing inputs keyed by their full `billing-…` name. */
  billingFields: Map<string, HTMLElement>;
  /** Passed through for the billing postcode. */
  postalCodeFormat: PostalCodeFormatContext;
  /** Passed through to refill the billing province dropdown. */
  stateFields: StateFieldsContext;
}

/** The shape the checkout store's billing-address setter takes. */
type BillingAddress = CheckoutState['billingAddress'];

/** The three store members this module reads and writes. */
interface BillingAddressStore {
  billingAddress?: BillingAddress;
  /**
   * Read for one value only: the *shipping* province, which preselects the billing
   * province once the billing country's list has loaded.
   */
  formData: { province?: string } & Record<string, unknown>;
  setBillingAddress: (address: BillingAddress) => void;
}

/**
 * Merges one billing field into the stored billing address under its API name.
 *
 * The whole address is rewritten each time because the store holds it as one object; the
 * defaults below are what an address looks like before the shopper has touched it.
 *
 * @example
 * ```ts
 * // <input data-next-checkout-field="billing-fname" value="Ada">
 * routeBillingFieldValue('billing-fname', 'Ada', checkoutStore);
 * // → billingAddress.first_name === 'Ada'
 * ```
 */
export function routeBillingFieldValue(
  fieldName: string,
  value: string,
  checkoutStore: BillingAddressStore
): void {
  const billingFieldName = fieldName.replace('billing-', '');
  const currentBillingData = checkoutStore.billingAddress ?? {
    first_name: '',
    last_name: '',
    address1: '',
    city: '',
    province: '',
    postal: '',
    country: '',
    phone: '',
  };

  const mappedFieldName =
    BILLING_ADDRESS_FIELD_MAP[billingFieldName] || billingFieldName;

  checkoutStore.setBillingAddress({
    ...currentBillingData,
    [mappedFieldName]: value,
  } as BillingAddress);
}

/**
 * Handles one interaction with a `billing-*` field: format the postcode, store the value,
 * and refill the province dropdown when the country is what changed.
 *
 * @example
 * ```ts
 * await routeBillingField(ctx, 'billing-country', countrySelect, useCheckoutStore.getState());
 * ```
 */
export async function routeBillingField(
  ctx: BillingFieldRoutingContext,
  fieldName: string,
  target: HTMLInputElement | HTMLSelectElement,
  checkoutStore: BillingAddressStore
): Promise<void> {
  if (fieldName === 'billing-postal' && target instanceof HTMLInputElement) {
    formatPostalCodeInPlace(
      ctx.postalCodeFormat,
      target,
      ctx.billingFields.get('billing-country')
    );
  }

  // Billing fields are always strings (no checkboxes in billing)
  routeBillingFieldValue(fieldName, target.value, checkoutStore);

  if (fieldName === 'billing-country') {
    const billingProvinceField = ctx.billingFields.get('billing-province');
    if (billingProvinceField instanceof HTMLSelectElement) {
      await updateBillingStateOptions(
        ctx.stateFields,
        target.value,
        billingProvinceField,
        checkoutStore.formData.province
      );
    }
    // Currency is location-based only, not affected by billing or shipping country
  }
}
