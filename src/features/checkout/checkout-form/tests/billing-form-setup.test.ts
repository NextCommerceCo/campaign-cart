import { describe, it, expect, vi } from 'vitest';
import {
  scanBillingFields,
  convertShippingFieldsToBilling,
  reconcileBillingToggle,
  setInitialBillingFormState,
  setupBillingForm,
  type BillingFormSetupContext,
} from '../billing-form-setup';
import type { Logger } from '@/core/logger';

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Kept as a plain object (not typed as `Logger`) so `mockLogger.warn` stays a
// `Mock` in assertions — going through `ctx.logger.warn` instead would carry
// `Logger`'s method signature and trip `@typescript-eslint/unbound-method`.
// Mirrors `billing-animation.test.ts` / `phone-input.test.ts`.
function createMockLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function createCtx(
  overrides: Partial<BillingFormSetupContext> = {}
): BillingFormSetupContext {
  return {
    form: document.createElement('form'),
    billingFields: new Map<string, HTMLElement>(),
    logger: createMockLogger() as unknown as Logger,
    ...overrides,
  };
}

// ─── convertShippingFieldsToBilling ────────────────────────────────────────────

describe('convertShippingFieldsToBilling', () => {
  it('rewrites data-next-checkout-field, name, id and clears the value', () => {
    const row = document.createElement('div');
    row.innerHTML =
      '<input data-next-checkout-field="address1" name="shipping_address1" id="shipping_address1" value="123 Main St" />';

    convertShippingFieldsToBilling(row);

    const input = row.querySelector('input') as HTMLInputElement;
    expect(input.getAttribute('data-next-checkout-field')).toBe(
      'billing-address1'
    );
    expect(input.name).toBe('billing_address1');
    expect(input.id).toBe('billing_address1');
    expect(input.value).toBe('');
  });

  it('rewrites the legacy os-checkout-field attribute the same way', () => {
    const row = document.createElement('div');
    row.innerHTML =
      '<input os-checkout-field="address1" name="shipping_address1" id="shipping_address1" value="123 Main St" />';

    convertShippingFieldsToBilling(row);

    const input = row.querySelector('input') as HTMLInputElement;
    expect(input.getAttribute('os-checkout-field')).toBe('billing-address1');
  });

  it('is idempotent: running it again on an already-converted subtree changes nothing further', () => {
    const row = document.createElement('div');
    row.innerHTML =
      '<input data-next-checkout-field="address1" name="shipping_address1" id="shipping_address1" />';

    convertShippingFieldsToBilling(row);
    convertShippingFieldsToBilling(row);

    const input = row.querySelector('input') as HTMLInputElement;
    expect(input.getAttribute('data-next-checkout-field')).toBe(
      'billing-address1'
    );
    expect(input.name).toBe('billing_address1');
    expect(input.id).toBe('billing_address1');
  });

  it('unchecks checkboxes and radios instead of clearing their value', () => {
    const row = document.createElement('div');
    row.innerHTML =
      '<input type="checkbox" name="shipping_gift" id="shipping_gift" checked />';

    convertShippingFieldsToBilling(row);

    const input = row.querySelector('input') as HTMLInputElement;
    expect(input.checked).toBe(false);
    expect(input.name).toBe('billing_gift');
  });

  it('removes headings so the shipping section title is not duplicated', () => {
    const row = document.createElement('div');
    row.innerHTML =
      '<h3>Shipping address</h3><input name="shipping_address1" id="shipping_address1" />';

    convertShippingFieldsToBilling(row);

    expect(row.querySelector('h3')).toBeNull();
  });
});

// ─── scanBillingFields ──────────────────────────────────────────────────────────

describe('scanBillingFields', () => {
  it('records fields by name under both the modern and legacy attribute', () => {
    document.body.innerHTML = `
      <input data-next-checkout-field="billing-address1" />
      <input os-checkout-field="billing-city" />
    `;
    const ctx = createCtx();

    scanBillingFields(ctx);

    expect(ctx.billingFields.get('billing-address1')).toBeInstanceOf(
      HTMLElement
    );
    expect(ctx.billingFields.get('billing-city')).toBeInstanceOf(HTMLElement);
  });

  it('falls through to the modern attribute when the legacy one is present but empty', () => {
    // `os-checkout-field=""` is a present-but-empty attribute — getAttribute
    // returns '' for it, not null, so the field must be recorded under
    // `data-next-checkout-field` instead of being dropped.
    document.body.innerHTML =
      '<input os-checkout-field="" data-next-checkout-field="billing-postcode" />';
    const ctx = createCtx();

    scanBillingFields(ctx);

    expect(ctx.billingFields.has('billing-postcode')).toBe(true);
    expect(ctx.billingFields.size).toBe(1);
  });
});

// ─── setInitialBillingFormState ────────────────────────────────────────────────

describe('setInitialBillingFormState', () => {
  it('checked toggle ("same as shipping") collapses the billing section', () => {
    const form = document.createElement('form');
    form.innerHTML = '<input name="use_shipping_address" checked />';
    document.body.innerHTML =
      '<div os-checkout-element="different-billing-address"></div>';
    const ctx = createCtx({ form });

    setInitialBillingFormState(ctx);

    const section = document.querySelector(
      '[os-checkout-element="different-billing-address"]'
    ) as HTMLElement;
    expect(section.style.height).toBe('0px');
    expect(section.style.overflow).toBe('hidden');
    expect(section.classList.contains('billing-form-collapsed')).toBe(true);
    expect(section.classList.contains('billing-form-expanded')).toBe(false);
  });

  it('unchecked toggle expands the billing section', () => {
    const form = document.createElement('form');
    form.innerHTML = '<input name="use_shipping_address" />';
    document.body.innerHTML =
      '<div os-checkout-element="different-billing-address"></div>';
    const ctx = createCtx({ form });

    setInitialBillingFormState(ctx);

    const section = document.querySelector(
      '[os-checkout-element="different-billing-address"]'
    ) as HTMLElement;
    expect(section.style.height).toBe('auto');
    expect(section.style.overflow).toBe('visible');
    expect(section.classList.contains('billing-form-expanded')).toBe(true);
    expect(section.classList.contains('billing-form-collapsed')).toBe(false);
  });

  it('logs a warning and does not throw when the toggle or section is missing', () => {
    // Kept as a separate reference (not read back through `ctx.logger.warn`)
    // so the assertion targets a plain `vi.fn()` — going through the `Logger`
    // type trips `@typescript-eslint/unbound-method`.
    const mockLogger = createMockLogger();
    const ctx = createCtx({ logger: mockLogger as unknown as Logger }); // empty form, nothing in document

    expect(() => setInitialBillingFormState(ctx)).not.toThrow();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      '[Billing] Could not set initial state - missing elements'
    );
  });
});

// ─── reconcileBillingToggle ────────────────────────────────────────────────────

describe('reconcileBillingToggle', () => {
  function renderToggleAndSection(checked: boolean): {
    ctx: BillingFormSetupContext;
    toggle: HTMLInputElement;
    section: HTMLElement;
  } {
    const form = document.createElement('form');
    form.innerHTML = `<input type="checkbox" name="use_shipping_address"${checked ? ' checked' : ''} />`;
    document.body.innerHTML =
      '<div os-checkout-element="different-billing-address"></div>';

    return {
      ctx: createCtx({ form }),
      toggle: form.querySelector('input') as HTMLInputElement,
      section: document.querySelector(
        '[os-checkout-element="different-billing-address"]'
      ) as HTMLElement,
    };
  }

  it('unticks the toggle and opens the section when the store says billing is separate', () => {
    const { ctx, toggle, section } = renderToggleAndSection(true);

    const inForce = reconcileBillingToggle(ctx, false);

    expect(inForce).toBe(false);
    expect(toggle.checked).toBe(false);
    expect(section.classList.contains('billing-form-expanded')).toBe(true);
  });

  it('reports the markup back when the store holds only its default', () => {
    // `true` is the store's untouched default, so an unticked checkbox is the page
    // author's answer, not a stale one — it is reported for the caller to store.
    const { ctx, toggle } = renderToggleAndSection(false);

    expect(reconcileBillingToggle(ctx, true)).toBe(false);
    expect(toggle.checked).toBe(false);
  });

  it('returns the stored choice unchanged when the page has no toggle', () => {
    const mockLogger = createMockLogger();
    const ctx = createCtx({ logger: mockLogger as unknown as Logger });

    expect(reconcileBillingToggle(ctx, false)).toBe(false);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      '[Billing] No toggle on this page - keeping the stored choice'
    );
  });
});

// ─── setupBillingForm ───────────────────────────────────────────────────────────

describe('setupBillingForm', () => {
  it('returns false when there is no billing container on the page', () => {
    document.body.innerHTML =
      '<form os-checkout-component="shipping-form"></form>';
    const ctx = createCtx();

    expect(setupBillingForm(ctx)).toBe(false);
  });

  it('returns false when there is no shipping form on the page', () => {
    document.body.innerHTML =
      '<div os-checkout-element="different-billing-address"><div os-checkout-component="billing-form"></div></div>';
    const ctx = createCtx();

    expect(setupBillingForm(ctx)).toBe(false);
  });

  it('returns false when the billing container has no inner form container to fill', () => {
    document.body.innerHTML = `
      <div os-checkout-element="different-billing-address"></div>
      <form os-checkout-component="shipping-form"></form>
    `;
    const ctx = createCtx();

    expect(setupBillingForm(ctx)).toBe(false);
  });

  it('clones shipping rows into the billing container with billing- identities and clears values', () => {
    document.body.innerHTML = `
      <div os-checkout-element="different-billing-address">
        <div os-checkout-component="billing-form"></div>
      </div>
      <form os-checkout-component="shipping-form">
        <input name="use_shipping_address" />
        <div data-next-component="shipping-field-row">
          <input data-next-checkout-field="address1" name="shipping_address1" id="shipping_address1" value="123 Main St" />
        </div>
      </form>
    `;
    const form = document.querySelector(
      '[os-checkout-component="shipping-form"]'
    ) as HTMLElement;
    const ctx = createCtx({ form });

    const result = setupBillingForm(ctx);

    expect(result).toBe(true);
    const billingFormContainer = document.querySelector(
      '[os-checkout-component="billing-form"]'
    ) as HTMLElement;
    const clonedInput = billingFormContainer.querySelector(
      'input'
    ) as HTMLInputElement;
    expect(clonedInput.getAttribute('data-next-checkout-field')).toBe(
      'billing-address1'
    );
    expect(clonedInput.name).toBe('billing_address1');
    expect(clonedInput.value).toBe('');
    // The original shipping row is left untouched by the clone-and-convert.
    const originalInput = form.querySelector(
      'input[name="shipping_address1"]'
    ) as HTMLInputElement;
    expect(originalInput.value).toBe('123 Main St');
  });
});
