/**
 * Checking the separate billing address a shopper enters when it differs from shipping.
 *
 * It is deliberately its own module rather than a second pass of the shipping rules,
 * because the two disagree in ways that matter: the billing address arrives with API field
 * names (`first_name`, not `fname`), every message is prefixed "Billing …" so the shopper
 * can tell which of two identical-looking sections is wrong, and the labels are fixed
 * English rather than the country-specific wording used for shipping.
 *
 * Extracted verbatim from `CheckoutValidator.validateBillingAddress`. It needs two things
 * from the validator ({@link BillingAddressValidationContext}).
 */

import type { CountryConfig } from '@/core/country-service';

import { isValidName, isValidPhone } from './validation-patterns';

/** What this module needs from `CheckoutValidator`. */
export interface BillingAddressValidationContext {
  /** Provides `validatePostalCode(value, countryCode, config)`. */
  countryService: any;
  /** Set by the form when `intl-tel-input` is wired up, so the number is checked per country. */
  phoneValidator?: (
    phoneNumber: string,
    type?: 'shipping' | 'billing'
  ) => boolean;
}

/**
 * Validates a billing address and returns one message per failing field.
 *
 * The returned keys are the *billing address*'s own field names (`first_name`, `postal`,
 * `phone`). The caller maps them onto the `billing-` prefixed form field names before
 * showing them — see `form-validation.ts`.
 *
 * @param ctx What this needs from the validator.
 * @param billingAddress The address the shopper entered. A missing object fails every
 * required field rather than throwing.
 * @param countryConfigs Country code → rules, used to decide whether a state is required
 * and to check the postal code format.
 *
 * @example
 * ```ts
 * validateBillingAddress(ctx, { first_name: 'Ada', country: 'US' }, countryConfigs);
 * // { isValid: false, errors: { last_name: 'Billing last name is required', … } }
 * ```
 */
export function validateBillingAddress(
  ctx: BillingAddressValidationContext,
  billingAddress: any,
  countryConfigs: Map<string, CountryConfig>
): { isValid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  let isValid = true;

  const requiredBillingFields = [
    'first_name',
    'last_name',
    'address1',
    'city',
    'country',
  ];

  const countryConfig = countryConfigs.get(billingAddress?.country);
  if (countryConfig?.stateRequired) {
    requiredBillingFields.push('province');
  }

  requiredBillingFields.push('postal');

  requiredBillingFields.forEach(field => {
    const value = billingAddress?.[field];

    if (!value || value.trim() === '') {
      const fieldDisplayName =
        field === 'first_name'
          ? 'First name'
          : field === 'last_name'
            ? 'Last name'
            : field === 'address1'
              ? 'Address'
              : field === 'city'
                ? 'City'
                : field === 'province'
                  ? 'State/Province'
                  : field === 'postal'
                    ? 'ZIP/Postal code'
                    : field === 'country'
                      ? 'Country'
                      : field;

      errors[field] = `Billing ${fieldDisplayName.toLowerCase()} is required`;
      isValid = false;
    } else if (
      (field === 'first_name' || field === 'last_name') &&
      value.trim()
    ) {
      if (!isValidName(value)) {
        const fieldDisplayName =
          field === 'first_name' ? 'First name' : 'Last name';
        errors[field] =
          `Billing ${fieldDisplayName.toLowerCase()} can only contain letters, spaces, hyphens, and apostrophes`;
        isValid = false;
      }
    }
  });

  // Validate billing phone
  if (billingAddress?.phone) {
    let phoneIsValid = false;

    if (ctx.phoneValidator) {
      phoneIsValid = ctx.phoneValidator(billingAddress.phone, 'billing');
    } else {
      phoneIsValid = isValidPhone(billingAddress.phone);
    }

    if (!phoneIsValid) {
      errors.phone = 'Please enter a valid billing phone number';
      isValid = false;
    }
  }

  // Validate billing postal code
  if (billingAddress?.postal && billingAddress?.country) {
    const countryConfig = countryConfigs.get(billingAddress.country);
    if (
      countryConfig &&
      !ctx.countryService.validatePostalCode(
        billingAddress.postal,
        billingAddress.country,
        countryConfig
      )
    ) {
      const errorMsg = countryConfig.postcodeExample
        ? `Please enter a valid billing ${countryConfig.postcodeLabel.toLowerCase()} (e.g. ${countryConfig.postcodeExample})`
        : `Please enter a valid billing ${countryConfig.postcodeLabel.toLowerCase()}`;
      errors.postal = errorMsg;
      isValid = false;
    }
  }

  return { isValid, errors };
}
