import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Logger } from '@/core/logger';

import { ErrorDisplayManager } from '../../utils/error-display-utils';
import {
  clearAllErrors,
  clearError,
  hideErrorOnly,
  setError,
  showError,
  type ErrorDisplayContext,
} from '../error-display';

function createMockLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

/** The markup the SDK styles: `.form-group` wraps `.form-input` wraps the input. */
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

function createHarness(names: string[] = ['email']) {
  names.forEach(buildField);
  const logger = createMockLogger();
  const errorManager = new ErrorDisplayManager();
  const ctx: ErrorDisplayContext = {
    errors: new Map<string, string>(),
    errorManager,
    logger: logger as unknown as Logger,
  };
  return { ctx, logger, errorManager };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('setError', () => {
  it('records the failure and puts the message on the page', () => {
    const { ctx, errorManager } = createHarness();
    const showFieldError = vi.spyOn(errorManager, 'showFieldError');

    setError(ctx, 'email', 'Please enter a valid email address');

    expect(ctx.errors.get('email')).toBe('Please enter a valid email address');
    expect(showFieldError).toHaveBeenCalledWith(
      expect.anything(),
      'Please enter a valid email address'
    );
  });
});

describe('clearError', () => {
  it('forgets the failure and removes the message', () => {
    const { ctx, errorManager } = createHarness();
    const clearFieldError = vi.spyOn(errorManager, 'clearFieldError');

    setError(ctx, 'email', 'nope');
    clearError(ctx, 'email');

    expect(ctx.errors.has('email')).toBe(false);
    expect(clearFieldError).toHaveBeenCalled();
  });

  /**
   * The whole reason `hideErrorOnly` exists rather than a "mark valid" call: after a
   * failed submit the form clears every field's error, and marking them all valid would
   * put a green tick on fields the shopper never filled in.
   */
  it('never marks the field valid — only the error goes away', () => {
    const { ctx } = createHarness();
    const field = document.querySelector(
      '[data-next-checkout-field="email"]'
    ) as HTMLElement;

    setError(ctx, 'email', 'nope');
    expect(field.classList.contains('has-error')).toBe(true);

    clearError(ctx, 'email');

    expect(field.classList.contains('has-error')).toBe(false);
    expect(field.classList.contains('no-error')).toBe(false); // the success class
  });
});

describe('clearAllErrors', () => {
  it('empties the map and clears every field the form declares', () => {
    const { ctx, errorManager } = createHarness(['email', 'fname', 'city']);
    const clearFieldError = vi.spyOn(errorManager, 'clearFieldError');

    setError(ctx, 'email', 'a');
    setError(ctx, 'fname', 'b');
    clearFieldError.mockClear();

    clearAllErrors(ctx);

    expect(ctx.errors.size).toBe(0);
    expect(clearFieldError).toHaveBeenCalledTimes(3);
  });

  it('clears the card fields through the payment service', () => {
    const { ctx } = createHarness();
    const clearCardErrors = vi.fn();
    ctx.creditCardService = { clearAllErrors: clearCardErrors } as any;

    clearAllErrors(ctx);

    expect(clearCardErrors).toHaveBeenCalled();
  });

  /**
   * DEFECT (left as found) — the map is cleared unconditionally, but the *display* is
   * cleared only for elements carrying `data-next-checkout-field` / `os-checkout-field`.
   * `setError` accepts any name and shows the message via `FieldFinder`, which also
   * matches `input[name=…]`, `#id`, `[data-field=…]`.
   *
   * What the shopper sees: on a form whose fields are wired by `name` or `id` rather than
   * the SDK attribute, a red message from the previous submit stays on screen after the
   * next one — and `isValid()` now says the form is clean, so the two disagree.
   */
  it('DEFECT: a message shown on a field without the SDK attribute is never cleared', () => {
    const { ctx } = createHarness([]);
    const group = document.createElement('div');
    group.className = 'form-group';
    const legacy = document.createElement('input');
    legacy.setAttribute('name', 'email');
    group.appendChild(legacy);
    document.body.appendChild(group);

    setError(ctx, 'email', 'Please enter a valid email address');
    expect(legacy.classList.contains('has-error')).toBe(true);

    clearAllErrors(ctx);

    expect(ctx.errors.size).toBe(0); // the validator now believes the form is clean
    expect(legacy.classList.contains('has-error')).toBe(true); // …but the message is still up
    expect(group.textContent).toContain('Please enter a valid email address');
  });
});

describe('showError', () => {
  it('logs the message it is about to show, for debugging a live form', () => {
    const { ctx, logger } = createHarness();

    showError(ctx, 'email', 'Please enter a valid email address');

    expect(logger.debug).toHaveBeenCalledWith(
      'Showing error for field email:',
      expect.objectContaining({ message: 'Please enter a valid email address' })
    );
  });

  it('warns rather than throwing when the field is not on the page', () => {
    const { ctx, logger } = createHarness([]);

    showError(ctx, 'vat-number', 'Required');

    expect(logger.warn).toHaveBeenCalledWith(
      'Field not found for error display: vat-number'
    );
  });

  it('does not record the failure — showing and recording are separate', () => {
    const { ctx } = createHarness();

    showError(ctx, 'email', 'nope');

    expect(ctx.errors.size).toBe(0);
  });
});

describe('hideErrorOnly', () => {
  it('is a no-op for a field that is not on the page', () => {
    const { ctx } = createHarness([]);
    expect(() => hideErrorOnly(ctx, 'missing')).not.toThrow();
  });
});
