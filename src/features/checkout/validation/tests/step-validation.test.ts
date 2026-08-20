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
    // Step 3 asks `validateForm` for the payment check too, and finding 132 made a
    // missing card service an invalid verdict rather than a silent pass. Steps 1 and 2
    // never reach the card block, so a satisfied service by default lets each test
    // assert the thing it is actually about; the cases that care override it.
    creditCardService: {
      checkSpreedlyFieldsReady: () => ({ hasEmptyFields: false, errors: [] }),
      validateCreditCard: vi
        .fn()
        .mockReturnValue({ isValid: true, errors: {} }),
    } as unknown as FormValidationContext['creditCardService'],
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
   * Finding 131, fixed. Step 3 used to call `validateForm(…, true, undefined, true)` with
   * the billing pair hard-coded, and had no parameter for either, so a caller could not
   * supply them. On a multi-step checkout step 3 is the final gate before the order is
   * built, and no earlier step covers billing — so a shopper could choose a separate
   * billing address, fill it with nonsense, and be waved through to a gateway decline.
   */
  it('checks the separate billing address the caller passes in', async () => {
    const result = await validateStep(
      createContext(),
      3,
      completeForm(),
      configs,
      undefined,
      {
        first_name: 'Ada',
        last_name: '',
        address1: '',
        city: '',
        country: 'US',
      },
      false
    );

    expect(result.isValid).toBe(false);
    expect(result.errors['billing-lname']).toBe(
      'Billing last name is required'
    );
    expect(result.errors['billing-address1']).toBe(
      'Billing address is required'
    );
    expect(result.errors['billing-city']).toBe('Billing city is required');
    expect(result.errors['billing-postal']).toBe(
      'Billing zip/postal code is required'
    );
  });

  it('accepts a complete separate billing address', async () => {
    const result = await validateStep(
      createContext(),
      3,
      completeForm(),
      configs,
      undefined,
      {
        first_name: 'Ada',
        last_name: 'Lovelace',
        address1: '2 Side St',
        city: 'Springfield',
        postal: '90210',
        country: 'US',
      },
      false
    );

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  /**
   * The decision behind finding 131's fix: "the shopper asked for a separate billing
   * address and nothing has been captured" is **not** the same as "billing is fine".
   *
   * It is reachable on exactly the path this fix is for: the checkout store drops an
   * all-empty billing address when it persists (`partialize`), so a step-3 page loaded
   * after a reload rehydrates `sameAsShipping: false` with `billingAddress: undefined`.
   * Passing there would build an order that declares a separate billing address and
   * carries none.
   */
  it('rejects a different-billing choice with nothing captured', async () => {
    const result = await validateStep(
      createContext(),
      3,
      completeForm(),
      configs,
      undefined,
      undefined, // nothing captured
      false // …but the shopper asked for a separate billing address
    );

    expect(result.isValid).toBe(false);
    expect(result.errors['billing-fname']).toBe(
      'Billing first name is required'
    );
    expect(result.errors['billing-country']).toBe(
      'Billing country is required'
    );
  });

  it('ignores the billing address when it is the same as shipping', async () => {
    const result = await validateStep(
      createContext(),
      3,
      completeForm(),
      configs,
      undefined,
      { first_name: '', last_name: '', address1: '', city: '', country: '' },
      true
    );

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('defaults to the shipping address when the caller supplies neither', async () => {
    const result = await validateStep(
      createContext(),
      3,
      completeForm(),
      configs
    );

    expect(result.isValid).toBe(true);
    expect(result.errors['billing-fname']).toBeUndefined();
  });

  /**
   * Finding 132, fixed. Step 3 asks for the payment check unconditionally, so a card
   * checkout whose Spreedly service never arrived used to pass with empty card fields —
   * the verdict could not tell "the card is fine" from "nobody looked". It now reports
   * that the payment system is not ready, which is a different sentence from "your card
   * number is wrong" on purpose: no card field was examined.
   */
  it('refuses to pass a card checkout it could not check', async () => {
    const ctx = createContext({ creditCardService: undefined });

    const result = await validateStep(ctx, 3, completeForm(), configs);

    expect(result.isValid).toBe(false);
    expect(result.errors.general).toMatch(/payment system is not ready/i);
    expect(result.errors['cc-number']).toBeUndefined();
  });

  /**
   * The same missing service must NOT block a shopper who is not paying by card —
   * `validateForm`'s card block is gated on the payment method, and step 3 passes
   * `includePayment: true` for every method.
   */
  it('does not block a non-card checkout when there is no card service', async () => {
    const ctx = createContext({ creditCardService: undefined });

    const result = await validateStep(
      ctx,
      3,
      { ...completeForm(), paymentMethod: 'paypal' },
      configs
    );

    expect(result.isValid).toBe(true);
    expect(result.errors.general).toBeUndefined();
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
   * Every step that carries a phone number checks it. The check used to be guarded by
   * `requiredFields.includes('phone')`, which only step 1 ever pushed — so a shopper could
   * go back from step 2, replace a good number with a bad one, and walk it forward.
   */
  it('checks the phone on both steps, required or not', async () => {
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
    expect(step2.errors.phone).toBe('Please enter a valid phone number');
  });

  it('rejects a junk phone on a step gate', async () => {
    const result = await validateStep(
      createContext(),
      1,
      { ...completeForm(), phone: '1234567890' },
      configs
    );

    expect(result.errors.phone).toBe('Please enter a valid phone number');
    expect(result.isValid).toBe(false);
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
