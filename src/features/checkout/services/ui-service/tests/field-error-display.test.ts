import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { Logger } from '@/core/logger';

import { ErrorDisplayManager } from '../../../utils/error-display-utils';
import {
  displayErrors,
  enhanceAccessibility,
  focusFirstError,
  updateFieldState,
  type FieldErrorDisplayContext,
} from '../field-error-display';

function createMockLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

/**
 * The markup the SDK actually styles: `.form-group` wraps `.form-input` wraps the input.
 * `ErrorDisplayManager` appends its message to the `.form-group`.
 */
function buildField(form: HTMLFormElement, name: string): HTMLInputElement {
  const group = document.createElement('div');
  group.className = 'form-group';
  const wrapper = document.createElement('div');
  wrapper.className = 'form-input';
  const input = document.createElement('input');
  input.setAttribute('data-next-checkout-field', name);
  wrapper.appendChild(input);
  group.appendChild(wrapper);
  form.appendChild(group);
  return input;
}

interface Harness {
  ctx: FieldErrorDisplayContext;
  logger: ReturnType<typeof createMockLogger>;
}

function createHarness(
  names: string[] = ['email'],
  billingNames: string[] = []
): Harness {
  const form = document.createElement('form');
  document.body.appendChild(form);

  const fields = new Map<string, HTMLElement>();
  names.forEach(name => fields.set(name, buildField(form, name)));

  const billingFields = new Map<string, HTMLElement>();
  billingNames.forEach(name => billingFields.set(name, buildField(form, name)));

  const logger = createMockLogger();
  return {
    logger,
    ctx: {
      form,
      fields,
      billingFields,
      errors: new ErrorDisplayManager(),
      logger: logger as unknown as Logger,
    },
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  vi.useRealTimers();
});

describe('displayErrors', () => {
  it('writes the message beside the field and marks the input wrong', () => {
    const { ctx } = createHarness(['email']);

    displayErrors(ctx, { email: 'Enter a valid email address' });

    const field = ctx.fields.get('email') as HTMLInputElement;
    expect(field.classList.contains('next-error-field')).toBe(true);
    expect(
      field.closest('.form-group')?.querySelector('.next-error-label')
        ?.textContent
    ).toBe('Enter a valid email address');
  });

  it('clears previous messages before showing the new set', () => {
    const { ctx } = createHarness(['email']);
    displayErrors(ctx, { email: 'First problem' });

    displayErrors(ctx, {});

    expect(ctx.form.querySelectorAll('.next-error-label')).toHaveLength(0);
    expect(
      (ctx.fields.get('email') as HTMLInputElement).classList.contains(
        'next-error-field'
      )
    ).toBe(false);
  });

  it('falls back to the billing map for a billing- prefixed name', () => {
    const { ctx } = createHarness(['email'], ['billing-postal']);

    displayErrors(ctx, { 'billing-postal': 'Enter a postcode' });

    const billing = ctx.billingFields?.get(
      'billing-postal'
    ) as HTMLInputElement;
    expect(billing.classList.contains('next-error-field')).toBe(true);
  });

  it('warns rather than throwing when the named field is not on the page', () => {
    const { ctx, logger } = createHarness(['email']);

    displayErrors(ctx, { nickname: 'Unknown field' });

    expect(logger.warn).toHaveBeenCalledWith(
      'Field element not found for error: nickname'
    );
  });

  it('drops a card error the payment iframe has already accepted', () => {
    const { ctx } = createHarness(['cc-number']);
    const spreedly = document.createElement('div');
    spreedly.id = 'spreedly-number';
    spreedly.classList.add('no-error');
    document.body.appendChild(spreedly);

    displayErrors(ctx, { 'cc-number': 'Enter a card number' });

    expect(
      (ctx.fields.get('cc-number') as HTMLInputElement).classList.contains(
        'next-error-field'
      )
    ).toBe(false);
  });

  it('shows a card error while the payment iframe still reports a problem', () => {
    const { ctx } = createHarness(['cc-number']);
    const spreedly = document.createElement('div');
    spreedly.id = 'spreedly-number';
    document.body.appendChild(spreedly);

    displayErrors(ctx, { 'cc-number': 'Enter a card number' });

    expect(
      (ctx.fields.get('cc-number') as HTMLInputElement).classList.contains(
        'next-error-field'
      )
    ).toBe(true);
  });
});

describe('focusFirstError', () => {
  it('scrolls the window and focuses the field once the scroll has run', () => {
    vi.useFakeTimers();
    const scrollTo = vi.fn();
    vi.stubGlobal('scrollTo', scrollTo);
    const { ctx } = createHarness(['email']);

    focusFirstError(ctx, 'email');
    expect(scrollTo).toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    const field = ctx.fields.get('email') as HTMLInputElement;
    expect(document.activeElement).toBe(field);
    // happy-dom reorders the shorthand, so assert the colour rather than the string.
    expect(field.style.outline).toContain('#ff6b6b');
    expect(field.style.outlineOffset).toBe('2px');

    vi.advanceTimersByTime(2000);
    expect(field.style.outline).toBe('');
    vi.unstubAllGlobals();
  });

  it('warns and gives up when the field is not on the page', () => {
    const { ctx, logger } = createHarness(['email']);

    focusFirstError(ctx, 'nickname');

    expect(logger.warn).toHaveBeenCalledWith(
      "Field 'nickname' not found for scrolling"
    );
  });
});

describe('updateFieldState', () => {
  it('swaps one state class for another', () => {
    const { ctx } = createHarness(['email']);

    updateFieldState(ctx, 'email', 'invalid');
    const field = ctx.fields.get('email') as HTMLInputElement;
    expect(field.classList.contains('next-error-field')).toBe(true);

    updateFieldState(ctx, 'email', 'valid');
    expect(field.classList.contains('next-error-field')).toBe(false);
    expect(field.classList.contains('next-valid-field')).toBe(true);
  });

  /**
   * **Defect, left as found.** `displayErrors` marks a failing field with four things —
   * `next-error-field` and `has-error` on the input, `addErrorIcon` on the wrapper, and
   * the message element — but `updateFieldState` only knows about the first. Marking a
   * corrected field `valid` therefore leaves the red icon and the old message under a
   * field the shopper has fixed.
   *
   * Not fixed here: the fix is to route this through `ErrorDisplayManager.showFieldValid`,
   * which also adds `no-error`, and that is a behaviour change rather than a file move.
   */
  it('leaves the error icon and message behind when marking a field valid (known defect)', () => {
    const { ctx } = createHarness(['email']);
    displayErrors(ctx, { email: 'Enter a valid email address' });

    updateFieldState(ctx, 'email', 'valid');

    const field = ctx.fields.get('email') as HTMLInputElement;
    expect(field.classList.contains('has-error')).toBe(true);
    expect(
      field.closest('.form-group')?.classList.contains('addErrorIcon')
    ).toBe(true);
    expect(
      field.closest('.form-group')?.querySelector('.next-error-label')
    ).not.toBeNull();
  });
});

describe('enhanceAccessibility', () => {
  it('marks a field with no message as valid to assistive tech', () => {
    const { ctx } = createHarness(['email']);

    enhanceAccessibility(ctx);

    const field = ctx.fields.get('email') as HTMLInputElement;
    expect(field.getAttribute('aria-invalid')).toBe('false');
    expect(field.hasAttribute('aria-describedby')).toBe(false);
  });

  it('marks a required field as required', () => {
    const { ctx } = createHarness(['email']);
    (ctx.fields.get('email') as HTMLInputElement).setAttribute(
      'data-required',
      'true'
    );

    enhanceAccessibility(ctx);

    expect(
      (ctx.fields.get('email') as HTMLInputElement).getAttribute(
        'aria-required'
      )
    ).toBe('true');
  });

  it('wires the message when it happens to sit in the field’s own parent', () => {
    const { ctx } = createHarness(['email']);
    const field = ctx.fields.get('email') as HTMLInputElement;
    const label = document.createElement('div');
    label.className = 'next-error-label';
    field.parentElement?.appendChild(label);

    enhanceAccessibility(ctx);

    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(field.getAttribute('aria-describedby')).toBe('email-error');
  });

  /**
   * **Defect, left as found.** The message is looked for in `field.parentElement` only,
   * but `ErrorDisplayManager` appends it to the enclosing `.form-group` — which in the
   * SDK's own markup is the field's *grand*parent, because an input sits inside
   * `.form-input`. So on a real checkout a screen reader is told the field is valid while
   * a message is visible next to it.
   *
   * Not fixed here: the search has to widen to `field.closest('.form-group')`, which
   * changes what this reports on every field, and that belongs in its own commit with the
   * a11y review it deserves. Nothing calls `enhanceAccessibility` today, which is why it
   * has gone unnoticed.
   */
  it('misses a message appended to the .form-group by ErrorDisplayManager (known defect)', () => {
    const { ctx } = createHarness(['email']);
    displayErrors(ctx, { email: 'Enter a valid email address' });

    enhanceAccessibility(ctx);

    const field = ctx.fields.get('email') as HTMLInputElement;
    expect(
      field.closest('.form-group')?.querySelector('.next-error-label')
    ).not.toBeNull();
    expect(field.getAttribute('aria-invalid')).toBe('false');
  });
});
