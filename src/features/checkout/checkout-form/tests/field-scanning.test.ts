import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Logger } from '@/core/logger';
import {
  getFieldByName,
  getFieldNameFromElement,
  scanAllFields,
  type FieldScanContext,
} from '../field-scanning';

// Plain object rather than `Logger`, so the spies stay `Mock`s in assertions.
function createMockLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function createCtx(html: string): {
  ctx: FieldScanContext;
  logger: ReturnType<typeof createMockLogger>;
  form: HTMLFormElement;
} {
  document.body.innerHTML = `<form id="checkout">${html}</form>`;
  const form = document.getElementById('checkout') as HTMLFormElement;
  const logger = createMockLogger();
  const fields = new Map<string, HTMLElement>();

  return {
    form,
    logger,
    ctx: {
      form,
      fields,
      paymentButtons: new Map<string, HTMLElement>(),
      logger: logger as unknown as Logger,
      expirationFields: { fields },
    },
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

// ─── The two attribute spellings ──────────────────────────────────────────────

describe('scanAllFields: which inputs become order data', () => {
  it('finds fields written with the current attribute', () => {
    const { ctx } = createCtx(
      '<input data-next-checkout-field="email" /><input data-next-checkout-field="fname" />'
    );

    scanAllFields(ctx);

    expect([...ctx.fields.keys()]).toEqual(
      expect.arrayContaining(['email', 'fname'])
    );
  });

  it('finds fields written with the legacy attribute, so old pages keep working', () => {
    const { ctx } = createCtx('<input os-checkout-field="city" />');

    scanAllFields(ctx);

    expect(ctx.fields.get('city')).toBeInstanceOf(HTMLInputElement);
  });

  it('ignores an input carrying neither attribute — it never reaches the order', () => {
    const { ctx } = createCtx('<input name="coupon" />');

    scanAllFields(ctx);

    expect(ctx.fields.has('coupon')).toBe(false);
  });

  it('does not clear entries a previous scan made, so a re-scan only adds', () => {
    const { ctx } = createCtx('<input data-next-checkout-field="email" />');
    const stale = document.createElement('input');
    ctx.fields.set('phone', stale);

    scanAllFields(ctx);

    expect(ctx.fields.get('phone')).toBe(stale);
  });

  it('only looks inside the form, so a stray field elsewhere on the page is not collected', () => {
    const { ctx } = createCtx('<input data-next-checkout-field="email" />');
    const outside = document.createElement('input');
    outside.setAttribute('data-next-checkout-field', 'lname');
    document.body.appendChild(outside);

    scanAllFields(ctx);

    expect(ctx.fields.has('lname')).toBe(false);
  });
});

// ─── The submit button ────────────────────────────────────────────────────────

describe('scanAllFields: the submit button', () => {
  it('returns the button and does not warn', () => {
    const { ctx, logger } = createCtx('<button type="submit">Pay</button>');

    const submitButton = scanAllFields(ctx);

    expect(submitButton).toBeInstanceOf(HTMLButtonElement);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('falls back to the attribute spellings when there is no native submit button', () => {
    const { ctx } = createCtx('<button data-next-checkout-submit>Pay</button>');

    expect(scanAllFields(ctx)).toBeInstanceOf(HTMLButtonElement);
  });

  it('returns nothing and warns when the form has no submit control', () => {
    const { ctx, logger } = createCtx(
      '<input data-next-checkout-field="email" />'
    );

    expect(scanAllFields(ctx)).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      'Submit button not found in checkout form'
    );
  });

  // Finding 175a. `<input type="submit">` is a submit control the browser itself honours
  // and whose `disabled` it enforces, so the form can hold it shut mid-order exactly as it
  // holds a `<button>` shut.
  it('recognizes <input type="submit"> as the submit control', () => {
    const { ctx, logger } = createCtx('<input type="submit" value="Pay" />');

    expect(scanAllFields(ctx)).toBeInstanceOf(HTMLInputElement);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('recognizes an <input> carrying the submit attribute', () => {
    const { ctx } = createCtx(
      '<input type="button" data-next-checkout-submit value="Pay" />'
    );

    expect(scanAllFields(ctx)).toBeInstanceOf(HTMLInputElement);
  });

  /**
   * Rejected on purpose: an `<a>` (or a `<div>`, or a text input) has no `disabled` the
   * browser honours, so accepting one would report a button held shut while the shopper
   * could go on clicking it. The warning stays, and it is the signal to use a `<button>`
   * or an `<input type="submit">`.
   */
  it('rejects an <a> carrying the submit attribute, which cannot be disabled', () => {
    const { ctx, logger } = createCtx('<a data-next-checkout-submit>Pay</a>');

    expect(scanAllFields(ctx)).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      'Submit button not found in checkout form'
    );
  });

  it('rejects a text input carrying the submit attribute', () => {
    const { ctx } = createCtx(
      '<input type="text" data-next-checkout-submit value="Pay" />'
    );

    expect(scanAllFields(ctx)).toBeUndefined();
  });

  // The old `??` chain stopped at the first element a selector *matched*, so an unusable
  // `<a>` hid a perfectly good button written with the other spelling.
  it('keeps looking past an unusable match and finds the real button', () => {
    const { ctx, logger } = createCtx(
      '<a data-next-checkout-submit>Pay</a><button os-checkout-submit>Pay</button>'
    );

    expect(scanAllFields(ctx)).toBeInstanceOf(HTMLButtonElement);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

// ─── Payment buttons ──────────────────────────────────────────────────────────

describe('scanAllFields: payment buttons', () => {
  it('collects them from the whole document, not just the form', () => {
    const { ctx } = createCtx('');
    const paypal = document.createElement('div');
    paypal.setAttribute('data-next-checkout-payment', 'paypal');
    document.body.appendChild(paypal);

    scanAllFields(ctx);

    expect(ctx.paymentButtons.get('paypal')).toBe(paypal);
  });

  // DEFECT (left as found): nothing ever reads `paymentButtons`. The map is filled here
  // and cleared in `destroy()`, and that is its entire life — payment method changes are
  // driven by the radio inputs instead. A page author who marks a button
  // `data-next-checkout-payment` gets no behaviour from it at all.
  it('DEFECT: fills a map nothing else in the SDK reads', () => {
    const { ctx } = createCtx('');
    const applePay = document.createElement('button');
    applePay.setAttribute('os-checkout-payment', 'apple-pay');
    document.body.appendChild(applePay);

    scanAllFields(ctx);

    expect(ctx.paymentButtons.size).toBe(1);
  });
});

// ─── Naming an element ────────────────────────────────────────────────────────

describe('getFieldNameFromElement', () => {
  it('prefers the current attribute over the legacy one', () => {
    const input = document.createElement('input');
    input.setAttribute('data-next-checkout-field', 'email');
    input.setAttribute('os-checkout-field', 'legacy-email');

    expect(getFieldNameFromElement(input)).toBe('email');
  });

  it('falls back to the element name so a plain input still routes', () => {
    const input = document.createElement('input');
    input.name = 'postal';

    expect(getFieldNameFromElement(input)).toBe('postal');
  });

  it('returns null for an element with no name at all', () => {
    expect(getFieldNameFromElement(document.createElement('div'))).toBeNull();
  });

  it('falls through an empty current attribute to the legacy one', () => {
    const input = document.createElement('input');
    input.setAttribute('data-next-checkout-field', '');
    input.setAttribute('os-checkout-field', 'city');

    expect(getFieldNameFromElement(input)).toBe('city');
  });
});

// ─── Looking an element back up ───────────────────────────────────────────────

describe('getFieldByName', () => {
  it('finds a shipping field', () => {
    const email = document.createElement('input');
    const ctx = {
      fields: new Map([['email', email as HTMLElement]]),
      billingFields: new Map<string, HTMLElement>(),
    };

    expect(getFieldByName(ctx, 'email')).toBe(email);
  });

  it('finds a billing field', () => {
    const billingCity = document.createElement('input');
    const ctx = {
      fields: new Map<string, HTMLElement>(),
      billingFields: new Map([['billing-city', billingCity as HTMLElement]]),
    };

    expect(getFieldByName(ctx, 'billing-city')).toBe(billingCity);
  });

  it('prefers the shipping map when both hold the same name', () => {
    const shipping = document.createElement('input');
    const billing = document.createElement('input');
    const ctx = {
      fields: new Map([['city', shipping as HTMLElement]]),
      billingFields: new Map([['city', billing as HTMLElement]]),
    };

    expect(getFieldByName(ctx, 'city')).toBe(shipping);
  });

  it('returns null for a name neither map holds', () => {
    const ctx = {
      fields: new Map<string, HTMLElement>(),
      billingFields: new Map<string, HTMLElement>(),
    };

    expect(getFieldByName(ctx, 'nope')).toBeNull();
  });
});
