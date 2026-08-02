/**
 * Remembering which fields are wrong, and putting that on the page.
 *
 * Two things happen together here: the validator keeps a map of field name → message so
 * it can answer "is the form clean?", and the same call writes the message next to the
 * field so the shopper can see it.
 *
 * **Clearing an error is not the same as marking a field correct.** Both `clearError` and
 * `clearAllErrors` go through `hideErrorOnly`, which removes the message without adding
 * the success tick — otherwise every field the shopper skipped would light up green after
 * a failed submit. Marking a field correct is `UIService`'s job, and only when the field
 * actually passed.
 *
 * Extracted verbatim from `CheckoutValidator`. It needs four things from the validator
 * ({@link ErrorDisplayContext}).
 */

import type { Logger } from '@/core/logger';

import type { CreditCardService } from '../services/credit-card-service';
import type { ErrorDisplayManager } from '../utils/error-display-utils';
import { FieldFinder } from '../utils/field-finder-utils';

/** What this module needs from `CheckoutValidator`. */
export interface ErrorDisplayContext {
  /** Field name → message, for every field currently failing. Mutated here. */
  errors: Map<string, string>;
  /** Writes and clears the message, classes, and icons around a field. */
  errorManager: ErrorDisplayManager;
  /** Set once the card fields exist, so their errors can be cleared with the rest. */
  creditCardService?: CreditCardService;
  logger: Logger;
}

/** Locates a field by either the `data-next-checkout-field` or legacy `os-checkout-field` name. */
function findFormField(fieldName: string): HTMLElement | null {
  return FieldFinder.findField(fieldName);
}

/**
 * Records a field as failing and shows the message beside it.
 *
 * @example
 * ```ts
 * setError(ctx, 'email', 'Please enter a valid email address');
 * ```
 */
export function setError(
  ctx: ErrorDisplayContext,
  fieldName: string,
  message: string
): void {
  ctx.errors.set(fieldName, message);
  showError(ctx, fieldName, message);
}

/**
 * Forgets a field's failure and removes its message — without marking it correct.
 *
 * @example
 * ```ts
 * clearError(ctx, 'email');
 * ```
 */
export function clearError(ctx: ErrorDisplayContext, fieldName: string): void {
  ctx.errors.delete(fieldName);
  // Only hide the error display, don't mark as valid
  hideErrorOnly(ctx, fieldName);
}

/**
 * Clears every message on the form, including the card fields.
 *
 * Called before a fresh submit so the shopper sees this attempt's problems, not the last
 * attempt's.
 *
 * @example
 * ```ts
 * clearAllErrors(ctx);
 * ```
 */
export function clearAllErrors(ctx: ErrorDisplayContext): void {
  ctx.errors.clear();

  const fields = document.querySelectorAll(
    '[data-next-checkout-field], [os-checkout-field]'
  );
  fields.forEach(field => {
    const fieldName =
      field.getAttribute('data-next-checkout-field') ||
      field.getAttribute('os-checkout-field');
    if (fieldName) {
      // Use hideErrorOnly to avoid marking fields as valid
      hideErrorOnly(ctx, fieldName);
    }
  });

  // Clear credit card errors
  if (ctx.creditCardService) {
    ctx.creditCardService.clearAllErrors();
  }
}

/**
 * Shows a message beside a field without recording it as a failure.
 *
 * Used when the verdict was reached somewhere else — the form re-displaying the errors a
 * submit returned, for instance.
 *
 * @example
 * ```ts
 * showError(ctx, 'postal', 'Please enter a valid ZIP code (e.g. 90210)');
 * ```
 */
export function showError(
  ctx: ErrorDisplayContext,
  fieldName: string,
  message: string
): void {
  const field = findFormField(fieldName);
  if (!field) {
    ctx.logger.warn(`Field not found for error display: ${fieldName}`);
    return;
  }

  ctx.logger.debug(`Showing error for field ${fieldName}:`, { field, message });
  ctx.errorManager.showFieldError(field, message);
}

/** Removes a field's message and nothing else — never adds the success styling. */
export function hideErrorOnly(
  ctx: ErrorDisplayContext,
  fieldName: string
): void {
  const field = findFormField(fieldName);
  if (!field) return;

  // Only clear the error display, never add success styling
  ctx.errorManager.clearFieldError(field);
}
