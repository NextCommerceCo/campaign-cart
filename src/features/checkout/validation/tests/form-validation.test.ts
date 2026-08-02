import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CountryConfig } from '@/core/country-service';

import { validateForm, type FormValidationContext } from '../form-validation';

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

describe('validateForm', () => {
  it('accepts a complete form', async () => {
    const result = await validateForm(createContext(), completeForm(), configs);

    expect(result).toEqual({ isValid: true, errors: {} });
  });

  it('reports every problem at once, not just the first', async () => {
    const result = await validateForm(
      createContext(),
      { country: 'US' },
      configs
    );

    expect(Object.keys(result.errors).sort()).toEqual([
      'address1',
      'city',
      'email',
      'fname',
      'lname',
      'postal',
    ]);
  });

  it('requires a state where the country requires one, using that country’s word for it', async () => {
    const gb = new Map<string, CountryConfig>([
      ['GB', countryConfig({ stateRequired: true, stateLabel: 'County' })],
    ]);
    const form = { ...completeForm(), country: 'GB' };

    const result = await validateForm(createContext(), form, gb, gb.get('GB'));

    expect(result.errors.province).toBe('County is required');
  });

  it('checks the postal code against the country and quotes an example', async () => {
    const ctx = createContext({
      countryService: { validatePostalCode: vi.fn().mockReturnValue(false) },
    });

    const result = await validateForm(
      ctx,
      completeForm(),
      configs,
      configs.get('US')
    );

    expect(result.errors.postal).toBe(
      'Please enter a valid zip code (e.g. 90210)'
    );
  });

  it('names the topmost failing field on the page, not the first key collected', async () => {
    buildField('fname', 400);
    buildField('email', 100);

    const result = await validateForm(
      createContext(),
      { ...completeForm(), fname: '', email: 'not-an-email' },
      configs
    );

    expect(Object.keys(result.errors)).toEqual(['fname', 'email']);
    expect(result.firstErrorField).toBe('email');
  });

  it('normalises the phone to the widget’s formatted number so the order carries E.164', async () => {
    const ctx = createContext({
      phoneInputManager: {
        validatePhoneNumber: vi.fn().mockReturnValue(true),
        getFormattedPhoneNumber: vi.fn().mockReturnValue('+15551234567'),
      },
    });
    const form = { ...completeForm(), phone: '(555) 123-4567' };

    await validateForm(ctx, form, configs);

    expect(form.phone).toBe('+15551234567');
  });

  it('maps billing errors onto the billing- prefixed field names the form renders', async () => {
    const result = await validateForm(
      createContext(),
      completeForm(),
      configs,
      undefined,
      false,
      { country: 'US' },
      false
    );

    expect(result.errors['billing-fname']).toBe(
      'Billing first name is required'
    );
    expect(result.errors['billing-postal']).toBe(
      'Billing zip/postal code is required'
    );
  });

  it('checks the card when a card service is present', async () => {
    const ctx = createContext({
      creditCardService: {
        checkSpreedlyFieldsReady: () => ({
          hasEmptyFields: true,
          errors: [{ field: 'number', message: 'Card number is required' }],
        }),
        validateCreditCard: () => ({ isValid: true }),
      } as any,
    });

    const result = await validateForm(
      ctx,
      completeForm(),
      configs,
      undefined,
      true
    );

    expect(result.isValid).toBe(false);
    expect(result.errors['cc-number']).toBe('Card number is required');
  });

  /**
   * DEFECT (left as found) — every card check sits inside `if (ctx.creditCardService)`,
   * with no `else`. When the service was never installed — the Spreedly environment key is
   * missing or arrived late, so `CheckoutFormEnhancer` never called
   * `setCreditCardService` — `includePayment: true` runs *zero* card checks and the form
   * is pronounced valid.
   *
   * This is a "valid" verdict reached by falling through rather than by passing: the code
   * cannot tell "the card is fine" from "nobody looked".
   *
   * What the shopper sees: they press pay with the card fields empty, validation passes,
   * and the failure surfaces later as a tokenization or gateway error with no field marked
   * — or, worse, an order attempt with no card at all.
   */
  it('DEFECT: with no card service the card is not checked and the form passes', async () => {
    const result = await validateForm(
      createContext(),
      { ...completeForm(), 'exp-month': '', 'exp-year': '' },
      configs,
      undefined,
      true // includePayment
    );

    expect(result).toEqual({ isValid: true, errors: {} });
  });

  /**
   * DEFECT (left as found) — `!sameAsShipping && billingAddress`. A shopper who ticked
   * "use a different billing address" but whose billing fields have not reached the store
   * yet (nothing typed, or the clone not populated) has `billingAddress` falsy, so the
   * whole billing block is skipped and the form passes.
   *
   * What the shopper sees: the order is submitted with a billing address that is empty or
   * stale — the shipping one — despite them having asked for a different one. Address
   * Verification at the gateway is what catches it, as a declined payment.
   */
  it('DEFECT: a different-billing-address form with no captured address is judged valid', async () => {
    const result = await validateForm(
      createContext(),
      completeForm(),
      configs,
      undefined,
      false,
      undefined, // nothing captured yet
      false // …but the shopper asked for a separate billing address
    );

    expect(result.isValid).toBe(true);
  });

  /**
   * DEFECT (left as found) — whether the phone is required is read from
   * `document.querySelector('[name="phone"]')`. Every other field in this SDK is located by
   * `data-next-checkout-field` (or the legacy `os-checkout-field`) through `FieldFinder`,
   * and a `name` attribute is not required for a field to work.
   *
   * Two consequences. A form whose phone input carries only the SDK attribute never has
   * its phone treated as required, no matter what `required` says on it. And the query is
   * on `document`, not the form, so on a page with a newsletter form above the checkout the
   * *other* form's phone input decides the rule.
   *
   * What the shopper sees: they leave a phone field marked required blank and the order is
   * accepted without one — so the merchant cannot reach them about the delivery.
   */
  it('DEFECT: a required phone marked only with the SDK attribute is never enforced', async () => {
    const sdkOnly = document.createElement('input');
    sdkOnly.setAttribute('data-next-checkout-field', 'phone');
    sdkOnly.setAttribute('required', '');
    document.body.appendChild(sdkOnly);

    const result = await validateForm(createContext(), completeForm(), configs);

    expect(result.errors.phone).toBeUndefined();
    expect(result.isValid).toBe(true);
  });

  it('does enforce it once the same input also carries name="phone"', async () => {
    const named = document.createElement('input');
    named.setAttribute('data-next-checkout-field', 'phone');
    named.setAttribute('name', 'phone');
    named.setAttribute('required', '');
    document.body.appendChild(named);

    const result = await validateForm(createContext(), completeForm(), configs);

    expect(result.errors.phone).toBe('Phone number is required');
  });

  /**
   * DEFECT (left as found) — the required loop calls `formData[field].trim()`. Form data
   * rehydrated from `sessionStorage`, or written by a merchant's own script, can hold a
   * number; it is truthy, so the guard passes and `.trim` is not a function.
   *
   * What the shopper sees: pressing pay throws out of validation. No message, no submit,
   * and the form stays in its processing state until the page is reloaded.
   */
  it('DEFECT: a numeric field value throws instead of validating', async () => {
    await expect(
      validateForm(
        createContext(),
        { ...completeForm(), postal: 90210 },
        configs
      )
    ).rejects.toThrow(TypeError);
  });

  /**
   * DEFECT (left as found) — `province` is only ever checked for emptiness. There is no
   * format or membership check against the country's state list, even though
   * `CountryService` holds one.
   *
   * What the shopper sees: a typo'd or invented state is accepted and reaches the order,
   * where the carrier rejects the address after the payment has been taken.
   */
  it('DEFECT: the state is only checked for emptiness, never against the country', async () => {
    const gb = new Map<string, CountryConfig>([
      ['GB', countryConfig({ stateRequired: true })],
    ]);

    const result = await validateForm(
      createContext(),
      { ...completeForm(), country: 'GB', province: 'not a real county' },
      gb
    );

    expect(result.isValid).toBe(true);
  });
});
