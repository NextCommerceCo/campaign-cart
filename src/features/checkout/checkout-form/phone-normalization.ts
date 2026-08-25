/**
 * Putting the phone numbers already in the store into international format.
 *
 * The field handlers normalise as the shopper types, but only from the moment
 * `intl-tel-input`'s utils script has loaded. A shopper who finished typing before it
 * landed, or whose number was restored from an earlier page, leaves a national number
 * behind. Validation reports on the store rather than rewriting it, so this is the only
 * thing that corrects those.
 *
 * A module rather than a method because a store write is worth testing on a real store,
 * and the enhancer that used to own this is not constructible in a unit test.
 */

import { useCheckoutStore } from '@/state/checkout';

import {
  e164FromWidget,
  type PhoneNumberSource,
} from '../validation/phone-validation';

/**
 * Rewrites the stored shipping and billing numbers in E.164, where one can be produced.
 *
 * Writes through the store's own actions, so subscribers see the change. Each number is
 * written only when it actually differs, because `setBillingAddress` replaces the whole
 * address object and a no-op write would wake every subscriber for nothing.
 *
 * Call it after the utils script has settled — before that the widget has no number to
 * give, and every stored value is left exactly as it is.
 *
 * @example
 * ```ts
 * await awaitPhoneUtils(this.phoneInputs);
 * normalizeStoredPhones(this.phoneInputs);
 * ```
 */
export function normalizeStoredPhones(
  phoneInputs: ReadonlyMap<string, PhoneNumberSource>
): void {
  const checkoutStore = useCheckoutStore.getState();

  const shipping = e164FromWidget(phoneInputs.get('shipping'));
  if (shipping && shipping !== checkoutStore.formData.phone) {
    checkoutStore.updateFormData({ phone: shipping });
  }

  const billing = checkoutStore.billingAddress;
  const billingNumber = e164FromWidget(phoneInputs.get('billing'));
  if (billing && billingNumber && billingNumber !== billing.phone) {
    checkoutStore.setBillingAddress({ ...billing, phone: billingNumber });
  }
}
