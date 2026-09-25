/**
 * The English name of a field inside a message, used when the address-rules service has
 * not sent its own (`field-messages.ts`).
 *
 * Deliberately generic — `Postal code`, not the country's `ZIP Code` — because the
 * country's word arrives from the service in the service's language, and an English
 * sentence around it is what this fallback exists to avoid.
 */

/**
 * Turns a field name into the label to put in a message.
 *
 * Unknown names are returned unchanged rather than dropped, so a new field still produces
 * a readable-ish message instead of an empty one.
 *
 * @example
 * ```ts
 * formatFieldName('postal');     // 'Postal code'
 * formatFieldName('first_name'); // 'First name'
 * ```
 */
export function formatFieldName(field: string): string {
  const fieldNames: Record<string, string> = {
    fname: 'First name',
    first_name: 'First name',
    lname: 'Last name',
    last_name: 'Last name',
    address1: 'Address',
    address2: 'Address line 2',
    city: 'City',
    province: 'State or province',
    postal: 'Postal code',
    country: 'Country',
    email: 'Email',
    phone: 'Phone number',
  };

  return fieldNames[field] ?? field;
}
