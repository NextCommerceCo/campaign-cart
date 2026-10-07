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

import type { CountryConfig } from '@/core/i18n-rules';

import { isValidPhone, type PhoneNumberSource } from './phone-validation';
import { isValidEmail, passesServedPattern } from './validation-patterns';
import type { ValidationRule } from './validation.types';

/** An address's country, and that country's rules: its postcode, and any served patterns. */
export interface AddressCountry {
  country: string;
  config: CountryConfig;
}

/** What {@link applyRule} needs from `CheckoutValidator`. */
export interface FieldRuleContext {
  /** Provides `validatePostalCode(value, countryCode, config)`. */
  i18nRules: any;
  /**
   * The live phone field for an address, when the form has one.
   *
   * The same resolver the submit-time check uses, so a number rejected as the shopper
   * tabs out of the field is rejected on submit too, and for the same reason. Before this
   * existed, per-field validation had no way to reach the widget and fell back to a digit
   * count, which is how a number the form accepted on blur could be refused on submit.
   */
  phoneSource?: (type: 'shipping' | 'billing') => PhoneNumberSource | undefined;
  /**
   * The country and rules an address is checked against: the pair the submit-time check
   * reads, so blur cannot tick a postcode, or a value a served pattern refuses, that submit
   * refuses. `undefined` while that country's rules have not loaded, and both then pass.
   */
  addressCountry?: (type: 'shipping' | 'billing') => AddressCountry | undefined;
  /**
   * The field being validated, so the phone rule asks the widget bound to *that* field.
   * Without it the rule can only guess, and guessing meant a billing number judged against
   * the shipping widget.
   */
  fieldName?: string;
}

/** Which address a field belongs to. Every billing field is named `billing-*`. */
export function addressTypeOf(fieldName?: string): 'shipping' | 'billing' {
  return fieldName?.startsWith('billing') ? 'billing' : 'shipping';
}

/**
 * Builds the field name → rules table used by per-field validation.
 *
 * Phone gets only a format rule: whether a phone is *required* is decided by the markup at
 * submit time, not here. A name, a street line and a city are checked only against a
 * pattern the address-rules service sends for them, and it sends none today: the orders
 * API takes any characters in them.
 *
 * A billing field gets its shipping twin's rules, so blur cannot tick a billing value
 * the submit check refuses. A field with no rules is pronounced valid, whatever it holds.
 *
 * @example
 * ```ts
 * const rules = createValidationRules();
 * rules.get('email'); // [{ type: 'required', … }, { type: 'email', … }]
 * ```
 */
export function createValidationRules(): Map<string, ValidationRule[]> {
  const rules = new Map<string, ValidationRule[]>();

  const requiredRule: ValidationRule = { type: 'required' };
  const emailRule: ValidationRule = { type: 'email' };
  const phoneRule: ValidationRule = { type: 'phone' };
  const postalRule: ValidationRule = { type: 'postal' };
  const patternRule: ValidationRule = { type: 'pattern' };

  rules.set('email', [requiredRule, emailRule]);
  rules.set('fname', [requiredRule, patternRule]);
  rules.set('lname', [requiredRule, patternRule]);
  rules.set('address1', [requiredRule, patternRule]);
  rules.set('address2', [patternRule]);
  rules.set('city', [requiredRule, patternRule]);
  rules.set('postal', [requiredRule, postalRule]);
  rules.set('country', [requiredRule]);
  rules.set('phone', [phoneRule]); // Phone validation rules (required is conditional)

  for (const [name, fieldRules] of [...rules]) {
    if (name !== 'email') rules.set(`billing-${name}`, fieldRules);
  }

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
 * @param context Handed to a `custom` rule's validator.
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
      return isValidPhone(
        value,
        ctx.phoneSource?.(addressTypeOf(ctx.fieldName))
      );

    case 'pattern':
      return (
        !value ||
        passesServedPattern(
          value,
          ctx.addressCountry?.(addressTypeOf(ctx.fieldName))?.config
            .fieldPatterns?.[(ctx.fieldName ?? '').replace(/^billing-/, '')]
        )
      );

    case 'postal': {
      if (!value) return true;
      const postcode = ctx.addressCountry?.(addressTypeOf(ctx.fieldName));
      return (
        !postcode ||
        ctx.i18nRules.validatePostalCode(
          value,
          postcode.country,
          postcode.config
        )
      );
    }

    case 'custom':
      return rule.validator ? rule.validator(value, context) : true;

    default:
      return true;
  }
}
