import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CountryConfig } from '@/core/country-service';
import { useCheckoutStore } from '@/state/checkout';

import {
  detectMultiStepCheckout,
  handleStepNavigation,
  type MultiStepDetectionContext,
  type StepNavigationContext,
} from '../multi-step-navigation';

/**
 * The gate a step-navigating shopper passes, and the two attributes that define it.
 *
 * A multi-step checkout is the only shape where pressing submit does **not** create an
 * order, so everything here is about what stops the shopper and what lets them through.
 * Three of these tests are marked `DEFECT:` and pin behaviour that is wrong but was left
 * exactly as found — the fix changes which shoppers reach payment, which is not a refactor.
 */

function createMockLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function detectionContext(
  form: HTMLFormElement
): MultiStepDetectionContext & { setStep: ReturnType<typeof vi.fn> } {
  return {
    form,
    logger: createMockLogger() as never,
    setStep: vi.fn(),
  };
}

function formWith(attributes: Record<string, string>): HTMLFormElement {
  const form = document.createElement('form');
  Object.entries(attributes).forEach(([name, value]) =>
    form.setAttribute(name, value)
  );
  document.body.appendChild(form);
  return form;
}

interface ValidatorStub {
  validateStep: ReturnType<typeof vi.fn>;
  showError: ReturnType<typeof vi.fn>;
  focusFirstErrorField: ReturnType<typeof vi.fn>;
}

function navigationContext(
  overrides: Partial<StepNavigationContext> & { validator?: ValidatorStub } = {}
): StepNavigationContext & {
  validator: ValidatorStub;
  loadingOverlay: {
    show: ReturnType<typeof vi.fn>;
    hide: ReturnType<typeof vi.fn>;
  };
} {
  const validator: ValidatorStub = overrides.validator ?? {
    validateStep: vi.fn().mockResolvedValue({ isValid: true, errors: {} }),
    showError: vi.fn(),
    focusFirstErrorField: vi.fn(),
  };

  return {
    currentStep: 1,
    nextStepUrl: '/checkout/payment',
    countryConfigs: new Map<string, CountryConfig>(),
    currentCountryConfig: { value: undefined },
    loadingOverlay: { show: vi.fn(), hide: vi.fn() },
    getBillingValidationInput: () => ({
      billingAddress: undefined,
      sameAsShipping: true,
    }),
    logger: createMockLogger(),
    ...overrides,
    validator,
  } as never;
}

/** A checkout store double that records what navigation wrote. */
function storeDouble() {
  return {
    formData: { email: 'ada@example.com' },
    clearAllErrors: vi.fn(),
    setProcessing: vi.fn(),
    setError: vi.fn(),
    setStep: vi.fn(),
  };
}

let originalLocation: PropertyDescriptor | undefined;

beforeEach(() => {
  originalLocation = Object.getOwnPropertyDescriptor(window, 'location');
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      href: 'https://shop.example/checkout/',
      origin: 'https://shop.example',
    },
  });
});

afterEach(() => {
  if (originalLocation)
    Object.defineProperty(window, 'location', originalLocation);
  document.body.innerHTML = '';
  useCheckoutStore.getState().reset();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('detectMultiStepCheckout', () => {
  it('returns null for an ordinary single-page checkout', () => {
    const ctx = detectionContext(formWith({}));

    expect(detectMultiStepCheckout(ctx)).toBeNull();
    expect(ctx.setStep).not.toHaveBeenCalled();
  });

  it('reads the next-step URL and the step number, and tells the store', () => {
    const ctx = detectionContext(
      formWith({
        'data-next-checkout-step': '/checkout/payment',
        'data-next-step-number': '2',
      })
    );

    expect(detectMultiStepCheckout(ctx)).toEqual({
      isMultiStep: true,
      currentStep: 2,
      nextStepUrl: '/checkout/payment',
    });
    expect(ctx.setStep).toHaveBeenCalledWith(2);
  });

  it('accepts the legacy os-checkout-step spelling and defaults to step 1', () => {
    const ctx = detectionContext(
      formWith({ 'os-checkout-step': '/checkout/shipping' })
    );

    expect(detectMultiStepCheckout(ctx)).toEqual({
      isMultiStep: true,
      currentStep: 1,
      nextStepUrl: '/checkout/shipping',
    });
  });

  /**
   * DEFECT (left as found): a non-numeric step number becomes `NaN`, and `validateStep`
   * checks nothing for any number that is not 1, 2 or 3 — so it returns valid.
   *
   * A shopper on `data-next-step-number="two"` presses next with every field empty and is
   * sent to the payment step anyway. `NaN` is also written into the checkout store as the
   * step, and `NaN + 1` on the way out.
   */
  it('DEFECT: a non-numeric step number becomes NaN rather than falling back to 1', () => {
    const ctx = detectionContext(
      formWith({
        'data-next-checkout-step': '/checkout/payment',
        'data-next-step-number': 'two',
      })
    );

    const state = detectMultiStepCheckout(ctx);

    expect(Number.isNaN(state?.currentStep)).toBe(true);
    expect(ctx.setStep).toHaveBeenCalledWith(NaN);
  });
});

describe('handleStepNavigation — the failing step', () => {
  it('writes every message to the store and to the page, and stays put', async () => {
    const validator: ValidatorStub = {
      validateStep: vi.fn().mockResolvedValue({
        isValid: false,
        errors: { email: 'Email is required' },
        firstErrorField: 'email',
      }),
      showError: vi.fn(),
      focusFirstErrorField: vi.fn(),
    };
    const ctx = navigationContext({ currentStep: 1, validator });
    const store = storeDouble();

    await handleStepNavigation(ctx, store);

    expect(store.setError).toHaveBeenCalledWith('email', 'Email is required');
    expect(validator.showError).toHaveBeenCalledWith(
      'email',
      'Email is required'
    );
    expect(store.setStep).not.toHaveBeenCalled();
    expect(window.location.href).toBe('https://shop.example/checkout/');
    expect(store.setProcessing).toHaveBeenLastCalledWith(false);
    expect(ctx.loadingOverlay.hide).toHaveBeenCalledWith(true);
  });

  it('hands the validator the billing pair the form gave it', async () => {
    const billingAddress = {
      first_name: 'Ada',
      last_name: 'Lovelace',
      address1: '2 Side St',
      city: 'Springfield',
      province: 'CA',
      postal: '90210',
      country: 'US',
      phone: '',
    };
    const ctx = navigationContext({
      currentStep: 3,
      getBillingValidationInput: () => ({
        billingAddress,
        sameAsShipping: false,
      }),
      validator: {
        validateStep: vi.fn().mockResolvedValue({ isValid: false, errors: {} }),
        showError: vi.fn(),
        focusFirstErrorField: vi.fn(),
      },
    });

    await handleStepNavigation(ctx, storeDouble());

    const call = ctx.validator.validateStep.mock.calls[0];
    expect(call?.[4]).toBe(billingAddress);
    expect(call?.[5]).toBe(false);
  });

  it('leaves the shopper on the page with a general error when the check throws', async () => {
    const ctx = navigationContext({
      validator: {
        validateStep: vi
          .fn()
          .mockRejectedValue(new Error('validator exploded')),
        showError: vi.fn(),
        focusFirstErrorField: vi.fn(),
      },
    });
    const store = storeDouble();

    await handleStepNavigation(ctx, store);

    expect(store.setError).toHaveBeenCalledWith(
      'general',
      'Failed to proceed to next step. Please try again.'
    );
    expect(window.location.href).toBe('https://shop.example/checkout/');
  });
});

describe('handleStepNavigation — the passing step', () => {
  it('advances the store and navigates once the delay elapses', async () => {
    vi.useFakeTimers();
    const ctx = navigationContext({ currentStep: 2 });
    const store = storeDouble();

    const navigation = handleStepNavigation(ctx, store);
    await vi.advanceTimersByTimeAsync(1000);
    await navigation;

    expect(store.setStep).toHaveBeenCalledWith(3);
    expect(window.location.href).toContain('/checkout/payment');
    expect(store.setProcessing).toHaveBeenLastCalledWith(false);
  });

  /**
   * DEFECT (left as found): nothing can cancel the one-second wait, and nothing rechecks
   * the page before navigating.
   *
   * A shopper who presses "next" and then leaves the step — a browser back, or anything
   * that destroys the form — is still sent forward a second later, because the navigation
   * is a bare `setTimeout` the form never gets a handle to. The same is true of the 100 ms
   * focus timer on the failing path.
   */
  it('DEFECT: the one-second navigation wait cannot be cancelled', async () => {
    vi.useFakeTimers();
    const ctx = navigationContext({ currentStep: 1 });

    const navigation = handleStepNavigation(ctx, storeDouble());
    // Nothing in the context, and nothing returned, can stop what happens next.
    await vi.advanceTimersByTimeAsync(1000);
    await navigation;

    expect(window.location.href).toContain('/checkout/payment');
  });

  /**
   * DEFECT (left as found): step 4 (or any number that is not 1, 2 or 3) validates
   * nothing and reports valid, so a four-step checkout's last gate lets everything past.
   */
  it('DEFECT: an unrecognised step number is a gate that checks nothing', async () => {
    vi.useFakeTimers();
    const validator: ValidatorStub = {
      // The real `validateStep` returns `{ isValid: true }` for any step but 1, 2 and 3.
      validateStep: vi
        .fn()
        .mockResolvedValue({
          isValid: true,
          errors: {},
          firstErrorField: undefined,
        }),
      showError: vi.fn(),
      focusFirstErrorField: vi.fn(),
    };
    const ctx = navigationContext({ currentStep: 4, validator });
    const store = storeDouble();

    const navigation = handleStepNavigation(ctx, store);
    await vi.advanceTimersByTimeAsync(1000);
    await navigation;

    expect(validator.validateStep).toHaveBeenCalledWith(
      4,
      expect.anything(),
      expect.anything(),
      undefined,
      undefined,
      true
    );
    expect(store.setStep).toHaveBeenCalledWith(5);
    expect(window.location.href).toContain('/checkout/payment');
  });
});
