import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Logger } from '@/core/logger';
import { useCheckoutStore } from '@/state/checkout';
import {
  clearAllCheckoutFields,
  populateFormData,
  type FormClearingContext,
  type FormPopulationContext,
} from '../form-population';
import type { ShippingStateFieldsContext } from '../state-fields';

const updateStateOptions = vi.hoisted(() => vi.fn());

vi.mock('../state-fields', () => ({ updateStateOptions }));

// Plain object rather than `Logger`, so the spies stay `Mock`s in assertions.
function createMockLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function buildForm(html: string): {
  form: HTMLFormElement;
  fields: Map<string, HTMLElement>;
  billingFields: Map<string, HTMLElement>;
} {
  document.body.innerHTML = `<form id="checkout">${html}</form>`;
  const form = document.getElementById('checkout') as HTMLFormElement;
  const fields = new Map<string, HTMLElement>();
  const billingFields = new Map<string, HTMLElement>();
  form.querySelectorAll('[data-field]').forEach(el => {
    const name = el.getAttribute('data-field') as string;
    (name.startsWith('billing-') ? billingFields : fields).set(
      name,
      el as HTMLElement
    );
  });
  return { form, fields, billingFields };
}

function createPopulationCtx(
  html: string,
  options: { detectedCountryCode?: string } = {}
): {
  ctx: FormPopulationContext;
  fields: Map<string, HTMLElement>;
  logger: ReturnType<typeof createMockLogger>;
  updateFormData: ReturnType<typeof vi.fn>;
  updateLabels: ReturnType<typeof vi.fn>;
} {
  const { fields } = buildForm(html);
  const logger = createMockLogger();
  const updateFormData = vi.fn();
  const updateLabels = vi.fn();
  return {
    fields,
    logger,
    updateFormData,
    updateLabels,
    ctx: {
      fields,
      detectedCountryCode: options.detectedCountryCode ?? 'US',
      logger: logger as unknown as Logger,
      shippingStateFields: {} as ShippingStateFieldsContext,
      updateFormData,
      updateLabelsForPopulatedData: updateLabels,
    },
  };
}

beforeEach(() => {
  updateStateOptions.mockReset();
  useCheckoutStore.getState().reset();
  document.body.innerHTML = '';
});

afterEach(() => {
  vi.useRealTimers();
});

const COUNTRY_SELECT =
  '<select data-field="country"><option value=""></option><option value="US"></option><option value="CA"></option></select>';
const PROVINCE_SELECT =
  '<select data-field="province"><option value=""></option><option value="ON"></option></select>';

// ─── Putting values back ──────────────────────────────────────────────────────

describe('populateFormData', () => {
  it('writes stored values back into their inputs', async () => {
    useCheckoutStore
      .getState()
      .updateFormData({ email: 'ada@example.com', city: 'London' });
    const { ctx, fields } = createPopulationCtx(
      '<input data-field="email" /><input data-field="city" />'
    );

    await populateFormData(ctx);

    expect((fields.get('email') as HTMLInputElement).value).toBe(
      'ada@example.com'
    );
    expect((fields.get('city') as HTMLInputElement).value).toBe('London');
  });

  it('loads the provinces first when the stored country is not the one booted with', async () => {
    useCheckoutStore.getState().updateFormData({ country: 'CA' });
    const { ctx } = createPopulationCtx(COUNTRY_SELECT + PROVINCE_SELECT, {
      detectedCountryCode: 'US',
    });

    await populateFormData(ctx);

    expect(updateStateOptions).toHaveBeenCalledTimes(1);
  });

  it('does not reload the provinces when the stored country is the one booted with', async () => {
    useCheckoutStore.getState().updateFormData({ country: 'US' });
    const { ctx } = createPopulationCtx(COUNTRY_SELECT + PROVINCE_SELECT, {
      detectedCountryCode: 'US',
    });

    await populateFormData(ctx);

    expect(updateStateOptions).not.toHaveBeenCalled();
  });

  it('restores the province last, and tells the store it did', async () => {
    useCheckoutStore.getState().updateFormData({ province: 'ON' });
    const { ctx, fields, updateFormData } =
      createPopulationCtx(PROVINCE_SELECT);

    await populateFormData(ctx);

    expect((fields.get('province') as HTMLSelectElement).value).toBe('ON');
    expect(updateFormData).toHaveBeenCalledWith({ province: 'ON' });
  });

  it('warns rather than guessing when the stored province is not an option', async () => {
    useCheckoutStore
      .getState()
      .updateFormData({ province: 'ZZ', country: 'CA' });
    const { ctx, logger } = createPopulationCtx(PROVINCE_SELECT, {
      detectedCountryCode: 'CA',
    });

    await populateFormData(ctx);

    expect(logger.warn).toHaveBeenCalledWith(
      'Province ZZ not found in options for country CA'
    );
  });

  /**
   * Populating writes the store's value into the box and stops there. Putting that number
   * in E.164 is `phone-normalization.ts`, on the gates that wait for the phone library —
   * not a 50 ms timer racing the widget from here.
   */
  it('leaves the stored phone in whatever format it was, and starts no timer', async () => {
    vi.useFakeTimers();
    useCheckoutStore.getState().updateFormData({ phone: '07700 900123' });
    const { ctx, updateFormData } = createPopulationCtx(
      '<input data-field="phone" />'
    );

    await populateFormData(ctx);
    vi.advanceTimersByTime(1000);

    expect(updateFormData).not.toHaveBeenCalledWith({
      phone: '+447700900123',
    });
  });

  it('floats the labels of the boxes it just filled', async () => {
    const { ctx, updateLabels } = createPopulationCtx(
      '<input data-field="email" />'
    );

    await populateFormData(ctx);

    expect(updateLabels).toHaveBeenCalledTimes(1);
  });

  // Finding 175b. The shopper unticked the marketing box on a page whose markup ships it
  // checked; the store kept that `false`, and the reload has to honour it.
  it('unticks a checkbox the shopper opted out of, so the opt-out survives', async () => {
    useCheckoutStore.getState().updateFormData({ accepts_marketing: false });
    const { ctx, fields } = createPopulationCtx(
      '<input type="checkbox" data-field="accepts_marketing" checked />'
    );

    await populateFormData(ctx);

    expect((fields.get('accepts_marketing') as HTMLInputElement).checked).toBe(
      false
    );
  });

  // The same defect in the other direction: a stored `true` used to be written into the
  // checkbox's `value`, which leaves the tick exactly as the markup shipped it.
  it('ticks a checkbox the shopper opted in to', async () => {
    useCheckoutStore.getState().updateFormData({ accepts_marketing: true });
    const { ctx, fields } = createPopulationCtx(
      '<input type="checkbox" data-field="accepts_marketing" />'
    );

    await populateFormData(ctx);

    const box = fields.get('accepts_marketing') as HTMLInputElement;
    expect(box.checked).toBe(true);
    expect(box.value).toBe('on');
  });

  it('restores a stored zero rather than reading it as no answer', async () => {
    useCheckoutStore.getState().updateFormData({ gift_count: 0 });
    const { ctx, fields } = createPopulationCtx(
      '<input data-field="gift_count" value="5" />'
    );

    await populateFormData(ctx);

    expect((fields.get('gift_count') as HTMLInputElement).value).toBe('0');
  });

  /**
   * An empty string is the one falsy value that is *not* an answer: the store strips
   * empty strings before persisting, so one can only ever be an in-session blank, and
   * writing it back would wipe what boot or the page's own markup just put in the box.
   */
  it('leaves a box alone when the store holds only an empty string for it', async () => {
    useCheckoutStore.getState().updateFormData({ city: '' });
    const { ctx, fields } = createPopulationCtx(
      '<input data-field="city" value="London" />'
    );

    await populateFormData(ctx);

    expect((fields.get('city') as HTMLInputElement).value).toBe('London');
  });

  /**
   * Was a defect: the phone rewrite ran on a bare `setTimeout` nobody held a handle to, so
   * a form destroyed inside those 50 ms still wrote to the store, logged, and called a
   * widget that had been torn down. There is nothing left to cancel.
   */
  it('leaves nothing pending for a caller to cancel', async () => {
    vi.useFakeTimers();
    useCheckoutStore.getState().updateFormData({ phone: '07700 900123' });
    const { ctx, updateFormData } = createPopulationCtx(
      '<input data-field="phone" />'
    );

    await populateFormData(ctx);
    updateFormData.mockClear();
    vi.advanceTimersByTime(1000);

    expect(updateFormData).not.toHaveBeenCalled();
  });
});

// ─── Emptying the form ────────────────────────────────────────────────────────

describe('clearAllCheckoutFields', () => {
  function createClearingCtx(
    html: string,
    options: { clearCardFields?: () => void } = {}
  ): {
    ctx: FormClearingContext;
    fields: Map<string, HTMLElement>;
    billingFields: Map<string, HTMLElement>;
    logger: ReturnType<typeof createMockLogger>;
  } {
    const { form, fields, billingFields } = buildForm(html);
    const logger = createMockLogger();
    return {
      fields,
      billingFields,
      logger,
      ctx: {
        form,
        fields,
        billingFields,
        detectedCountryCode: 'US',
        logger: logger as unknown as Logger,
        clearCardFields: options.clearCardFields,
      },
    };
  }

  it('empties text inputs and unticks checkboxes in both sections', () => {
    const { ctx, fields, billingFields } = createClearingCtx(
      '<input data-field="email" value="ada@example.com" />' +
        '<input type="checkbox" data-field="accepts_marketing" checked />' +
        '<input data-field="billing-city" value="London" />'
    );

    clearAllCheckoutFields(ctx);

    expect((fields.get('email') as HTMLInputElement).value).toBe('');
    expect((fields.get('accepts_marketing') as HTMLInputElement).checked).toBe(
      false
    );
    expect((billingFields.get('billing-city') as HTMLInputElement).value).toBe(
      ''
    );
  });

  it('resets the checkout store', () => {
    useCheckoutStore.getState().updateFormData({ email: 'ada@example.com' });
    const { ctx } = createClearingCtx('<input data-field="email" />');

    clearAllCheckoutFields(ctx);

    expect(useCheckoutStore.getState().formData.email).toBeUndefined();
  });

  it('wipes the hosted card fields when Spreedly has loaded', () => {
    const clearCardFields = vi.fn();
    const { ctx } = createClearingCtx('', { clearCardFields });

    clearAllCheckoutFields(ctx);

    expect(clearCardFields).toHaveBeenCalledTimes(1);
  });

  it('puts the country back and lets the form react to it', () => {
    const changes: string[] = [];
    const { ctx, fields } = createClearingCtx(COUNTRY_SELECT);
    fields
      .get('country')
      ?.addEventListener('change', () => changes.push('country'));

    clearAllCheckoutFields(ctx);

    expect((fields.get('country') as HTMLSelectElement).value).toBe('US');
    expect(changes).toEqual(['country']);
  });

  it('puts the billing toggle back to same-as-shipping', () => {
    const { ctx } = createClearingCtx(
      '<input type="checkbox" name="use_shipping_address" />'
    );

    clearAllCheckoutFields(ctx);

    const toggle = document.querySelector(
      'input[name="use_shipping_address"]'
    ) as HTMLInputElement;
    expect(toggle.checked).toBe(true);
  });

  it('logs and swallows a failure rather than leaving the shopper stuck', () => {
    const { ctx, logger } = createClearingCtx('');
    const reset = vi
      .spyOn(useCheckoutStore.getState(), 'reset')
      .mockImplementation(() => {
        throw new Error('boom');
      });

    expect(() => clearAllCheckoutFields(ctx)).not.toThrow();
    expect(logger.error).toHaveBeenCalledWith(
      'Error clearing checkout fields:',
      expect.any(Error)
    );
    reset.mockRestore();
  });
});
