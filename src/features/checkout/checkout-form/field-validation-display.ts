/**
 * What a checkout field *looks* like as the shopper interacts with it — the error and
 * success states, not the validation rules themselves.
 *
 * Three interactions, three deliberately different behaviours, and the differences are the
 * whole point:
 *
 * - **blur** — the shopper has left the field. Validate and commit to a verdict: tick or
 *   error. But an *empty* field gets no error, because demanding a value the moment
 *   someone tabs past is hostile; required-but-empty is reported on submit instead.
 * - **input** — the shopper is typing. Only ever *clears* an error. Nothing is validated
 *   and no tick appears, so the form never argues with someone mid-word.
 * - **change** — a value arrived without typing (Google Places, browser autofill, a
 *   `<select>`). Validate, and clear the error **and the store error** if it now passes.
 *
 * Extracted from `checkout-form.enhancer.ts`. It was the bottom half of
 * `handleFieldChange`, whose top half routes values into the store — two independent jobs
 * that happened to share an entry point. This half needs only two things from the form
 * ({@link FieldValidationContext}) even though the method as a whole touched nine.
 */

import type { CheckoutValidator } from '../validation/checkout-validator';
import { useCheckoutStore } from '@/state/checkout';

/** Wrappers the SDK styles around a field. Either may carry the error label. */
const FIELD_WRAPPER = '.form-group, .form-input';
const FORM_GROUP = '.form-group';
/** The element the validator inserts to show a message. */
const ERROR_LABEL = '.next-error-label';

/** What this module needs from the checkout form. */
export interface FieldValidationContext {
  /** Runs the rules and owns showing a message. */
  validator: CheckoutValidator;
  /** Resolves a field name to its element, across both attribute conventions. */
  getFieldByName: (fieldName: string) => HTMLElement | null;
}

/**
 * Removes every error label reachable from a field.
 *
 * Looks in three places rather than one because the label's position depends on the
 * author's markup: inside the immediate wrapper, inside a `.form-group` that wraps a
 * `.form-input`, or inside a `.form-group` ancestor of the field itself. Missing one leaves
 * a stale error visible under a field the shopper has already corrected.
 */
function clearErrorLabels(field: HTMLElement): void {
  const wrapper = field.closest(FIELD_WRAPPER);
  wrapper?.querySelector(ERROR_LABEL)?.remove();
  wrapper?.closest(FORM_GROUP)?.querySelector(ERROR_LABEL)?.remove();
  field.closest(FORM_GROUP)?.querySelector(ERROR_LABEL)?.remove();
}

/**
 * Marks the field and its wrapper as valid: tick on, error off, message gone.
 *
 * Uses {@link clearErrorLabels} rather than only clearing the immediate wrapper. The
 * original code cleared the label in **one** place here but in **three** on `input`, so a
 * field whose error message sat in a `.form-group` ancestor kept showing it after the value
 * became valid — the exact "stale error under a corrected field" that `input` was written
 * carefully to avoid. That asymmetry predates the extraction; the two paths now agree.
 */
function markValid(field: HTMLElement): void {
  field.classList.remove('has-error', 'next-error-field');
  field.classList.add('no-error');

  const wrapper = field.closest(FIELD_WRAPPER);
  if (wrapper) {
    wrapper.classList.remove('addErrorIcon');
    wrapper.classList.add('addTick');
  }

  clearErrorLabels(field);
}

/** True when the field holds nothing a validator could judge. */
function isEmptyValue(value: string): boolean {
  return !value || value.trim() === '';
}

/**
 * The shopper left the field: commit to a verdict.
 *
 * An empty field is left **neutral** rather than errored — unless an error label is already
 * showing, in which case the field's classes are re-applied to stay consistent with it.
 * Without that, clearing a field that had failed validation would strip the field's red
 * outline while leaving the message underneath it, which reads as a rendering bug.
 */
function handleBlur(
  ctx: FieldValidationContext,
  fieldName: string,
  value: string
): void {
  const field = ctx.getFieldByName(fieldName);
  if (!field) return;

  const wrapper = field.closest(FIELD_WRAPPER);

  if (isEmptyValue(value)) {
    const formGroup = field.closest(FORM_GROUP);
    const errorLabel =
      wrapper?.querySelector(ERROR_LABEL) ??
      formGroup?.querySelector(ERROR_LABEL);

    if (errorLabel) {
      field.classList.add('has-error', 'next-error-field');
      field.classList.remove('no-error');
      wrapper?.classList.add('addErrorIcon');
      wrapper?.classList.remove('addTick');
    } else {
      // Neutral, not errored: required-but-empty is reported on submit, not on tab-out.
      field.classList.remove('has-error', 'next-error-field', 'no-error');
      wrapper?.classList.remove('addErrorIcon', 'addTick');
    }
    return;
  }

  const validationResult = ctx.validator.validateField(fieldName, value);
  if (validationResult.isValid) {
    markValid(field);
  } else if (validationResult.message) {
    field.classList.remove('no-error');
    ctx.validator.showError(fieldName, validationResult.message);
  }
}

/**
 * The shopper is typing: clear the error and say nothing else.
 *
 * Deliberately does **not** add the success state. A tick appearing halfway through a
 * postcode is noise, and validating mid-word would flag values that are merely incomplete.
 */
function handleInput(ctx: FieldValidationContext, fieldName: string): void {
  const field = ctx.getFieldByName(fieldName);
  if (!field) return;

  field.classList.remove('has-error', 'next-error-field');
  clearErrorLabels(field);
}

/**
 * A value arrived without typing — autocomplete, autofill, or a `<select>`.
 *
 * Validates like blur, but only ever *improves* the state: a value that now passes clears
 * the error here **and** in the store. A failing value is left alone, because the shopper
 * did not choose it by hand and interrupting them over a suggestion they may replace in the
 * next keystroke is worse than waiting for blur.
 */
function handleChange(
  ctx: FieldValidationContext,
  fieldName: string,
  value: string
): void {
  const field = ctx.getFieldByName(fieldName);
  if (!field || isEmptyValue(value)) return;

  const validationResult = ctx.validator.validateField(fieldName, value);
  if (!validationResult.isValid) return;

  markValid(field);
  // The store keeps its own error map, read by the submit path — clearing only the DOM
  // would leave a submit blocked by an error nothing is displaying.
  useCheckoutStore.getState().clearError(fieldName);
}

/**
 * Applies the error/success display for one field interaction.
 *
 * Anything other than `blur`, `input` or `change` is ignored.
 */
export function updateFieldValidationDisplay(
  ctx: FieldValidationContext,
  eventType: string,
  fieldName: string,
  value: string
): void {
  if (eventType === 'blur') {
    handleBlur(ctx, fieldName, value);
    return;
  }
  if (eventType === 'input') {
    handleInput(ctx, fieldName);
    return;
  }
  if (eventType === 'change') {
    handleChange(ctx, fieldName, value);
  }
}
