import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';

import type { CountryConfig } from '@/core/country-service';
import { useCheckoutStore, type CheckoutState } from '@/state/checkout';

import type { FormValidationResult } from '../../validation/validation.types';
import { CheckoutFormEnhancer } from '../checkout-form.enhancer';

/**
 * What the multi-step "next" button hands to the validator.
 *
 * Finding 131: step 3 is the only validation gate a step-navigating shopper passes before
 * paying, and it used to be called with no billing information at all — `validateStep` had
 * no parameter for it. The pair now comes from the checkout store, which is the same place
 * `handleFormSubmit` and `buildOrderData` read it from; a second source would let the form
 * validate one answer and build the order on the other.
 */

type ValidateStepMock = Mock<
  (
    step: number,
    formData: Record<string, unknown>,
    countryConfigs: Map<string, CountryConfig>,
    currentCountryConfig: CountryConfig | undefined,
    billingAddress?: CheckoutState['billingAddress'],
    sameAsShipping?: boolean
  ) => Promise<FormValidationResult>
>;

interface ValidatorMock {
  validateStep: ValidateStepMock;
  showError: Mock;
  focusFirstErrorField: Mock;
  destroy: Mock;
}

interface FormInternals {
  destroy(): void;
  handleStepNavigation(
    checkoutStore: CheckoutState,
    cartStore: unknown
  ): Promise<void>;
  logger: { debug: Mock; info: Mock; warn: Mock; error: Mock };
  validator: ValidatorMock;
  currentStep: number;
  nextStepUrl?: string;
  loadingOverlay: { show: Mock; hide: Mock };
}

const created: FormInternals[] = [];

/** A validator that fails, so navigation returns before touching `window.location`. */
function createValidator(): ValidatorMock {
  const validateStep: ValidateStepMock = vi.fn();
  validateStep.mockResolvedValue({
    isValid: false,
    errors: { 'billing-fname': 'Billing first name is required' },
  });

  return {
    validateStep,
    showError: vi.fn(),
    focusFirstErrorField: vi.fn(),
    destroy: vi.fn(),
  };
}

function createEnhancerOnStep(step: number): FormInternals {
  const form = document.createElement('form');
  document.body.appendChild(form);

  const steps = new CheckoutFormEnhancer(form) as unknown as FormInternals;
  steps.logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  steps.validator = createValidator();
  steps.loadingOverlay = { show: vi.fn(), hide: vi.fn() };
  steps.currentStep = step;
  steps.nextStepUrl = '/checkout/payment';

  created.push(steps);
  return steps;
}

/** The arguments the step gate handed the validator on its only call. */
function billingArgsOf(steps: FormInternals): {
  billingAddress: CheckoutState['billingAddress'];
  sameAsShipping: boolean | undefined;
} {
  const call = steps.validator.validateStep.mock.calls[0];
  return { billingAddress: call?.[4], sameAsShipping: call?.[5] };
}

const separateBilling: CheckoutState['billingAddress'] = {
  first_name: '',
  last_name: 'Lovelace',
  address1: '2 Side St',
  city: 'Springfield',
  province: 'CA',
  postal: '90210',
  country: 'US',
  phone: '',
};

afterEach(() => {
  created.splice(0).forEach(steps => steps.destroy());
  useCheckoutStore.getState().reset();
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('handleStepNavigation — the billing pair it passes to validateStep', () => {
  it('passes the billing address and the shopper’s choice from the checkout store', async () => {
    useCheckoutStore.setState({
      sameAsShipping: false,
      billingAddress: separateBilling,
    });
    const steps = createEnhancerOnStep(3);

    await steps.handleStepNavigation(useCheckoutStore.getState(), {});

    expect(billingArgsOf(steps)).toEqual({
      billingAddress: separateBilling,
      sameAsShipping: false,
    });
  });

  it('passes sameAsShipping true when the shopper bills to the shipping address', async () => {
    useCheckoutStore.setState({
      sameAsShipping: true,
      billingAddress: separateBilling,
    });
    const steps = createEnhancerOnStep(3);

    await steps.handleStepNavigation(useCheckoutStore.getState(), {});

    expect(billingArgsOf(steps).sameAsShipping).toBe(true);
  });

  it('reports the billing errors the validator returns', async () => {
    useCheckoutStore.setState({
      sameAsShipping: false,
      billingAddress: undefined,
    });
    const steps = createEnhancerOnStep(3);

    await steps.handleStepNavigation(useCheckoutStore.getState(), {});

    expect(billingArgsOf(steps)).toEqual({
      billingAddress: undefined,
      sameAsShipping: false,
    });
    expect(steps.validator.showError).toHaveBeenCalledWith(
      'billing-fname',
      'Billing first name is required'
    );
    expect(useCheckoutStore.getState().errors['billing-fname']).toBe(
      'Billing first name is required'
    );
  });
});
