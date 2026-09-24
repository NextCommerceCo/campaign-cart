/**
 * Checking the handful of fields a merchant asks for before an express payment.
 *
 * Express checkout normally skips validation: the shopper's details come from the wallet,
 * not the form. A merchant can opt back in for named fields with
 * `paymentConfig.expressCheckout.requiredFields`, and this is that check.
 */

import { isValidEmail } from '../validation/validation-patterns';
import {
  isValidPhone,
  type PhoneNumberSource,
} from '../validation/phone-validation';
import type { FormValidationResult } from '../validation/validation.types';

/** The label a shopper sees for a field in the "is required" message. */
const FIELD_LABELS: Record<string, string> = {
  email: 'Email',
  fname: 'First Name',
  lname: 'Last Name',
  phone: 'Phone',
  address1: 'Address',
  city: 'City',
  province: 'State/Province',
  postal: 'ZIP/Postal Code',
  country: 'Country',
};

/** What this needs from the checkout form. */
export interface ExpressFieldValidationContext {
  /**
   * The live phone field for an address, when the form has one. The same shape the
   * validation contexts take, so the form installs one resolver for all of them.
   */
  phoneSource?: (type: 'shipping' | 'billing') => PhoneNumberSource | undefined;
}

/**
 * Reports which of `requiredFields` are missing or malformed.
 *
 * Email and phone are checked for shape as well as presence, through the same functions the
 * form and the step use, so a value accepted there is accepted here. Every other field is
 * checked for presence only.
 *
 * @example
 * ```ts
 * validateExpressFields(ctx, checkoutStore.formData, ['email', 'phone']);
 * // → { isValid: false, errors: { phone: 'Please enter a valid phone number' },
 * //     firstErrorField: 'phone' }
 * ```
 */
export function validateExpressFields(
  ctx: ExpressFieldValidationContext,
  formData: Record<string, unknown>,
  requiredFields: string[]
): FormValidationResult {
  const errors: Record<string, string> = {};

  for (const field of requiredFields) {
    const value = formData[field];
    const text = typeof value === 'string' ? value.trim() : value;

    if (!text) {
      errors[field] = `${FIELD_LABELS[field] ?? field} is required`;
    } else if (field === 'email' && !isValidEmail(String(text))) {
      errors[field] = 'Please enter a valid email address';
    } else if (
      field === 'phone' &&
      !isValidPhone(String(text), ctx.phoneSource?.('shipping'))
    ) {
      errors[field] = 'Please enter a valid phone number';
    }
  }

  // The order asked for is the order to report in, so the first failure is a lookup.
  const firstErrorField = requiredFields.find(field => field in errors);

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    ...(firstErrorField !== undefined && { firstErrorField }),
  };
}
