/**
 * The submit-time check: everything the order needs, judged at once.
 *
 * Unlike the per-field rules in `field-rules.ts`, this runs when the shopper presses the
 * pay button, so it has to be complete — a field it lets through becomes an order the
 * merchant cannot ship. It collects **every** message rather than stopping at the first,
 * so the shopper fixes the form in one pass, then names the topmost problem as the one to
 * scroll to.
 *
 * Which fields are required is not a fixed list. The country decides whether a state is
 * required, the markup decides whether a phone is (`required` or `data-next-required` on
 * the phone input), and the payment method decides whether card fields are checked at all.
 *
 * Extracted verbatim from `CheckoutValidator.validateForm`. It needs four things from the
 * validator ({@link FormValidationContext}).
 */

import type { CountryConfig } from '@/core/country-service';

import type {
  CreditCardData,
  CreditCardService,
} from '../services/credit-card-service';

import { validateBillingAddress } from './billing-address-validation';
import { formatFieldName } from './field-labels';
import { findFirstErrorFieldInDOM } from './first-error-field';
import {
  isValidCity,
  isValidEmail,
  isValidName,
  isValidPhone,
} from './validation-patterns';
import type { FormValidationResult } from './validation.types';

/** What form and step validation need from `CheckoutValidator`. */
export interface FormValidationContext {
  /** Provides `validatePostalCode(value, countryCode, config)`. */
  countryService: any;
  /** `intl-tel-input` wrapper, when the form has one. */
  phoneInputManager?: any;
  /** Country-aware phone check installed by the form. Preferred over `phoneInputManager`. */
  phoneValidator?: (
    phoneNumber: string,
    type?: 'shipping' | 'billing'
  ) => boolean;
  /** Set once the card fields exist. Absent means the card is not checked here at all. */
  creditCardService?: CreditCardService;
}

/**
 * Validates the whole form and returns every problem found.
 *
 * @param ctx What this needs from the validator.
 * @param formData The collected form values. **Mutated** when `intl-tel-input` is active:
 * `formData.phone` is replaced with the E.164 number so the order carries a normalised one.
 * @param countryConfigs Country code → rules (state required, postal format).
 * @param currentCountryConfig The shopper's country, used only for the wording of messages.
 * @param includePayment Whether to check the card fields. Pass `true` for card payments.
 * @param billingAddress The separate billing address, when there is one. When
 * `sameAsShipping` is `false` and this is missing, every required billing field is
 * reported missing — "nothing captured" is a failure, not a pass.
 * @param sameAsShipping When `true`, `billingAddress` is ignored.
 *
 * @example
 * ```ts
 * const result = await validateForm(ctx, formData, countryConfigs, usConfig, true);
 * if (!result.isValid) focusFirstErrorField(result.firstErrorField);
 * ```
 */
export async function validateForm(
  ctx: FormValidationContext,
  formData: Record<string, any>,
  countryConfigs: Map<string, CountryConfig>,
  currentCountryConfig?: CountryConfig,
  includePayment: boolean = false,
  billingAddress?: any,
  sameAsShipping: boolean = true
): Promise<FormValidationResult> {
  let isValid = true;
  let firstErrorField: string | undefined;
  const errors: Record<string, string> = {};

  // Define required fields in validation order (fname first for proper focus order)
  const baseRequiredFields = ['fname', 'lname', 'email', 'address1', 'city'];

  const countryConfig = countryConfigs.get(formData.country);
  const requiredFields = [...baseRequiredFields];

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

  if (countryConfig?.stateRequired) {
    requiredFields.push('province');
  }

  requiredFields.push('postal', 'country');

  // Validate each required field
  requiredFields.forEach(field => {
    if (!formData[field] || formData[field].trim() === '') {
      errors[field] =
        `${formatFieldName(field, currentCountryConfig)} is required`;
      isValid = false;
    }
  });

  // Name validation
  if (formData.fname && formData.fname.trim() && !isValidName(formData.fname)) {
    errors.fname =
      'First name can only contain letters, spaces, hyphens, and apostrophes';
    isValid = false;
  }

  if (formData.lname && formData.lname.trim() && !isValidName(formData.lname)) {
    errors.lname =
      'Last name can only contain letters, spaces, hyphens, and apostrophes';
    isValid = false;
  }

  // City validation
  if (formData.city && formData.city.trim() && !isValidCity(formData.city)) {
    errors.city = 'Please enter a valid city name';
    isValid = false;
  }

  // Email validation
  if (formData.email && !isValidEmail(formData.email)) {
    errors.email = 'Please enter a valid email address';
    isValid = false;
  }

  // Phone validation
  if (formData.phone) {
    let phoneIsValid = false;

    if (ctx.phoneValidator) {
      phoneIsValid = ctx.phoneValidator(formData.phone, 'shipping');
    } else if (ctx.phoneInputManager) {
      phoneIsValid = ctx.phoneInputManager.validatePhoneNumber(true);
      const formattedPhone =
        ctx.phoneInputManager.getFormattedPhoneNumber(true);
      if (formattedPhone) {
        formData.phone = formattedPhone;
      }
    } else {
      phoneIsValid = isValidPhone(formData.phone);
    }

    if (!phoneIsValid) {
      errors.phone = 'Please enter a valid phone number';
      isValid = false;
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
    }
  }

  // Credit card validation
  if (includePayment) {
    const paymentMethod = formData.paymentMethod || 'card_token';

    if (paymentMethod === 'card_token') {
      const cardData: CreditCardData = {
        full_name: `${formData.fname || ''} ${formData.lname || ''}`.trim(),
        month: formData['exp-month'] || formData['cc-month'] || '',
        year: formData['exp-year'] || formData['cc-year'] || '',
      };

      // Check credit card service if available
      if (ctx.creditCardService) {
        // Check Spreedly fields
        const spreedlyCheck = ctx.creditCardService.checkSpreedlyFieldsReady();
        if (spreedlyCheck.hasEmptyFields) {
          spreedlyCheck.errors.forEach(error => {
            const fieldName = error.field === 'number' ? 'cc-number' : 'cvv';
            errors[fieldName] = error.message;
          });
          isValid = false;
        }

        // Validate month/year dropdowns
        const creditCardValidation =
          ctx.creditCardService.validateCreditCard(cardData);
        if (!creditCardValidation.isValid && creditCardValidation.errors) {
          Object.entries(creditCardValidation.errors).forEach(
            ([field, error]) => {
              errors[field] = error;
            }
          );
          isValid = false;
        }
      } else {
        // No service installed (the Spreedly key arrived late, or never) means the card
        // was never looked at — that is not the same thing as a card that passed. Keyed
        // `general`, not a card field name: this is a system-readiness failure, not a
        // shopper mistake, and no card field is actually wrong. `general` is also the key
        // this file's caller already uses for the same class of "can't proceed" failure
        // (see `checkout-form.enhancer.ts`'s `setError('general', …)` calls), and it steers
        // clear of `focusFirstErrorField`'s card-field list (finding 133 #7), which does not
        // reliably resolve every card field name to something focusable.
        errors.general =
          'Payment cannot be validated right now because the payment system is not ready. Please wait a moment and try again.';
        isValid = false;
      }
    }
  }

  // Billing address validation. Guarded on the shopper's *choice* alone: no captured
  // address is a missing billing address, not a reason to skip the check.
  if (!sameAsShipping) {
    const billingErrors = validateBillingAddress(
      ctx,
      billingAddress,
      countryConfigs
    );

    Object.entries(billingErrors.errors).forEach(([field, error]) => {
      const fieldNameMap: Record<string, string> = {
        first_name: 'billing-fname',
        last_name: 'billing-lname',
        address1: 'billing-address1',
        city: 'billing-city',
        province: 'billing-province',
        postal: 'billing-postal',
        country: 'billing-country',
        phone: 'billing-phone',
      };

      const htmlFieldName = fieldNameMap[field] || `billing-${field}`;
      errors[htmlFieldName] = error;
    });

    if (!billingErrors.isValid) {
      isValid = false;
    }
  }

  // After collecting all errors, find the first error field based on DOM position
  if (!isValid && Object.keys(errors).length > 0) {
    firstErrorField = findFirstErrorFieldInDOM(errors);
  }

  return {
    isValid,
    ...(firstErrorField && { firstErrorField }),
    errors,
  };
}
