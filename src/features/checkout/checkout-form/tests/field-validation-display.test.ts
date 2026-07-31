import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  updateFieldValidationDisplay,
  type FieldValidationContext,
} from '../field-validation-display';
import type { CheckoutValidator } from '../../validation/checkout-validator';
import { useCheckoutStore } from '@/state/checkout';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * A fake `CheckoutValidator` — only `validateField` and `showError` are used
 * by this module, so those are the only two the fake needs to implement.
 * Spies are returned alongside the fake (not read back through
 * `ctx.validator.*`) so assertions don't reference an unbound class method —
 * mirrors `phone-input.test.ts`'s `makeLogger`.
 */
function createValidator(
  result: { isValid: boolean; message?: string } = { isValid: true }
): {
  validator: CheckoutValidator;
  validateFieldSpy: ReturnType<typeof vi.fn>;
  showErrorSpy: ReturnType<typeof vi.fn>;
} {
  const validateFieldSpy = vi.fn(() => result);
  const showErrorSpy = vi.fn();
  const validator = {
    validateField: validateFieldSpy,
    showError: showErrorSpy,
  } as unknown as CheckoutValidator;
  return { validator, validateFieldSpy, showErrorSpy };
}

function createCtx(
  field: HTMLElement | null,
  overrides: Partial<FieldValidationContext> = {}
): FieldValidationContext {
  return {
    validator: createValidator().validator,
    getFieldByName: () => field,
    ...overrides,
  };
}

/** Field wrapped directly in a `.form-group` — the simple wrapper case. */
function makeFieldInFormGroup(): {
  field: HTMLInputElement;
  wrapper: HTMLElement;
} {
  const wrapper = document.createElement('div');
  wrapper.className = 'form-group';
  const field = document.createElement('input');
  wrapper.appendChild(field);
  document.body.appendChild(wrapper);
  return { field, wrapper };
}

/** Field wrapped in `.form-input`, itself nested inside a `.form-group`. */
function makeFieldInFormInputInFormGroup(): {
  field: HTMLInputElement;
  formInput: HTMLElement;
  formGroup: HTMLElement;
} {
  const formGroup = document.createElement('div');
  formGroup.className = 'form-group';
  const formInput = document.createElement('div');
  formInput.className = 'form-input';
  const field = document.createElement('input');
  formInput.appendChild(field);
  formGroup.appendChild(formInput);
  document.body.appendChild(formGroup);
  return { field, formInput, formGroup };
}

function addErrorLabel(container: HTMLElement): HTMLElement {
  const label = document.createElement('span');
  label.className = 'next-error-label';
  label.textContent = 'This field is required';
  container.appendChild(label);
  return label;
}

// ─── blur ─────────────────────────────────────────────────────────────────────

describe('updateFieldValidationDisplay — blur', () => {
  it('leaves an empty field neutral when no error label is present', () => {
    const { field, wrapper } = makeFieldInFormGroup();
    field.classList.add('has-error', 'next-error-field', 'addErrorIcon');
    wrapper.classList.add('addErrorIcon');
    const { validator, validateFieldSpy } = createValidator();
    const ctx = createCtx(field, { validator });

    updateFieldValidationDisplay(ctx, 'blur', 'email', '');

    expect(field.classList.contains('has-error')).toBe(false);
    expect(field.classList.contains('next-error-field')).toBe(false);
    expect(field.classList.contains('no-error')).toBe(false);
    expect(wrapper.classList.contains('addErrorIcon')).toBe(false);
    expect(wrapper.classList.contains('addTick')).toBe(false);
    // Required-but-empty is not validated at all on blur.
    expect(validateFieldSpy).not.toHaveBeenCalled();
  });

  it('re-applies error classes on an empty field when an error label is already showing', () => {
    const { field, wrapper } = makeFieldInFormGroup();
    addErrorLabel(wrapper);
    const ctx = createCtx(field);

    updateFieldValidationDisplay(ctx, 'blur', 'email', '   '); // whitespace-only counts as empty

    expect(field.classList.contains('has-error')).toBe(true);
    expect(field.classList.contains('next-error-field')).toBe(true);
    expect(field.classList.contains('no-error')).toBe(false);
    expect(wrapper.classList.contains('addErrorIcon')).toBe(true);
    expect(wrapper.classList.contains('addTick')).toBe(false);
  });

  it('marks a valid non-empty field: tick on, error off, error label removed', () => {
    const { field, wrapper } = makeFieldInFormGroup();
    field.classList.add('has-error', 'next-error-field');
    wrapper.classList.add('addErrorIcon');
    addErrorLabel(wrapper);
    const { validator } = createValidator({ isValid: true });
    const ctx = createCtx(field, { validator });

    updateFieldValidationDisplay(ctx, 'blur', 'email', 'a@b.com');

    expect(field.classList.contains('has-error')).toBe(false);
    expect(field.classList.contains('next-error-field')).toBe(false);
    expect(field.classList.contains('no-error')).toBe(true);
    expect(wrapper.classList.contains('addErrorIcon')).toBe(false);
    expect(wrapper.classList.contains('addTick')).toBe(true);
    expect(wrapper.querySelector('.next-error-label')).toBeNull();
  });

  it('shows the validator error for an invalid non-empty field, and removes no-error', () => {
    const { field } = makeFieldInFormGroup();
    field.classList.add('no-error');
    const { validator, showErrorSpy } = createValidator({
      isValid: false,
      message: 'Invalid email',
    });
    const ctx = createCtx(field, { validator });

    updateFieldValidationDisplay(ctx, 'blur', 'email', 'not-an-email');

    expect(showErrorSpy).toHaveBeenCalledWith('email', 'Invalid email');
    expect(field.classList.contains('no-error')).toBe(false);
  });
});

// ─── input ────────────────────────────────────────────────────────────────────

describe('updateFieldValidationDisplay — input', () => {
  it('only clears error state: never validates, never adds no-error/tick', () => {
    const { field, wrapper } = makeFieldInFormGroup();
    field.classList.add('has-error', 'next-error-field');
    addErrorLabel(wrapper);
    const { validator, validateFieldSpy } = createValidator();
    const ctx = createCtx(field, { validator });

    updateFieldValidationDisplay(ctx, 'input', 'email', 'a');

    expect(field.classList.contains('has-error')).toBe(false);
    expect(field.classList.contains('next-error-field')).toBe(false);
    expect(field.classList.contains('no-error')).toBe(false);
    expect(wrapper.classList.contains('addTick')).toBe(false);
    expect(wrapper.querySelector('.next-error-label')).toBeNull();
    expect(validateFieldSpy).not.toHaveBeenCalled();
  });

  it('removes an error label sitting directly in the wrapper', () => {
    const { field, wrapper } = makeFieldInFormGroup();
    const label = addErrorLabel(wrapper);
    const ctx = createCtx(field);

    updateFieldValidationDisplay(ctx, 'input', 'email', 'a');

    expect(label.isConnected).toBe(false);
    expect(wrapper.querySelector('.next-error-label')).toBeNull();
  });

  it('removes an error label sitting in the .form-group that wraps a .form-input', () => {
    const { field, formGroup } = makeFieldInFormInputInFormGroup();
    const label = addErrorLabel(formGroup);
    const ctx = createCtx(field);

    updateFieldValidationDisplay(ctx, 'input', 'email', 'a');

    expect(label.isConnected).toBe(false);
    expect(formGroup.querySelector('.next-error-label')).toBeNull();
  });

  it('removes an error label sitting in a .form-group ancestor of the field itself', () => {
    // Field has no `.form-input`/`.form-group` immediate wrapper — only a
    // `.form-group` ancestor further up, exercising the third lookup path.
    const formGroup = document.createElement('div');
    formGroup.className = 'form-group';
    const plainDiv = document.createElement('div'); // not a wrapper class
    const field = document.createElement('input');
    plainDiv.appendChild(field);
    formGroup.appendChild(plainDiv);
    document.body.appendChild(formGroup);
    const label = addErrorLabel(formGroup);
    const ctx = createCtx(field);

    updateFieldValidationDisplay(ctx, 'input', 'email', 'a');

    expect(label.isConnected).toBe(false);
  });
});

// ─── change ───────────────────────────────────────────────────────────────────

describe('updateFieldValidationDisplay — change', () => {
  beforeEach(() => {
    useCheckoutStore.getState().reset();
  });

  afterEach(() => {
    useCheckoutStore.getState().reset();
  });

  it('marks the field valid and clears the store error when the value validates', () => {
    const { field, wrapper } = makeFieldInFormGroup();
    field.classList.add('has-error');
    useCheckoutStore.getState().setError('email', 'Invalid email');
    const { validator } = createValidator({ isValid: true });
    const ctx = createCtx(field, { validator });

    updateFieldValidationDisplay(ctx, 'change', 'email', 'a@b.com');

    expect(field.classList.contains('has-error')).toBe(false);
    expect(field.classList.contains('no-error')).toBe(true);
    expect(wrapper.classList.contains('addTick')).toBe(true);
    expect(useCheckoutStore.getState().errors['email']).toBeUndefined();
  });

  it('does nothing when the incoming value fails validation', () => {
    const { field, wrapper } = makeFieldInFormGroup();
    const { validator, showErrorSpy } = createValidator({
      isValid: false,
      message: 'Invalid email',
    });
    const ctx = createCtx(field, { validator });

    updateFieldValidationDisplay(ctx, 'change', 'email', 'not-an-email');

    expect(field.classList.contains('no-error')).toBe(false);
    expect(field.classList.contains('has-error')).toBe(false);
    expect(wrapper.classList.contains('addTick')).toBe(false);
    expect(showErrorSpy).not.toHaveBeenCalled();
  });

  it('does nothing for an empty value, and never calls the validator', () => {
    const { field } = makeFieldInFormGroup();
    const { validator, validateFieldSpy } = createValidator();
    const ctx = createCtx(field, { validator });

    updateFieldValidationDisplay(ctx, 'change', 'email', '');

    expect(validateFieldSpy).not.toHaveBeenCalled();
  });
});

// ─── misc ─────────────────────────────────────────────────────────────────────

describe('updateFieldValidationDisplay — misc', () => {
  it('ignores an unknown event type entirely', () => {
    const { field } = makeFieldInFormGroup();
    field.classList.add('has-error');
    const { validator, validateFieldSpy } = createValidator();
    const ctx = createCtx(field, { validator });

    updateFieldValidationDisplay(ctx, 'focus', 'email', 'a@b.com');

    expect(field.classList.contains('has-error')).toBe(true);
    expect(validateFieldSpy).not.toHaveBeenCalled();
  });

  it('does not throw when the field name resolves to no element', () => {
    const ctx = createCtx(null);

    expect(() =>
      updateFieldValidationDisplay(ctx, 'blur', 'missing-field', 'value')
    ).not.toThrow();
    expect(() =>
      updateFieldValidationDisplay(ctx, 'input', 'missing-field', 'value')
    ).not.toThrow();
    expect(() =>
      updateFieldValidationDisplay(ctx, 'change', 'missing-field', 'value')
    ).not.toThrow();
  });
});

// ─── Stale error labels on the valid paths ────────────────────────────────────
//
// `input` was always thorough about removing the error label from all three places it can
// live. `blur`-valid and `change`-valid cleared only the immediate wrapper, so a field
// whose message sat in a `.form-group` ancestor kept showing it after the value became
// valid. These pin the fix.

describe('valid paths clear the error label everywhere input does', () => {
  it('blur — removes a message living in a .form-group ancestor, not just the wrapper', () => {
    const formGroup = document.createElement('div');
    formGroup.className = 'form-group';
    const field = document.createElement('input');
    formGroup.appendChild(field);
    const label = document.createElement('span');
    label.className = 'next-error-label';
    label.textContent = 'Enter a valid email';
    formGroup.appendChild(label);
    document.body.appendChild(formGroup);

    const ctx = createCtx(field, {
      validator: createValidator({ isValid: true }).validator,
    });

    updateFieldValidationDisplay(ctx, 'blur', 'email', 'a@b.com');

    expect(formGroup.querySelector('.next-error-label')).toBeNull();
    expect(field.classList.contains('no-error')).toBe(true);
  });

  it('change — does the same, so an autofilled correction does not leave a message behind', () => {
    const formGroup = document.createElement('div');
    formGroup.className = 'form-group';
    const formInput = document.createElement('div');
    formInput.className = 'form-input';
    const field = document.createElement('input');
    formInput.appendChild(field);
    formGroup.appendChild(formInput);
    const label = document.createElement('span');
    label.className = 'next-error-label';
    formGroup.appendChild(label);
    document.body.appendChild(formGroup);

    const ctx = createCtx(field, {
      validator: createValidator({ isValid: true }).validator,
    });

    updateFieldValidationDisplay(ctx, 'change', 'email', 'a@b.com');

    expect(formGroup.querySelector('.next-error-label')).toBeNull();
  });
});
