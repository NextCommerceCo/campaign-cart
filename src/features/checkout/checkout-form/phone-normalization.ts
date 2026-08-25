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

import type { PhoneNumberSource } from '../validation/phone-validation';

/**
 * The shortest E.164 number that can be a number rather than a dial code.
 *
 * A dial code is one to three digits and the shortest national number in service is four
 * (Niue and Tokelau), so five is the floor. The guard matters because a widget on an empty
 * field can answer with the selected country's dial code alone, and writing `+1` into the
 * store would replace a number with a country.
 */
const MIN_E164_DIGITS = 5;

/**
 * The number the field itself is showing, in E.164, or nothing.
 *
 * Nothing means one of four states that all want the stored value left alone: no widget on
 * the page, the utils script has not landed (`getNumber()` answers `''`), the field is empty
 * because it has not been populated yet, or the widget offered a bare dial code.
 */
function fieldNumber(widget?: PhoneNumberSource): string | undefined {
  try {
    const e164 = widget?.getNumber?.();
    if (!e164?.startsWith('+')) return undefined;
    return e164.replace(/\D/g, '').length >= MIN_E164_DIGITS ? e164 : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Rewrites the stored shipping and billing numbers in E.164, where one can be produced.
 *
 * Writes through the store's own actions, so subscribers see the change. Each number is
 * written only when it actually differs, because `setBillingAddress` replaces the whole
 * address object and a no-op write would wake every subscriber for nothing.
 *
 * Call it after the utils script has settled — before that, `normalizePhone` has nothing
 * to convert with and returns the text as typed.
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

  const shipping = fieldNumber(phoneInputs.get('shipping'));
  if (shipping && shipping !== checkoutStore.formData.phone) {
    checkoutStore.updateFormData({ phone: shipping });
  }

  const billing = checkoutStore.billingAddress;
  const billingNumber = fieldNumber(phoneInputs.get('billing'));
  if (billing && billingNumber && billingNumber !== billing.phone) {
    checkoutStore.setBillingAddress({ ...billing, phone: billingNumber });
  }
}
