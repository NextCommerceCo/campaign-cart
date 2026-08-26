/**
 * Putting the phone numbers already in the store into international format.
 *
 * The field handlers do this as the shopper types, but only once `intl-tel-input`'s utils
 * script has loaded. Validation reports on the store rather than rewriting it, so this is
 * the only thing that corrects a number left behind by that race.
 */

import { useCheckoutStore } from '@/state/checkout';

import {
  e164FromWidget,
  type PhoneNumberSource,
} from '../validation/phone-validation';

/**
 * Rewrites the stored shipping and billing numbers as the ones their fields hold.
 *
 * Call it after the utils script has settled; before that the widget has no number to give
 * and nothing is written.
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
  // Compared before writing: setBillingAddress replaces the whole address object.
  if (billing && billingNumber && billingNumber !== billing.phone) {
    checkoutStore.setBillingAddress({ ...billing, phone: billingNumber });
  }
}
