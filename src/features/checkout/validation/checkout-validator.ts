/**
 * The checkout form's validator: what counts as a usable address, email, phone, and card.
 *
 * This class is the **orchestrator**. It owns the mutable pieces — the rule table, the map
 * of fields currently failing, and the services the form hands it after startup — and
 * delegates each job to a sibling module that takes an explicit context object. The
 * modules do not reach back into the class, so each one can be read and tested on its own.
 *
 * | Module | What it decides |
 * |---|---|
 * | `validation-patterns.ts` | whether one value looks like an email / phone / name / city |
 * | `field-labels.ts` | what a field is called in a message |
 * | `field-rules.ts` | the per-field rules used while the shopper types |
 * | `form-validation.ts` | the full submit-time verdict |
 * | `step-validation.ts` | the verdict for one step of a multi-step checkout |
 * | `billing-address-validation.ts` | the separate billing address |
 * | `error-display.ts` | remembering failures and showing them on the page |
 * | `first-error-field.ts` | which problem to scroll the shopper to |
 *
 * The import path is unchanged from when this was one file — `../validation/checkout-validator`
 * still resolves here, so the split is invisible to callers.
 */

import type { CountryConfig } from '@/core/country-service';
import type { Logger } from '@/core/logger';

import type { CreditCardService } from '../services/credit-card-service';
import { ErrorDisplayManager } from '../utils/error-display-utils';

import {
  clearAllErrors,
  clearError,
  setError,
  showError,
  type ErrorDisplayContext,
} from './error-display';
import { applyRule, createValidationRules } from './field-rules';
import { formatFieldName } from './field-labels';
import { focusFirstErrorField } from './first-error-field';
import { validateForm, type FormValidationContext } from './form-validation';
import { checkPhone, type PhoneNumberSource } from './phone-validation';
import { validateStep } from './step-validation';
import { isValidCity, isValidEmail, isValidName } from './validation-patterns';
import type {
  FormValidationResult,
  ValidationResult,
  ValidationRule,
} from './validation.types';

export { VALIDATION_PATTERNS } from './validation-patterns';
export type {
  FormValidationResult,
  ValidationResult,
  ValidationRule,
} from './validation.types';

export class CheckoutValidator {
  private logger: Logger;
  private countryService: any;
  private errorManager: ErrorDisplayManager;
  private creditCardService?: CreditCardService;
  private phoneSource?: (
    type: 'shipping' | 'billing'
  ) => PhoneNumberSource | undefined;

  // Validation rules for form fields
  private rules: Map<string, ValidationRule[]> = new Map();

  // Error storage
  private errors: Map<string, string> = new Map();

  constructor(logger: Logger, countryService: any) {
    this.logger = logger;
    this.countryService = countryService;
    this.errorManager = new ErrorDisplayManager();
    this.rules = createValidationRules();
  }

  /**
   * Set credit card service for payment validation
   */
  public setCreditCardService(creditCardService: CreditCardService): void {
    this.creditCardService = creditCardService;
  }

  /**
   * Installs the lookup that hands phone checks the live `intl-tel-input` instance.
   *
   * Called by the form once the phone widgets exist. One installer for every phone check
   * in this class — per-field, per-step and submit-time all resolve the instance the same
   * way, which is what stops them disagreeing about the same number.
   *
   * @example
   * ```ts
   * validator.setPhoneSource(type => this.phoneInputs.get(type));
   * ```
   */
  public setPhoneSource(
    resolve: (type: 'shipping' | 'billing') => PhoneNumberSource | undefined
  ): void {
    this.phoneSource = resolve;
  }

  // ============================================================================
  // CONTEXTS HANDED TO THE MODULES
  // ============================================================================

  /**
   * The four things form and step validation may reach for. Rebuilt per call because
   * `creditCardService` and `phoneSource` are installed after construction.
   */
  private formContext(): FormValidationContext {
    return {
      countryService: this.countryService,
      ...(this.phoneSource !== undefined && {
        phoneSource: this.phoneSource,
      }),
      ...(this.creditCardService !== undefined && {
        creditCardService: this.creditCardService,
      }),
    };
  }

  /** The four things the error display may reach for. `errors` is shared, not copied. */
  private errorContext(): ErrorDisplayContext {
    return {
      errors: this.errors,
      errorManager: this.errorManager,
      ...(this.creditCardService !== undefined && {
        creditCardService: this.creditCardService,
      }),
      logger: this.logger,
    };
  }

  // ============================================================================
  // CORE VALIDATION METHODS
  // ============================================================================

  /**
   * Validate a single field based on its rules
   */
  public validateField(
    name: string,
    value: any,
    context?: any
  ): ValidationResult {
    const rules = this.rules.get(name) || [];
    let isValid = true;
    let message: string | undefined;

    const ruleContext = {
      countryService: this.countryService,
      ...(this.phoneSource !== undefined && {
        phoneSource: this.phoneSource,
      }),
    };

    for (const rule of rules) {
      if (!applyRule(ruleContext, rule, value, context)) {
        message =
          rule.message || `${formatFieldName(name, context)} is invalid`;
        this.setError(name, message);
        isValid = false;
        break;
      }
    }

    if (isValid) {
      this.clearError(name);
    }

    const result: ValidationResult = { isValid };
    if (message !== undefined) {
      result.message = message;
    }
    return result;
  }

  /**
   * Validate only fields required for a specific checkout step.
   *
   * `billingAddress` and `sameAsShipping` are used by step 3 only — it is the last gate
   * before payment, so it runs the full form check. Pass the same pair the submit path
   * passes to {@link CheckoutValidator.validateForm}, or the two paths will disagree about
   * whether the billing address needs checking.
   */
  public async validateStep(
    step: number,
    formData: Record<string, any>,
    countryConfigs: Map<string, CountryConfig>,
    currentCountryConfig?: CountryConfig,
    billingAddress?: any,
    sameAsShipping: boolean = true
  ): Promise<FormValidationResult> {
    return validateStep(
      this.formContext(),
      step,
      formData,
      countryConfigs,
      currentCountryConfig,
      billingAddress,
      sameAsShipping
    );
  }

  /**
   * Validate entire form including billing address if needed
   */
  public async validateForm(
    formData: Record<string, any>,
    countryConfigs: Map<string, CountryConfig>,
    currentCountryConfig?: CountryConfig,
    includePayment: boolean = false,
    billingAddress?: any,
    sameAsShipping: boolean = true
  ): Promise<FormValidationResult> {
    return validateForm(
      this.formContext(),
      formData,
      countryConfigs,
      currentCountryConfig,
      includePayment,
      billingAddress,
      sameAsShipping
    );
  }

  // ============================================================================
  // VALIDATION HELPERS
  // ============================================================================

  public isValidEmail(email: string): boolean {
    return isValidEmail(email);
  }

  /**
   * Whether a phone number can be used, asking the live widget when there is one.
   *
   * `unknown` counts as usable here — see `phone-validation.ts` for why nothing blocks a
   * shopper over a check that could not run.
   */
  public isValidPhone(phone: string): boolean {
    return (
      checkPhone(phone, this.phoneSource?.('shipping')).verdict !== 'invalid'
    );
  }

  public isValidName(name: string): boolean {
    return isValidName(name);
  }

  public isValidCity(city: string): boolean {
    return isValidCity(city);
  }

  // ============================================================================
  // ERROR MANAGEMENT
  // ============================================================================

  public setError(fieldName: string, message: string): void {
    setError(this.errorContext(), fieldName, message);
  }

  public clearError(fieldName: string): void {
    clearError(this.errorContext(), fieldName);
  }

  public clearAllErrors(): void {
    clearAllErrors(this.errorContext());
  }

  public showError(fieldName: string, message: string): void {
    showError(this.errorContext(), fieldName, message);
  }

  // ============================================================================
  // FOCUS MANAGEMENT
  // ============================================================================

  public focusFirstErrorField(firstErrorField?: string): void {
    focusFirstErrorField(firstErrorField);
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  public isValid(): boolean {
    return this.errors.size === 0;
  }

  public destroy(): void {
    this.clearAllErrors();
    this.logger.debug('CheckoutValidator destroyed');
  }
}
