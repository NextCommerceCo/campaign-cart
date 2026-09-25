/**
 * Checking the separate billing address a shopper enters when it differs from shipping.
 *
 * It is deliberately its own module rather than a second pass of the shipping rules,
 * because the billing address arrives with API field names (`first_name`, not `fname`).
 * Its messages are the shipping ones (`field-messages.ts`): each shows under its own
 * billing field, which already says which address it belongs to.
 *
 * Extracted verbatim from `CheckoutValidator.validateBillingAddress`. It needs two things
 * from the validator ({@link BillingAddressValidationContext}).
 */

import { asksForPostcode, type CountryConfig } from '@/core/country-service';

import { isValidPhone, type PhoneNumberSource } from './phone-validation';
import { emojiErrors, fieldMessage, postalMessage } from './field-messages';
import { isValidName } from './validation-patterns';

/** What this module needs from `CheckoutValidator`. */
export interface BillingAddressValidationContext {
  /** Provides `validatePostalCode(value, countryCode, config)` and the message wording. */
  countryService: any;
  /** Set by the form once its phone fields exist, so the number is checked per country. */
  phoneSource?: (type: 'shipping' | 'billing') => PhoneNumberSource | undefined;
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

  if (asksForPostcode(countryConfig)) requiredBillingFields.push('postal');

  const country = billingAddress?.country;
  const source = ctx.countryService;

  requiredBillingFields.forEach(field => {
    const value = billingAddress?.[field];

    if (!value || value.trim() === '') {
      errors[field] = fieldMessage(source, 'error.required', field, {
        country,
      });
      isValid = false;
    } else if (
      (field === 'first_name' || field === 'last_name') &&
      !isValidName(value)
    ) {
      errors[field] = fieldMessage(source, 'error.name', field);
      isValid = false;
    }
  });

  if (
    billingAddress?.phone &&
    !isValidPhone(billingAddress.phone, ctx.phoneSource?.('billing'))
  ) {
    errors.phone = fieldMessage(source, 'error.pattern', 'phone');
    isValid = false;
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
      errors.postal = postalMessage(
        source,
        'postal',
        billingAddress.country,
        countryConfig
      );
      isValid = false;
    }
  }

  const emojiProblems = emojiErrors(source, billingAddress, country);
  Object.assign(errors, emojiProblems);
  if (Object.keys(emojiProblems).length) isValid = false;

  return { isValid, errors };
}
