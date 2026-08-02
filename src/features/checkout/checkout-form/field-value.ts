/**
 * What a checkout field is *worth* to the order, which is not always what is in the box.
 *
 * Three cases the store must not be given raw:
 *
 * - a **phone** is stored as the E.164 number `intl-tel-input` assembled (`+447700900123`),
 *   not the national text the shopper reads (`07700 900123`) — the orders API rejects the
 *   latter for anything outside the field's own country;
 * - a **checkbox or radio** is stored as a boolean, not the string `"on"` a browser puts in
 *   `value`, because `accepts_marketing` reaches the API as a boolean;
 * - everything else is the string as typed.
 *
 * Extracted from the field-name routing half of `handleFieldChange`. One dependency: the
 * map of `intl-tel-input` instances.
 */

import type { Iti } from 'intl-tel-input';

/**
 * The value to store for `fieldName`, given the element the shopper interacted with.
 *
 * `phoneInputs` is keyed `shipping` / `billing`; when the field has no instance — the
 * library failed to load, or the billing form has not been revealed yet — the typed text is
 * used instead, so the order carries something rather than nothing.
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
  phoneInputs: Map<string, Iti>
): string | boolean {
  // Get the correct value based on input type
  // For phone fields, use intlTelInput's international format if available
  if (fieldName === 'phone' || fieldName === 'billing-phone') {
    const phoneType = fieldName === 'phone' ? 'shipping' : 'billing';
    const phoneInstance = phoneInputs.get(phoneType);
    if (phoneInstance) {
      // Use intlTelInput's getNumber() for international format
      return phoneInstance.getNumber() || target.value;
    }
    return target.value;
  }

  if (
    target instanceof HTMLInputElement &&
    (target.type === 'checkbox' || target.type === 'radio')
  ) {
    return target.checked;
  }

  return target.value;
}
