/**
 * Putting validation verdicts on the checkout fields themselves.
 *
 * Given a map of field name → message, this marks each named input as wrong and writes
 * the message beside it, scrolls the shopper to the first problem, and describes the
 * result to a screen reader. It does not decide *what* is wrong — `CheckoutValidator`
 * does that, and hands the result here.
 *
 * Two things are worth knowing before changing anything:
 *
 * - **Billing fields live in a second map.** The billing section is cloned from the
 *   shipping one and its fields are renamed `billing-*`, so a name starting with
 *   `billing-` that is missing from the main map is looked up in the billing map before
 *   being reported as not found.
 * - **The hosted card fields overrule us.** `cc-number` and `cvv` are validated inside the
 *   Spreedly iframe, which marks its own container `no-error`. When it has, an error for
 *   that field from our own validation is dropped rather than displayed — otherwise a
 *   card the payment provider has accepted would still show as invalid.
 *
 * Extracted verbatim from `ui-service.ts`. It needs five things from the service
 * ({@link FieldErrorDisplayContext}) and calls none of its methods.
 */

import type { Logger } from '@/core/logger';

import type { ErrorDisplayManager } from '../../utils/error-display-utils';

/** What this module needs from `UIService`. */
export interface FieldErrorDisplayContext {
  /** The checkout form. Cleared wholesale before errors are re-applied. */
  form: HTMLFormElement;
  /** Field name → element, for the shipping/contact fields. */
  fields: Map<string, HTMLElement>;
  /** Field name → element for the cloned billing section, when there is one. */
  billingFields?: Map<string, HTMLElement>;
  /** Writes and clears the error label, classes, and icons around a field. */
  errors: ErrorDisplayManager;
  logger: Logger;
}

/**
 * Shows one message per named field, replacing whatever was shown before.
 *
 * @param errors Field name → message. Pass `{}` to clear the form.
 * @param scrollToField Field to scroll to and focus once the errors are on screen. Omit
 * to leave the viewport where it is.
 *
 * @example
 * ```ts
 * displayErrors(ctx, { email: 'Enter a valid email address' }, 'email');
 * ```
 */
export function displayErrors(
  ctx: FieldErrorDisplayContext,
  errors: Record<string, string>,
  scrollToField?: string
): void {
  // Clear all existing errors first
  ctx.errors.clearAllErrors(ctx.form);

  // Filter out Spreedly fields that are already marked as valid
  const filteredErrors: Record<string, string> = {};

  Object.entries(errors).forEach(([field, message]) => {
    // Skip Spreedly fields that are already marked as valid
    if (field === 'cc-number' || field === 'cvv') {
      const spreedlyField =
        field === 'cc-number' ? 'spreedly-number' : 'spreedly-cvv';
      const spreedlyElement = document.getElementById(spreedlyField);
      if (spreedlyElement && spreedlyElement.classList.contains('no-error')) {
        // Field is valid, skip displaying error
        return;
      }
    }
    filteredErrors[field] = message;
  });

  // Display errors for each field
  Object.entries(filteredErrors).forEach(([fieldName, message]) => {
    // Check regular fields first
    let fieldElement = ctx.fields.get(fieldName);

    // If not found in regular fields and it's a billing field, check billing fields
    if (
      !fieldElement &&
      fieldName.startsWith('billing-') &&
      ctx.billingFields
    ) {
      fieldElement = ctx.billingFields.get(fieldName);
    }

    if (fieldElement) {
      ctx.errors.showFieldError(fieldElement, message);
    } else {
      ctx.logger.warn(`Field element not found for error: ${fieldName}`);
    }
  });

  // Scroll to the first error field if specified
  if (scrollToField) {
    focusFirstError(ctx, scrollToField);
  }
}

/**
 * Scrolls the named field into view and focuses it, with a brief outline.
 *
 * Scrolls to the field's `.frm-flds` wrapper when it has one, so the label and the message
 * come into view with the input rather than the input alone. The focus is delayed past the
 * smooth scroll because focusing mid-scroll cancels it.
 */
export function focusFirstError(
  ctx: FieldErrorDisplayContext,
  fieldName: string
): void {
  // Check regular fields first
  let fieldElement = ctx.fields.get(fieldName);

  // If not found in regular fields and it's a billing field, check billing fields
  if (!fieldElement && fieldName.startsWith('billing-') && ctx.billingFields) {
    fieldElement = ctx.billingFields.get(fieldName);
  }

  if (!fieldElement) {
    ctx.logger.warn(`Field '${fieldName}' not found for scrolling`);
    return;
  }

  // Find the container to scroll to (prefer .frm-flds parent for better visual context)
  const scrollTarget = fieldElement.closest('.frm-flds') || fieldElement;

  // Calculate offset to account for fixed headers or other UI elements
  const offset = 100; // Adjust this value based on your page layout
  const elementRect = scrollTarget.getBoundingClientRect();
  const absoluteElementTop = elementRect.top + window.scrollY;
  const scrollPosition = absoluteElementTop - offset;

  // Smooth scroll to the field
  window.scrollTo({
    top: Math.max(0, scrollPosition),
    behavior: 'smooth',
  });

  // Focus the field after a small delay to ensure scrolling completes
  // Only focus if the field is an input/select/textarea
  if (
    fieldElement instanceof HTMLInputElement ||
    fieldElement instanceof HTMLSelectElement ||
    fieldElement instanceof HTMLTextAreaElement
  ) {
    setTimeout(() => {
      try {
        fieldElement.focus();
        // Add a subtle highlight effect
        fieldElement.style.outline = '2px solid #ff6b6b';
        fieldElement.style.outlineOffset = '2px';

        // Remove the highlight after a short time
        setTimeout(() => {
          fieldElement.style.outline = '';
          fieldElement.style.outlineOffset = '';
        }, 2000);
      } catch (error) {
        // Focus might fail in some cases, just log it
        ctx.logger.debug('Could not focus field after scroll:', error);
      }
    }, 300);
  }

  ctx.logger.debug(`Scrolled to field: ${fieldName}`);
}

/**
 * Marks one field valid, invalid, or undecided, without touching its message.
 *
 * The three classes are mutually exclusive, so this always clears all three before adding
 * one.
 */
export function updateFieldState(
  ctx: FieldErrorDisplayContext,
  fieldName: string,
  state: 'valid' | 'invalid' | 'neutral'
): void {
  let fieldElement = ctx.fields.get(fieldName);

  if (!fieldElement && fieldName.startsWith('billing-') && ctx.billingFields) {
    fieldElement = ctx.billingFields.get(fieldName);
  }

  if (!fieldElement) {
    ctx.logger.warn(`Field '${fieldName}' not found for state update`);
    return;
  }

  // Remove existing state classes
  fieldElement.classList.remove(
    'next-error-field',
    'next-valid-field',
    'next-neutral-field'
  );

  // Add appropriate state class
  switch (state) {
    case 'valid':
      fieldElement.classList.add('next-valid-field');
      break;
    case 'invalid':
      fieldElement.classList.add('next-error-field');
      break;
    case 'neutral':
      fieldElement.classList.add('next-neutral-field');
      break;
  }

  ctx.logger.debug(`Updated field ${fieldName} state to: ${state}`);
}

/**
 * Points each field at its error message for screen readers.
 *
 * Sets `aria-describedby` to the message element so it is read out with the field, and
 * `aria-invalid` so the field announces itself as wrong. Fields with no message get
 * `aria-invalid="false"` and the description removed, which is what makes a corrected
 * field stop announcing an error that is no longer on screen.
 *
 * Reads the same error labels {@link displayErrors} writes, which is why it lives beside
 * it — call it after errors change, not once at startup.
 */
export function enhanceAccessibility(ctx: FieldErrorDisplayContext): void {
  // Add ARIA labels and descriptions
  ctx.fields.forEach((field, fieldName) => {
    if (
      field instanceof HTMLInputElement ||
      field instanceof HTMLSelectElement
    ) {
      // Add aria-describedby for error messages
      const errorElement =
        field.parentElement?.querySelector('.next-error-label');
      if (errorElement) {
        const errorId = `${fieldName}-error`;
        errorElement.id = errorId;
        field.setAttribute('aria-describedby', errorId);
        field.setAttribute('aria-invalid', 'true');
      } else {
        field.removeAttribute('aria-describedby');
        field.setAttribute('aria-invalid', 'false');
      }

      // Add aria-required for required fields
      const isRequired =
        field.hasAttribute('required') ||
        field.getAttribute('data-required') === 'true';
      if (isRequired) {
        field.setAttribute('aria-required', 'true');
      }
    }
  });

  ctx.logger.debug('Enhanced accessibility features');
}
