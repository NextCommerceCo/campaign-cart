/**
 * The shapes the checkout validator speaks in.
 *
 * A **rule** is one check attached to one field name. A **result** is the verdict on a
 * single field. A **form result** is the verdict on a whole submit, and carries every
 * message at once so the form can show them all rather than one at a time.
 *
 * These live here rather than in `checkout-validator.ts` so the modules that make the
 * verdicts can import them without importing the validator itself. They are re-exported
 * from `checkout-validator.ts`, so existing imports keep working.
 */

/**
 * One check on one field.
 *
 * @example
 * ```ts
 * const emailRule: ValidationRule = {
 *   type: 'email',
 *   message: 'Please enter a valid email address',
 * };
 * ```
 */
export interface ValidationRule {
  /** Which built-in check to run. `custom` runs {@link ValidationRule.validator} instead. */
  type: 'required' | 'email' | 'phone' | 'postal' | 'name' | 'city' | 'custom';
  /** Shown to the shopper when the check fails. Falls back to `"<Field name> is invalid"`. */
  message?: string;
  /** Only read when `type` is `custom`. Return `true` for a value that passes. */
  validator?: (value: any, context?: any) => boolean;
}

/** The verdict on one field. `message` is present only when `isValid` is `false`. */
export interface ValidationResult {
  isValid: boolean;
  message?: string;
}

/**
 * The verdict on a whole form or step.
 *
 * @example
 * ```ts
 * // { isValid: false, firstErrorField: 'email', errors: { email: '…', postal: '…' } }
 * ```
 */
export interface FormValidationResult {
  isValid: boolean;
  /** Field the form should scroll to and focus — the topmost problem on screen. */
  firstErrorField?: string;
  /** Field name → message, for every field that failed. Empty when `isValid` is `true`. */
  errors: Record<string, string>;
}
