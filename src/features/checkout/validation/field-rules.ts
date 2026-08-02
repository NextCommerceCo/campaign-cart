/**
 * The per-field rule table, and running one rule against one value.
 *
 * This is the path used while the shopper is *typing* — one field at a time, as it is
 * blurred or changed. It is deliberately narrower than the submit-time check in
 * `form-validation.ts`: a shopper mid-form should not be told about fields they have not
 * reached yet.
 *
 * The table is built once per validator and never added to at runtime — there is no
 * public way to register a rule — so only the rule types that {@link createValidationRules}
 * produces can ever reach {@link applyRule}. See `tests/field-rules.test.ts` for which
 * branches that leaves unreachable.
 *
 * Extracted verbatim from `CheckoutValidator`. {@link applyRule} needs two things from the
 * validator ({@link FieldRuleContext}); {@link createValidationRules} needs nothing.
 */

import {
  isValidCity,
  isValidEmail,
  isValidName,
  isValidPhone,
} from './validation-patterns';
import type { ValidationRule } from './validation.types';

/** What {@link applyRule} needs from `CheckoutValidator`. */
export interface FieldRuleContext {
  /** Provides `validatePostalCode(value, countryCode, config)`. */
  countryService: any;
  /** `intl-tel-input` wrapper, when the form has one. Validates the live phone widget. */
  phoneInputManager?: any;
}

/**
 * Builds the field name → rules table used by per-field validation.
 *
 * Phone gets only a format rule: whether a phone is *required* is decided by the markup at
 * submit time, not here.
 *
 * @example
 * ```ts
 * const rules = createValidationRules();
 * rules.get('email'); // [{ type: 'required', … }, { type: 'email', … }]
 * ```
 */
export function createValidationRules(): Map<string, ValidationRule[]> {
  const rules = new Map<string, ValidationRule[]>();

  const requiredRule: ValidationRule = {
    type: 'required',
    message: 'This field is required',
  };
  const emailRule: ValidationRule = {
    type: 'email',
    message: 'Please enter a valid email address',
  };
  const phoneRule: ValidationRule = {
    type: 'phone',
    message: 'Please enter a valid phone number',
  };
  const nameRule: ValidationRule = {
    type: 'name',
    message: 'Name can only contain letters, spaces, hyphens, and apostrophes',
  };
  const cityRule: ValidationRule = {
    type: 'city',
    message: 'Please enter a valid city name',
  };

  rules.set('email', [requiredRule, emailRule]);
  rules.set('fname', [requiredRule, nameRule]);
  rules.set('lname', [requiredRule, nameRule]);
  rules.set('address1', [requiredRule]);
  rules.set('city', [requiredRule, cityRule]);
  rules.set('postal', [requiredRule]);
  rules.set('country', [requiredRule]);
  rules.set('phone', [phoneRule]); // Phone validation rules (required is conditional)

  return rules;
}

/**
 * Runs one rule against one value and returns whether it passed.
 *
 * Every rule except `required` treats an empty value as passing, so "this field is empty"
 * is reported once by the `required` rule instead of once per rule.
 *
 * @param ctx What the rule may reach for — see {@link FieldRuleContext}.
 * @param rule The rule to run.
 * @param value The value the shopper entered.
 * @param context Extra data for the country-aware rules: `{ country, countryConfigs }`.
 *
 * @example
 * ```ts
 * applyRule(ctx, { type: 'email' }, 'shopper@example.com'); // true
 * ```
 */
export function applyRule(
  ctx: FieldRuleContext,
  rule: ValidationRule,
  value: any,
  context?: any
): boolean {
  switch (rule.type) {
    case 'required':
      return (
        value !== null && value !== undefined && value.toString().trim() !== ''
      );

    case 'email':
      return !value || isValidEmail(value);

    case 'phone':
      if (!value) return true;

      if (ctx.phoneInputManager) {
        return ctx.phoneInputManager.validatePhoneNumber(true);
      } else {
        return isValidPhone(value);
      }

    case 'name':
      return !value || isValidName(value);

    case 'city':
      return !value || isValidCity(value);

    case 'postal': {
      if (!value || !context?.country) return true;
      const countryConfig = context.countryConfigs?.get(context.country);
      return (
        !countryConfig ||
        ctx.countryService.validatePostalCode(
          value,
          context.country,
          countryConfig
        )
      );
    }

    case 'custom':
      return rule.validator ? rule.validator(value, context) : true;

    default:
      return true;
  }
}
