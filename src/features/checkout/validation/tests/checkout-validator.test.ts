import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Logger } from '@/core/logger';

import { CheckoutValidator, VALIDATION_PATTERNS } from '../checkout-validator';

function createMockLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function buildField(name: string): HTMLInputElement {
  const group = document.createElement('div');
  group.className = 'form-group';
  const wrapper = document.createElement('div');
  wrapper.className = 'form-input';
  const input = document.createElement('input');
  input.setAttribute('data-next-checkout-field', name);
  wrapper.appendChild(input);
  group.appendChild(wrapper);
  document.body.appendChild(group);
  return input;
}

function createValidator(names: string[] = ['email']) {
  names.forEach(buildField);
  const logger = createMockLogger();
  const countryService = { validatePostalCode: vi.fn().mockReturnValue(true) };
  const validator = new CheckoutValidator(
    logger as unknown as Logger,
    countryService
  );
  return { validator, logger, countryService };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('CheckoutValidator — public surface', () => {
  /**
   * The split moved eight clusters into sibling modules. Everything the checkout form
   * calls has to still be here, spelled the same way, or the form breaks at runtime rather
   * than at compile time (it holds the validator as a field, not through an interface).
   */
  it('still exposes every method the checkout form calls', () => {
    const { validator } = createValidator();

    for (const method of [
      'setCreditCardService',
      'setPhoneValidator',
      'validateField',
      'validateStep',
      'validateForm',
      'isValidEmail',
      'isValidPhone',
      'isValidName',
      'isValidCity',
      'setError',
      'clearError',
      'clearAllErrors',
      'showError',
      'focusFirstErrorField',
      'isValid',
      'destroy',
    ]) {
      expect(typeof (validator as any)[method]).toBe('function');
    }
  });

  it('still re-exports the patterns from the same module path', () => {
    expect(VALIDATION_PATTERNS.EMAIL).toBeInstanceOf(RegExp);
  });
});

describe('validateField', () => {
  it('returns a verdict and puts the message on the field', () => {
    const { validator } = createValidator();

    const result = validator.validateField('email', 'not-an-email');

    expect(result).toEqual({
      isValid: false,
      message: 'Please enter a valid email address',
    });
    expect(validator.isValid()).toBe(false);
  });

  it('stops at the first failing rule, so an empty field says "required" not "invalid"', () => {
    const { validator } = createValidator();

    expect(validator.validateField('email', '')).toEqual({
      isValid: false,
      message: 'This field is required',
    });
  });

  it('clears the field once it passes', () => {
    const { validator } = createValidator();

    validator.validateField('email', 'not-an-email');
    const result = validator.validateField('email', 'ada@example.com');

    expect(result).toEqual({ isValid: true });
    expect(validator.isValid()).toBe(true);
  });

  /**
   * DEFECT (left as found) — a field with no entry in the rule table gets `[]` rules, so
   * the loop never runs and the verdict is valid. Nothing distinguishes "this value passed"
   * from "nobody has a rule for this field".
   *
   * What the shopper sees: `address2`, `province`, and every `billing-*` field report as
   * correct on blur no matter what is typed, including the billing fields the submit-time
   * check will later reject. The form contradicts itself between blur and pay.
   */
  it('DEFECT: an unruled field is pronounced valid rather than unchecked', () => {
    const { validator } = createValidator(['billing-fname', 'province']);

    expect(validator.validateField('billing-fname', '!!!')).toEqual({
      isValid: true,
    });
    expect(validator.validateField('province', '')).toEqual({ isValid: true });
  });
});

describe('error bookkeeping', () => {
  it('isValid tracks the recorded failures, not the page', () => {
    const { validator } = createValidator(['email', 'fname']);

    expect(validator.isValid()).toBe(true);
    validator.setError('email', 'nope');
    expect(validator.isValid()).toBe(false);
    validator.clearError('email');
    expect(validator.isValid()).toBe(true);
  });

  it('clearAllErrors empties the record in one call', () => {
    const { validator } = createValidator(['email', 'fname']);

    validator.setError('email', 'a');
    validator.setError('fname', 'b');
    validator.clearAllErrors();

    expect(validator.isValid()).toBe(true);
  });

  it('destroy clears the form and says so, for a teardown trace', () => {
    const { validator, logger } = createValidator();

    validator.setError('email', 'nope');
    validator.destroy();

    expect(validator.isValid()).toBe(true);
    expect(logger.debug).toHaveBeenCalledWith('CheckoutValidator destroyed');
  });
});

describe('services installed after construction', () => {
  /**
   * `setCreditCardService` and `setPhoneValidator` are called minutes after the constructor
   * — the card service only once a Spreedly key arrives. The contexts handed to the modules
   * are therefore built per call, not once; this pins that, because caching them would
   * silently drop card validation on every form whose key arrives late.
   */
  it('picks up a card service installed after construction', async () => {
    const { validator } = createValidator();
    const validateCreditCard = vi
      .fn()
      .mockReturnValue({
        isValid: false,
        errors: { 'cc-month': 'Expiration month is required' },
      });

    validator.setCreditCardService({
      checkSpreedlyFieldsReady: () => ({ hasEmptyFields: false, errors: [] }),
      validateCreditCard,
    } as any);

    const result = await validator.validateForm(
      {
        fname: 'Ada',
        lname: 'Lovelace',
        email: 'ada@example.com',
        address1: '1 Main St',
        city: 'Springfield',
        postal: '90210',
        country: 'US',
      },
      new Map(),
      undefined,
      true
    );

    expect(validateCreditCard).toHaveBeenCalled();
    expect(result.errors['cc-month']).toBe('Expiration month is required');
  });

  it('picks up a phone validator installed after construction', async () => {
    const { validator } = createValidator();
    const phoneValidator = vi.fn().mockReturnValue(false);
    validator.setPhoneValidator(phoneValidator);

    const result = await validator.validateForm(
      {
        fname: 'Ada',
        lname: 'Lovelace',
        email: 'ada@example.com',
        address1: '1 Main St',
        city: 'Springfield',
        postal: '90210',
        country: 'US',
        phone: '+15551234567',
      },
      new Map()
    );

    expect(phoneValidator).toHaveBeenCalledWith('+15551234567', 'shipping');
    expect(result.errors.phone).toBe('Please enter a valid phone number');
  });
});
