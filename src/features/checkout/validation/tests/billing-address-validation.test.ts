import { describe, expect, it, vi } from 'vitest';

import type { CountryConfig } from '@/core/i18n-rules';

import {
  validateBillingAddress,
  type BillingAddressValidationContext,
} from '../billing-address-validation';

function countryConfig(overrides: Partial<CountryConfig> = {}): CountryConfig {
  return {
    stateLabel: 'State',
    stateRequired: true,
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
  overrides: Partial<BillingAddressValidationContext> = {}
): BillingAddressValidationContext {
  return {
    i18nRules: { validatePostalCode: vi.fn().mockReturnValue(true) },
    ...overrides,
  };
}

const configs = new Map<string, CountryConfig>([['US', countryConfig()]]);

const completeAddress = {
  first_name: 'Ada',
  last_name: 'Lovelace',
  address1: '1 Main St',
  city: 'Springfield',
  country: 'US',
  province: 'CA',
  postal: '90210',
};

describe('validateBillingAddress', () => {
  it('accepts a complete address', () => {
    expect(
      validateBillingAddress(createContext(), completeAddress, configs)
    ).toEqual({
      isValid: true,
      errors: {},
    });
  });

  it('names every missing field', () => {
    const result = validateBillingAddress(
      createContext(),
      { country: 'US' },
      configs
    );

    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual({
      first_name: 'First name is required',
      last_name: 'Last name is required',
      address1: 'Address is required',
      city: 'City is required',
      province: 'State or province is required',
      postal: 'Postal code is required',
    });
  });

  it('requires a state only where the country does', () => {
    const optional = new Map<string, CountryConfig>([
      ['GB', countryConfig({ stateRequired: false })],
    ]);
    const result = validateBillingAddress(
      createContext(),
      { ...completeAddress, country: 'GB', province: '' },
      optional
    );

    expect(result.errors.province).toBeUndefined();
    expect(result.isValid).toBe(true);
  });

  it('fails every required field when there is no address object at all', () => {
    const result = validateBillingAddress(createContext(), undefined, configs);

    expect(result.isValid).toBe(false);
    expect(Object.keys(result.errors)).toContain('first_name');
  });

  it('checks the postal code against the country and quotes an example', () => {
    const ctx = createContext({
      i18nRules: { validatePostalCode: vi.fn().mockReturnValue(false) },
    });

    const result = validateBillingAddress(ctx, completeAddress, configs);

    expect(result.errors.postal).toBe(
      'Postal code isn’t valid, for example 90210'
    );
  });

  it('asks the billing widget, not the shipping one', () => {
    const phoneSource = vi.fn().mockReturnValue({
      getNumber: () => '+22212345678',
      isValidNumber: () => true,
      getSelectedCountryData: () => ({ dialCode: '222', iso2: 'mr' }),
    });
    const ctx = createContext({ phoneSource });

    const result = validateBillingAddress(
      ctx,
      { ...completeAddress, phone: '22 12 34 56' },
      configs
    );

    expect(phoneSource).toHaveBeenCalledWith('billing');
    expect(result.isValid).toBe(true);
  });

  /**
   * The billing phone used to fall back to a ten-digit floor, which is a US assumption: a
   * shorter national number valid in the shopper's country was refused here while the
   * identical number was accepted in the shipping field on the same form.
   */
  it('accepts a short national number no widget could judge', () => {
    const result = validateBillingAddress(
      createContext(),
      { ...completeAddress, phone: '22 12 34 56' },
      configs
    );

    expect(result.errors.phone).toBeUndefined();
    expect(result.isValid).toBe(true);
  });

  /**
   * DEFECT (left as found) — the required-field loop calls `value.trim()` on whatever the
   * address holds. A billing address restored from JSON with a numeric postal code (`90210`
   * rather than `'90210'`) is truthy, so the guard passes and `.trim` is not a function.
   *
   * What the shopper sees: the pay button throws instead of validating. Nothing is
   * submitted, no message appears, and the form is left in its processing state.
   */
  it('DEFECT: a non-string field value throws instead of validating', () => {
    expect(() =>
      validateBillingAddress(
        createContext(),
        { ...completeAddress, postal: 90210 },
        configs
      )
    ).toThrow(TypeError);
  });

  describe('the billing phone', () => {
    function phoneField(name: string, required: boolean): void {
      const input = document.createElement('input');
      input.setAttribute('data-next-checkout-field', name);
      input.required = required;
      document.body.appendChild(input);
    }

    /** Only the shipping phone was looked at, so a blank required billing one went out. */
    it('is required when its own field is marked required', () => {
      phoneField('billing-phone', true);

      const result = validateBillingAddress(
        createContext(),
        { ...completeAddress, phone: '' },
        configs
      );

      expect(Object.keys(result.errors)).toEqual(['phone']);
    });

    it('is not required by a required shipping phone', () => {
      phoneField('phone', true);
      phoneField('billing-phone', false);

      expect(
        validateBillingAddress(
          createContext(),
          { ...completeAddress, phone: '' },
          configs
        ).isValid
      ).toBe(true);
    });
  });

  /** The orders API takes any characters in a name or a city; only their absence fails. */
  it('takes a name and a city in any characters', () => {
    const result = validateBillingAddress(
      createContext(),
      {
        ...completeAddress,
        first_name: 'John Jr.',
        last_name: 'ประยุทธ์',
        city: '100 Mile House',
      },
      configs
    );

    expect(result).toEqual({ isValid: true, errors: {} });
  });
});
