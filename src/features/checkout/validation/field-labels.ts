/**
 * The name a shopper sees for a field when a message has to mention it.
 *
 * `"postal is required"` is not a sentence anyone wants to read, and the right word
 * changes by country — a US shopper is missing a *ZIP code*, a UK shopper a *postcode*,
 * a Japanese shopper a *prefecture*. This is the one place that mapping lives, so the
 * three places that build messages (per-field rules, step validation, form validation)
 * all say the same thing.
 *
 * Extracted verbatim from `CheckoutValidator.formatFieldName`. It needs nothing from the
 * validator.
 */

/**
 * Turns a field name into the label to put in a message.
 *
 * Unknown names are returned unchanged rather than dropped, so a new field still produces
 * a readable-ish message instead of an empty one.
 *
 * @param field The internal field name, e.g. `postal`.
 * @param currentCountryConfig The shopper's country, which decides the wording for
 * `province` and `postal`. Omit it for the generic wording.
 *
 * @example
 * ```ts
 * formatFieldName('postal');                                 // 'Postal code'
 * formatFieldName('postal', { postcodeLabel: 'ZIP code' });  // 'ZIP code'
 * ```
 */
export function formatFieldName(
  field: string,
  currentCountryConfig?: any
): string {
  const fieldNames: Record<string, string> = {
    fname: 'First name',
    lname: 'Last name',
    address1: 'Address',
    address2: 'Address line 2',
    city: 'City',
    province: currentCountryConfig?.stateLabel || 'State/Province',
    postal: currentCountryConfig?.postcodeLabel || 'Postal code',
    country: 'Country',
    email: 'Email',
    phone: 'Phone number',
  };

  return fieldNames[field] || field;
}
