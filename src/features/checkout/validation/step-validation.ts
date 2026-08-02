/**
 * Validating one step of a multi-step checkout, so the shopper is only stopped by fields
 * on the screen they are looking at.
 *
 * A single-page checkout runs `form-validation.ts` once at submit. A multi-step one has to
 * gate each *next* press, and complaining about a card number on the address step would be
 * nonsense — so each step has its own required list. Step 3 is the exception: it is the
 * last gate before payment, so it hands over to the full form check.
 *
 * Extracted verbatim from `CheckoutValidator.validateStep`. It shares
 * {@link FormValidationContext} with `form-validation.ts` — three of the four fields are
 * its own, the fourth (`creditCardService`) is what step 3 passes through.
 */

import type { CountryConfig } from '@/core/country-service';

import { formatFieldName } from './field-labels';
import type { FormValidationContext } from './form-validation';
import { validateForm } from './form-validation';
import {
  isValidCity,
  isValidEmail,
  isValidName,
  isValidPhone,
} from './validation-patterns';
import type { FormValidationResult } from './validation.types';

/**
 * Validates the fields belonging to one checkout step.
 *
 * - **Step 1** — contact details and the shipping address, plus a state when the country
 *   requires one and a phone when the markup marks it required.
 * - **Step 2** — the same list again, as a guard against a shopper reaching the shipping
 *   step with the address cleared behind them.
 * - **Step 3** — delegates to {@link validateForm} with payment checks on.
 *
 * Any other step number validates nothing and returns valid.
 *
 * @param ctx What this needs from the validator.
 * @param step The 1-based step the shopper is trying to leave.
 * @param formData The collected form values.
 * @param countryConfigs Country code → rules (state required, postal format).
 * @param currentCountryConfig The shopper's country, used for the wording of messages.
 *
 * @example
 * ```ts
 * const result = await validateStep(ctx, 1, formData, countryConfigs, usConfig);
 * if (result.isValid) goToStep(2);
 * ```
 */
export async function validateStep(
  ctx: FormValidationContext,
  step: number,
  formData: Record<string, any>,
  countryConfigs: Map<string, CountryConfig>,
  currentCountryConfig?: CountryConfig
): Promise<FormValidationResult> {
  let isValid = true;
  let firstErrorField: string | undefined;
  const errors: Record<string, string> = {};

  // Define fields required for each step
  let requiredFields: string[] = [];

  if (step === 1) {
    // Step 1: Contact information and shipping address
    requiredFields = [
      'email',
      'fname',
      'lname',
      'country',
      'address1',
      'city',
      'postal',
    ];

    const countryConfig = countryConfigs.get(formData.country);
    if (countryConfig?.stateRequired) {
      requiredFields.push('province');
    }

    // Check if phone field is marked as required in HTML
    const phoneField = document.querySelector(
      '[name="phone"]'
    ) as HTMLInputElement;
    if (
      phoneField &&
      (phoneField.hasAttribute('required') ||
        phoneField.dataset.nextRequired === 'true')
    ) {
      requiredFields.push('phone');
    }
  } else if (step === 2) {
    // Step 2: Shipping method (already validated in step 1, just check if present)
    requiredFields = [
      'email',
      'fname',
      'lname',
      'country',
      'address1',
      'city',
      'postal',
    ];
    const countryConfig = countryConfigs.get(formData.country);
    if (countryConfig?.stateRequired) {
      requiredFields.push('province');
    }
  } else if (step === 3) {
    // Step 3: Payment (validate everything)
    return validateForm(
      ctx,
      formData,
      countryConfigs,
      currentCountryConfig,
      true,
      undefined,
      true
    );
  }

  // Validate each required field
  requiredFields.forEach(field => {
    if (!formData[field] || formData[field].trim() === '') {
      errors[field] =
        `${formatFieldName(field, currentCountryConfig)} is required`;
      isValid = false;
      if (!firstErrorField) firstErrorField = field;
    }
  });

  // Name validation
  if (formData.fname && formData.fname.trim() && !isValidName(formData.fname)) {
    errors.fname =
      'First name can only contain letters, spaces, hyphens, and apostrophes';
    isValid = false;
    if (!firstErrorField) firstErrorField = 'fname';
  }

  if (formData.lname && formData.lname.trim() && !isValidName(formData.lname)) {
    errors.lname =
      'Last name can only contain letters, spaces, hyphens, and apostrophes';
    isValid = false;
    if (!firstErrorField) firstErrorField = 'lname';
  }

  // City validation
  if (formData.city && formData.city.trim() && !isValidCity(formData.city)) {
    errors.city = 'Please enter a valid city name';
    isValid = false;
    if (!firstErrorField) firstErrorField = 'city';
  }

  // Email validation
  if (formData.email && !isValidEmail(formData.email)) {
    errors.email = 'Please enter a valid email address';
    isValid = false;
    if (!firstErrorField) firstErrorField = 'email';
  }

  // Phone validation (if required)
  if (requiredFields.includes('phone') && formData.phone) {
    let phoneIsValid = false;

    if (ctx.phoneValidator) {
      phoneIsValid = ctx.phoneValidator(formData.phone, 'shipping');
    } else if (ctx.phoneInputManager) {
      phoneIsValid = ctx.phoneInputManager.validatePhoneNumber(true);
    } else {
      phoneIsValid = isValidPhone(formData.phone);
    }

    if (!phoneIsValid) {
      errors.phone = 'Please enter a valid phone number';
      isValid = false;
      if (!firstErrorField) firstErrorField = 'phone';
    }
  }

  // Postal code validation
  if (formData.postal && formData.country) {
    const countryConfig = countryConfigs.get(formData.country);
    if (
      countryConfig &&
      !ctx.countryService.validatePostalCode(
        formData.postal,
        formData.country,
        countryConfig
      )
    ) {
      const errorMsg = countryConfig.postcodeExample
        ? `Please enter a valid ${countryConfig.postcodeLabel.toLowerCase()} (e.g. ${countryConfig.postcodeExample})`
        : `Please enter a valid ${countryConfig.postcodeLabel.toLowerCase()}`;
      errors.postal = errorMsg;
      isValid = false;
      if (!firstErrorField) firstErrorField = 'postal';
    }
  }

  return { isValid, firstErrorField, errors };
}
