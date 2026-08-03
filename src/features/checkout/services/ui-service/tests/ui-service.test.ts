import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { Logger } from '@/core/logger';
import type { CartState } from '@/types/global';

import { UIService } from '../index';

function createMockLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function fieldGroup(name: string): string {
  return `<div class="form-group"><label class="label-checkout">Label</label><div class="form-input"><input data-next-checkout-field="${name}"></div></div>`;
}

interface Harness {
  ui: UIService;
  form: HTMLFormElement;
  fields: Map<string, HTMLElement>;
  billingFields: Map<string, HTMLElement>;
  logger: ReturnType<typeof createMockLogger>;
}

function createHarness(html = fieldGroup('email')): Harness {
  const form = document.createElement('form');
  form.innerHTML = html;
  document.body.appendChild(form);

  const fields = new Map<string, HTMLElement>();
  form
    .querySelectorAll<HTMLElement>('[data-next-checkout-field]')
    .forEach(field =>
      fields.set(
        field.getAttribute('data-next-checkout-field') as string,
        field
      )
    );
  const billingFields = new Map<string, HTMLElement>();

  const logger = createMockLogger();
  return {
    form,
    fields,
    billingFields,
    logger,
    ui: new UIService(form, fields, logger as unknown as Logger, billingFields),
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  vi.useRealTimers();
});

describe('UIService construction', () => {
  it('takes the same four arguments it always has, with billing optional', () => {
    const form = document.createElement('form');
    expect(
      () =>
        new UIService(form, new Map(), createMockLogger() as unknown as Logger)
    ).not.toThrow();
    expect(UIService.length).toBe(4);
  });

  it('exposes the whole surface the checkout form calls', () => {
    const { ui } = createHarness();
    const surface = [
      'initialize',
      'showLoading',
      'hideLoading',
      'updateProgress',
      'displayErrors',
      'focusFirstError',
      'updateFieldState',
      'handleCheckoutUpdate',
      'handleCartUpdate',
      'initializePaymentForms',
      'updatePaymentFormVisibility',
      'handleSpreedlyFieldFocus',
      'handleSpreedlyFieldBlur',
      'handleSpreedlyFieldInput',
      'setupFloatingLabel',
      'updateLabelsForPopulatedData',
      'handleResponsiveUI',
      'enhanceAccessibility',
      'destroy',
    ];
    surface.forEach(method =>
      expect(typeof (ui as unknown as Record<string, unknown>)[method]).toBe(
        'function'
      )
    );
  });
});

describe('initialize', () => {
  it('wires the floating labels and says so', () => {
    const { ui, logger, fields } = createHarness();

    ui.initialize();

    expect(logger.debug).toHaveBeenCalledWith('UIService initialized');
    // A value present before initialize is picked up by the initial state check.
    const field = fields.get('email') as HTMLInputElement;
    field.value = 'a@b.com';
    ui.updateLabelsForPopulatedData();
    expect(
      field
        .closest('.form-group')
        ?.querySelector('.label-checkout')
        ?.classList.contains('has-value')
    ).toBe(true);

    ui.destroy();
  });
});

describe('handleCheckoutUpdate', () => {
  it('passes the store errors to the callback and marks the form busy', () => {
    const { ui, form } = createHarness();
    const display = vi.fn();

    ui.handleCheckoutUpdate(
      { errors: { email: 'Required' }, isProcessing: true },
      display
    );

    expect(display).toHaveBeenCalledWith({ email: 'Required' });
    expect(form.classList.contains('next-processing')).toBe(true);
  });

  it('clears the errors with an empty object when the store has none', () => {
    const { ui } = createHarness();
    const display = vi.fn();

    ui.handleCheckoutUpdate({ errors: {}, isProcessing: false }, display);

    expect(display).toHaveBeenCalledWith({});
  });

  it('does not re-render an unchanged error set', () => {
    const { ui } = createHarness();
    const display = vi.fn();
    const state = { errors: { email: 'Required' }, isProcessing: false };

    ui.handleCheckoutUpdate(state, display);
    ui.handleCheckoutUpdate({ ...state }, display);

    expect(display).toHaveBeenCalledTimes(1);
  });

  it('renders again once the error set really changes', () => {
    const { ui } = createHarness();
    const display = vi.fn();

    ui.handleCheckoutUpdate({ errors: { email: 'Required' } }, display);
    ui.handleCheckoutUpdate(
      { errors: { email: 'Not a valid address' } },
      display
    );

    expect(display).toHaveBeenCalledTimes(2);
  });

  it('clears the busy state when processing finishes', () => {
    const { ui, form } = createHarness();
    const display = vi.fn();

    ui.handleCheckoutUpdate({ errors: {}, isProcessing: true }, display);
    ui.handleCheckoutUpdate({ errors: {}, isProcessing: false }, display);

    expect(form.classList.contains('next-processing')).toBe(false);
  });
});

describe('handleCartUpdate', () => {
  it('warns when the cart has emptied under the checkout', () => {
    const { ui, logger } = createHarness();

    ui.handleCartUpdate({ isEmpty: true } as CartState);

    expect(logger.warn).toHaveBeenCalledWith(
      'Cart is empty, redirecting to cart page'
    );
  });

  it('says nothing while the cart still has items', () => {
    const { ui, logger } = createHarness();

    ui.handleCartUpdate({ isEmpty: false } as CartState);

    expect(logger.warn).not.toHaveBeenCalled();
  });
});

describe('destroy', () => {
  it('stops the autofill poll', () => {
    vi.useFakeTimers();
    const { ui, fields, logger } = createHarness();
    ui.initialize();

    ui.destroy();
    (fields.get('email') as HTMLInputElement).value = 'a@b.com';
    vi.advanceTimersByTime(2000);

    // The label is untouched because nothing is polling any more.
    expect(
      (fields.get('email') as HTMLInputElement)
        .closest('.form-group')
        ?.querySelector('.label-checkout')
        ?.classList.contains('has-value')
    ).toBe(false);
    expect(logger.debug).toHaveBeenCalledWith('UIService destroyed');
  });

  it('drops the field listeners it registered', () => {
    const { ui, fields } = createHarness();
    ui.initialize();
    ui.destroy();

    const field = fields.get('email') as HTMLInputElement;
    field.value = 'a@b.com';
    field.dispatchEvent(new Event('input'));

    expect(
      field
        .closest('.form-group')
        ?.querySelector('.label-checkout')
        ?.classList.contains('has-value')
    ).toBe(false);
  });

  it('can be called twice', () => {
    const { ui } = createHarness();
    ui.initialize();

    ui.destroy();
    expect(() => ui.destroy()).not.toThrow();
  });
});
