import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CountryConfig } from '@/core/country-service';

import type { FormValidationContext } from '../form-validation';
import { validateStep } from '../step-validation';

function countryConfig(overrides: Partial<CountryConfig> = {}): CountryConfig {
  return {
    stateLabel: 'State',
    stateRequired: false,
    postcodeLabel: 'ZIP code',
    postcodeRegex: null,
    postcodeMinLength: 5,
    postcodeMaxLength: 5,
    postcodeExample: '90210',
    postcodeFormat: null,
    currencyCode: 'USD',
    currencySymbol: '$',
    ...overrides,
  };
}

function createContext(
  overrides: Partial<FormValidationContext> = {}
): FormValidationContext {
  return {
    countryService: { validatePostalCode: vi.fn().mockReturnValue(true) },
    ...overrides,
  };
}

const configs = new Map<string, CountryConfig>([['US', countryConfig()]]);

const completeForm = () => ({
  fname: 'Ada',
  lname: 'Lovelace',
  email: 'ada@example.com',
  address1: '1 Main St',
  city: 'Springfield',
  postal: '90210',
  country: 'US',
});

/** happy-dom does no layout, so every rect is zero — stamp the tops the test needs. */
function buildField(name: string, top: number): HTMLInputElement {
  const input = document.createElement('input');
  input.setAttribute('data-next-checkout-field', name);
  input.getBoundingClientRect = () => ({ top }) as DOMRect;
  document.body.appendChild(input);
  return input;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('validateStep — step 1', () => {
  it('accepts a complete contact and shipping address', async () => {
    const result = await validateStep(
      createContext(),
      1,
      completeForm(),
      configs
    );

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('names every missing address field', async () => {
    const result = await validateStep(createContext(), 1, {}, configs);

    expect(Object.keys(result.errors).sort()).toEqual([
      'address1',
      'city',
      'country',
      'email',
      'fname',
      'lname',
      'postal',
    ]);
  });

  it('adds the state when the country requires one', async () => {
    const gb = new Map<string, CountryConfig>([
      ['GB', countryConfig({ stateRequired: true, stateLabel: 'County' })],
    ]);

    const result = await validateStep(
      createContext(),
      1,
      { ...completeForm(), country: 'GB' },
      gb,
      gb.get('GB')
    );

    expect(result.errors.province).toBe('County is required');
  });

  it('checks the formats a required-only pass would miss', async () => {
    const result = await validateStep(
      createContext(),
      1,
      { ...completeForm(), email: 'not-an-email', city: 'Area 51' },
      configs
    );

    expect(result.errors.email).toBe('Please enter a valid email address');
    expect(result.errors.city).toBe('Please enter a valid city name');
  });
});

describe('validateStep — step 3', () => {
  it('delegates to the full form check, including payment', async () => {
    const validateCreditCard = vi.fn().mockReturnValue({
      isValid: false,
      errors: { 'cc-month': 'Expiration month is required' },
    });
    const ctx = createContext({
      creditCardService: {
        checkSpreedlyFieldsReady: () => ({ hasEmptyFields: false, errors: [] }),
        validateCreditCard,
      } as any,
    });

    const result = await validateStep(ctx, 3, completeForm(), configs);

    expect(validateCreditCard).toHaveBeenCalled();
    expect(result.errors['cc-month']).toBe('Expiration month is required');
  });

  /**
   * DEFECT (left as found) — step 3 calls
   * `validateForm(ctx, formData, countryConfigs, currentCountryConfig, true, undefined, true)`.
   * The last two arguments are hard-coded: `billingAddress` is always `undefined` and
   * `sameAsShipping` is always `true`, and `validateStep` has no parameter for either, so
   * a caller cannot supply them.
   *
   * On a multi-step checkout, step 3 is the final gate before the order is built — and it
   * is the *only* validation a step-navigating shopper gets for their billing address,
   * because no earlier step covers it.
   *
   * What the shopper sees: they choose a separate billing address, leave it empty or fill
   * it with nonsense, and step 3 passes them through. The order is built with an invalid
   * billing address, which the gateway declines during Address Verification — after the
   * shopper has been told everything was fine.
   */
  it('DEFECT: step 3 discards the billing address entirely, valid or not', async () => {
    const result = await validateStep(
      createContext(),
      3,
      completeForm(),
      configs
    );

    expect(result.isValid).toBe(true);
    expect(result.errors['billing-fname']).toBeUndefined();
  });
});

describe('validateStep — the gaps between the steps', () => {
  /**
   * DEFECT (left as found) — only steps 1, 2 and 3 have a branch. Any other step number
   * leaves `requiredFields` as `[]`, so the required loop runs zero times. The format
   * checks below it are all guarded on the value being present, so an empty form clears
   * every one.
   *
   * What the shopper sees: on a checkout with four or more steps, the extra step's "next"
   * button validates nothing — an entirely empty form is waved through to the following
   * screen.
   */
  it('DEFECT: an unknown step validates nothing and passes an empty form', async () => {
    const result = await validateStep(createContext(), 4, {}, configs);

    expect(result).toEqual({
      isValid: true,
      firstErrorField: undefined,
      errors: {},
    });
  });

  /**
   * DEFECT (left as found) — the phone block is guarded by
   * `requiredFields.includes('phone')`, and only step 1 ever pushes `phone`. Step 2 rebuilds
   * the list without it, so a phone number is never re-checked there.
   *
   * What the shopper sees: they go back from step 2, replace a valid phone with garbage,
   * and step 2's "next" accepts it. The bad number is only caught at the final submit, if
   * the phone happens to be required there too.
   */
  it('DEFECT: step 2 never checks the phone, even when the markup requires it', async () => {
    const named = document.createElement('input');
    named.setAttribute('name', 'phone');
    named.setAttribute('required', '');
    document.body.appendChild(named);

    const step1 = await validateStep(
      createContext(),
      1,
      { ...completeForm(), phone: 'not a phone' },
      configs
    );
    const step2 = await validateStep(
      createContext(),
      2,
      { ...completeForm(), phone: 'not a phone' },
      configs
    );

    expect(step1.errors.phone).toBe('Please enter a valid phone number');
    expect(step2.errors.phone).toBeUndefined();
  });

  /**
   * DEFECT (left as found) — step validation sets `firstErrorField` to whichever check ran
   * first, in source order. `form-validation.ts` instead sorts the failing fields by their
   * position on the page (`findFirstErrorFieldInDOM`). The two paths therefore disagree
   * about where to send the shopper, on the same markup.
   *
   * Here `email` is the first entry in step 1's required list but sits at the bottom of the
   * page; the form path would have picked `fname`.
   *
   * What the shopper sees: pressing "next" scrolls them past the first visible problem to
   * one further down, and the field above it stays red and unexplained.
   */
  it('DEFECT: step validation picks the first error by source order, the form path by page order', async () => {
    buildField('fname', 400);
    buildField('email', 100);

    const result = await validateStep(
      createContext(),
      1,
      { ...completeForm(), fname: '', email: '' },
      configs
    );

    // 'email' comes first in the required list; 'fname' is higher on the page.
    expect(result.firstErrorField).toBe('email');
  });

  /**
   * The two paths also differ in shape: step validation always emits the
   * `firstErrorField` key (as `undefined` when valid), while form validation omits it. A
   * caller writing `'firstErrorField' in result` gets opposite answers from the two.
   */
  it('DEFECT: a valid step still carries an explicit undefined firstErrorField key', async () => {
    const result = await validateStep(
      createContext(),
      1,
      completeForm(),
      configs
    );

    expect('firstErrorField' in result).toBe(true);
    expect(result.firstErrorField).toBeUndefined();
  });
});
