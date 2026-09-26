/**
 * What a checkout field is *worth* to the order, which is not always what is in the box.
 *
 * Three cases the store must not be given raw:
 *
 * - a **phone** is stored as the E.164 number its phone field assembled (`+447700900123`),
 *   not the national text the shopper reads (`07700 900123`) — the orders API rejects the
 *   latter for anything outside the field's own country;
 * - a **checkbox or radio** is stored as a boolean, not the string `"on"` a browser puts in
 *   `value`, because `accepts_marketing` reaches the API as a boolean;
 * - everything else is the string as typed.
 *
 * Extracted from the field-name routing half of `handleFieldChange`. One dependency: the
 * map of phone fields.
 *
 * This module is reached for the shipping form's fields only — a `billing-*` name is routed
 * by [`billing-field-routing.ts`](./billing-field-routing.ts) before it gets here. The
 * billing phone therefore calls {@link readPhoneValue} from over there, so that both
 * addresses put an E.164 number on the order by the same rule.
 */

import {
  normalizePhone,
  type PhoneNumberSource,
} from '../validation/phone-validation';

import { phoneFieldFor } from './phone-input';

/**
 * The E.164 number for a phone field (`+447700900123`), or the text the shopper typed when
 * there is no number to be had.
 *
 * Pass `field` when the caller already holds the input's phone field. Otherwise it is
 * looked up by the element — that is how the billing branch, which holds no such map,
 * still gets the international number.
 *
 * Two ways there is no number, and both store the typed text rather than nothing: the
 * input has no phone field (a form without one is supported, and the order is better off
 * with `07700 900123` than with an empty phone), or the field has no rules to read what
 * has been typed so far.
 *
 * @example
 * ```ts
 * readPhoneValue(billingPhoneInput);
 * // → '+447700900123'
 * ```
 */
export function readPhoneValue(
  target: HTMLInputElement | HTMLSelectElement,
  field?: PhoneNumberSource
): string {
  return normalizePhone(
    target.value,
    field ??
      (target instanceof HTMLInputElement ? phoneFieldFor(target) : undefined)
  );
}

/**
 * The value to store for `fieldName`, given the element the shopper interacted with.
 *
 * `phoneInputs` is keyed `shipping` / `billing`; a field with no entry there falls back to
 * the phone field on the element, then to the typed text — see {@link readPhoneValue}.
 *
 * @example
 * ```ts
 * updateFormData({ phone: readFieldValue('phone', phoneInput, phoneInputs) });
 * // → { phone: '+447700900123' }
 * ```
 */
export function readFieldValue(
  fieldName: string,
  target: HTMLInputElement | HTMLSelectElement,
  phoneInputs: ReadonlyMap<string, PhoneNumberSource>
): string | boolean {
  if (fieldName === 'phone') {
    return readPhoneValue(target, phoneInputs.get('shipping'));
  }

  if (
    target instanceof HTMLInputElement &&
    (target.type === 'checkbox' || target.type === 'radio')
  ) {
    return target.checked;
  }

  return target.value;
}
