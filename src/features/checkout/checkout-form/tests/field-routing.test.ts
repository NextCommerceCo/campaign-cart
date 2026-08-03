import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CheckoutFormEnhancer } from '../checkout-form.enhancer';
import { routeBillingField } from '../billing-field-routing';
import { persistContactField } from '../contact-persistence';
import { formatPostalCodeInPlace } from '../postal-code-format';
import { updateStateOptions } from '../state-fields';
import { updateFieldValidationDisplay } from '../field-validation-display';
import type { CheckoutValidator } from '../../validation/checkout-validator';
import { useCheckoutStore } from '@/state/checkout';

const { trackMock, createAddShippingInfoEventMock } = vi.hoisted(() => ({
  trackMock: vi.fn(),
  createAddShippingInfoEventMock: vi.fn((shippingTier?: string) => ({
    event: 'add_shipping_info',
    shippingTier,
  })),
}));

vi.mock('@/core/analytics/index', () => ({
  nextAnalytics: { track: trackMock },
  EcommerceEvents: {
    createAddShippingInfoEvent: createAddShippingInfoEventMock,
  },
}));

// The four modules `handleFieldChange` delegates to. Stubbed so this file asserts the
// routing — which step runs, for which field, in which order — while each module's own
// behaviour is pinned by its own colocated test.
vi.mock('../billing-field-routing', () => ({
  routeBillingField: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../contact-persistence', () => ({
  persistContactField: vi.fn(),
}));
vi.mock('../postal-code-format', () => ({
  formatPostalCodeInPlace: vi.fn(),
}));
vi.mock('../state-fields', () => ({
  updateStateOptions: vi.fn().mockResolvedValue(undefined),
  updateBillingStateOptions: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../field-validation-display', () => ({
  updateFieldValidationDisplay: vi.fn(),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Plain object rather than `Logger`, so the spies stay `Mock`s in assertions.
function createMockLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

/** The privates this file reaches, named once so no call site needs a cast. */
interface Routing {
  handleFieldChange(event: Event): Promise<void>;
  showLocationFields(): void;
  fields: Map<string, HTMLElement>;
  billingFields: Map<string, HTMLElement>;
  phoneInputs: Map<string, unknown>;
  hasTrackedShippingInfo: { value: boolean };
  validator: Pick<
    CheckoutValidator,
    'validateField' | 'setError' | 'clearError'
  >;
  logger: ReturnType<typeof createMockLogger>;
}

function createForm(): {
  routing: Routing;
  logger: ReturnType<typeof createMockLogger>;
  validateField: ReturnType<typeof vi.fn>;
  setError: ReturnType<typeof vi.fn>;
  clearError: ReturnType<typeof vi.fn>;
} {
  const form = document.createElement('form');
  document.body.appendChild(form);

  const logger = createMockLogger();
  const validateField = vi.fn(() => ({ isValid: true }));
  const setError = vi.fn();
  const clearError = vi.fn();

  const routing = new CheckoutFormEnhancer(form) as unknown as Routing;
  routing.logger = logger;
  routing.validator = {
    validateField,
    setError,
    clearError,
  } as unknown as Routing['validator'];

  return { routing, logger, validateField, setError, clearError };
}

/** A field element carrying the SDK's field-name attribute, plus an event on it. */
function fieldEvent(
  name: string,
  value: string,
  type = 'change'
): { target: HTMLInputElement; event: Event } {
  const target = document.createElement('input');
  target.setAttribute('data-next-checkout-field', name);
  target.value = value;
  document.body.appendChild(target);
  const event = new Event(type);
  Object.defineProperty(event, 'target', { value: target });
  return { target, event };
}

function selectEvent(
  name: string,
  value: string,
  type = 'change'
): { target: HTMLSelectElement; event: Event } {
  const target = document.createElement('select');
  target.setAttribute('data-next-checkout-field', name);
  const option = document.createElement('option');
  option.value = value;
  target.appendChild(option);
  target.value = value;
  document.body.appendChild(target);
  const event = new Event(type);
  Object.defineProperty(event, 'target', { value: target });
  return { target, event };
}

beforeEach(() => {
  useCheckoutStore.getState().reset();
  sessionStorage.clear();
});

afterEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '';
  useCheckoutStore.getState().reset();
  sessionStorage.clear();
});

// ─── Which branch a field takes ───────────────────────────────────────────────

describe('handleFieldChange — branching', () => {
  it('sends a billing- field to the billing router and nowhere else', async () => {
    const { routing } = createForm();
    const { event } = fieldEvent('billing-city', 'Hanoi');

    await routing.handleFieldChange(event);

    expect(routeBillingField).toHaveBeenCalledTimes(1);
    expect(
      useCheckoutStore.getState().formData['billing-city']
    ).toBeUndefined();
  });

  it('sends every other field to the shipping router', async () => {
    const { routing } = createForm();
    const { event } = fieldEvent('city', 'Hanoi');

    await routing.handleFieldChange(event);

    expect(routeBillingField).not.toHaveBeenCalled();
    expect(useCheckoutStore.getState().formData.city).toBe('Hanoi');
  });

  it('ignores an element that carries no field name', async () => {
    const { routing } = createForm();
    const target = document.createElement('input');
    const event = new Event('change');
    Object.defineProperty(event, 'target', { value: target });

    await routing.handleFieldChange(event);

    expect(updateFieldValidationDisplay).not.toHaveBeenCalled();
    expect(useCheckoutStore.getState().formData).toEqual({});
  });

  it('runs the display update for both branches', async () => {
    const { routing } = createForm();

    await routing.handleFieldChange(fieldEvent('city', 'Hanoi').event);
    await routing.handleFieldChange(fieldEvent('billing-city', 'Hanoi').event);

    expect(updateFieldValidationDisplay).toHaveBeenCalledTimes(2);
  });
});

// ─── The shipping steps, in order ─────────────────────────────────────────────

describe('handleFieldChange — shipping routing', () => {
  it('stores the value and clears the field error', async () => {
    const { routing } = createForm();
    useCheckoutStore.getState().setError('city', 'Enter a city');

    await routing.handleFieldChange(fieldEvent('city', 'Hanoi').event);

    expect(useCheckoutStore.getState().formData.city).toBe('Hanoi');
    expect(useCheckoutStore.getState().errors.city).toBeUndefined();
  });

  it('formats the postcode against the shipping country', async () => {
    const { routing } = createForm();
    const country = document.createElement('select');
    routing.fields.set('country', country);
    const { target, event } = fieldEvent('postal', 'k1a0b1');

    await routing.handleFieldChange(event);

    expect(formatPostalCodeInPlace).toHaveBeenCalledWith(
      expect.anything(),
      target,
      country
    );
  });

  it('rebuilds the province dropdown and remembers the country', async () => {
    const { routing, logger } = createForm();
    const province = document.createElement('select');
    routing.fields.set('province', province);

    await routing.handleFieldChange(selectEvent('country', 'CA').event);

    expect(updateStateOptions).toHaveBeenCalledWith(
      expect.anything(),
      'CA',
      province
    );
    expect(sessionStorage.getItem('next_selected_country')).toBe('CA');
    expect(logger.debug).toHaveBeenCalledWith(
      "Saved user's country selection to session: CA"
    );
  });

  it('reveals the address rows once a street address exists', async () => {
    const { routing } = createForm();
    const reveal = vi
      .spyOn(routing, 'showLocationFields')
      .mockImplementation(() => {});

    await routing.handleFieldChange(
      fieldEvent('address1', '10 Downing Street').event
    );

    expect(reveal).toHaveBeenCalledTimes(1);
  });

  it('does not reveal them for whitespace', async () => {
    const { routing } = createForm();
    const reveal = vi
      .spyOn(routing, 'showLocationFields')
      .mockImplementation(() => {});

    await routing.handleFieldChange(fieldEvent('address1', '   ').event);

    expect(reveal).not.toHaveBeenCalled();
  });
});

// ─── add_shipping_info ────────────────────────────────────────────────────────

describe('handleFieldChange — add_shipping_info', () => {
  function withCityAndProvince(): void {
    useCheckoutStore
      .getState()
      .updateFormData({ city: 'Hanoi', province: 'HN' });
  }

  it('fires once the address is complete', async () => {
    const { routing, logger } = createForm();
    vi.spyOn(routing, 'showLocationFields').mockImplementation(() => {});
    withCityAndProvince();

    await routing.handleFieldChange(
      fieldEvent('address1', '10 Downing Street').event
    );

    expect(createAddShippingInfoEventMock).toHaveBeenCalledWith('Standard');
    expect(trackMock).toHaveBeenCalledTimes(1);
    expect(routing.hasTrackedShippingInfo.value).toBe(true);
    expect(logger.info).toHaveBeenCalledWith(
      'Tracked add_shipping_info event (address complete)',
      { shippingTier: 'Standard' }
    );
  });

  it('does not fire while the address is still incomplete', async () => {
    const { routing } = createForm();
    vi.spyOn(routing, 'showLocationFields').mockImplementation(() => {});

    await routing.handleFieldChange(
      fieldEvent('address1', '10 Downing Street').event
    );

    expect(trackMock).not.toHaveBeenCalled();
  });

  it('does not fire a second time', async () => {
    const { routing } = createForm();
    vi.spyOn(routing, 'showLocationFields').mockImplementation(() => {});
    withCityAndProvince();
    routing.hasTrackedShippingInfo.value = true;

    await routing.handleFieldChange(
      fieldEvent('address1', '10 Downing Street').event
    );

    expect(trackMock).not.toHaveBeenCalled();
  });

  it('logs a tracking failure instead of losing the keystroke', async () => {
    const { routing, logger } = createForm();
    vi.spyOn(routing, 'showLocationFields').mockImplementation(() => {});
    withCityAndProvince();
    const failure = new Error('no provider');
    trackMock.mockImplementationOnce(() => {
      throw failure;
    });

    await routing.handleFieldChange(
      fieldEvent('address1', '10 Downing Street').event
    );

    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to track add_shipping_info event:',
      failure
    );
    expect(useCheckoutStore.getState().formData.address1).toBe(
      '10 Downing Street'
    );
  });
});

// ─── Commit-time validation ───────────────────────────────────────────────────

describe('handleFieldChange — commit-time validation', () => {
  it('judges the four contact fields on blur', async () => {
    const { routing, validateField, setError, logger } = createForm();
    validateField.mockReturnValue({
      isValid: false,
      message: 'Enter a valid email',
    });

    await routing.handleFieldChange(
      fieldEvent('email', 'not-an-email', 'blur').event
    );

    expect(setError).toHaveBeenCalledWith('email', 'Enter a valid email');
    expect(logger.warn).toHaveBeenCalledWith(
      'Invalid email detected on blur:',
      'not-an-email'
    );
  });

  it('clears the error when the value now passes', async () => {
    const { routing, clearError } = createForm();

    await routing.handleFieldChange(
      fieldEvent('email', 'ada@x.com', 'blur').event
    );

    expect(clearError).toHaveBeenCalledWith('email');
  });

  it('says nothing about an empty field', async () => {
    const { routing, validateField } = createForm();

    await routing.handleFieldChange(fieldEvent('email', '   ', 'blur').event);

    expect(validateField).not.toHaveBeenCalled();
  });

  it('leaves other fields to the display module', async () => {
    const { routing, validateField } = createForm();

    await routing.handleFieldChange(
      fieldEvent('address1', '10 Downing Street', 'blur').event
    );

    expect(validateField).not.toHaveBeenCalled();
  });

  it('says nothing while the shopper is still typing', async () => {
    const { routing, validateField } = createForm();

    await routing.handleFieldChange(
      fieldEvent('email', 'not-an-email', 'input').event
    );

    expect(validateField).not.toHaveBeenCalled();
  });

  /**
   * DEFECT (left as found): `change` errors these four fields, which the display module
   * documents that it never does.
   *
   * `field-validation-display.ts` deliberately leaves a failing value alone on `change` —
   * the value arrived from autofill or a Places suggestion, not from the shopper's
   * fingers, and interrupting them over it is worse than waiting for blur. This block runs
   * first and shows the error anyway, so a Places result whose city the pattern rejects
   * turns red the instant it lands.
   */
  it('DEFECT: shows an error on change, which the display module never would', async () => {
    const { routing, setError, validateField } = createForm();
    validateField.mockReturnValue({ isValid: false, message: 'Enter a city' });

    await routing.handleFieldChange(
      fieldEvent('city', 'Ho Chi Minh City', 'change').event
    );

    expect(setError).toHaveBeenCalledTimes(1);
  });
});

// ─── Contact persistence gating ───────────────────────────────────────────────

describe('handleFieldChange — contact persistence', () => {
  it.each(['blur', 'change'])('commits on %s', async type => {
    const { routing } = createForm();

    await routing.handleFieldChange(
      fieldEvent('email', 'ada@x.com', type).event
    );

    expect(persistContactField).toHaveBeenCalledWith(
      expect.anything(),
      'email',
      'ada@x.com'
    );
  });

  it('does not commit on every keystroke', async () => {
    const { routing } = createForm();

    await routing.handleFieldChange(
      fieldEvent('email', 'ada@x.com', 'input').event
    );

    expect(persistContactField).not.toHaveBeenCalled();
  });
});
