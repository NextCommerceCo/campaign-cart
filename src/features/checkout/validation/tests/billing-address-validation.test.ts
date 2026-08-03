import { describe, expect, it, vi } from 'vitest';

import type { CountryConfig } from '@/core/country-service';

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
    countryService: { validatePostalCode: vi.fn().mockReturnValue(true) },
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

  it('names every missing field, prefixed so the shopper knows which section', () => {
    const result = validateBillingAddress(
      createContext(),
      { country: 'US' },
      configs
    );

    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual({
      first_name: 'Billing first name is required',
      last_name: 'Billing last name is required',
      address1: 'Billing address is required',
      city: 'Billing city is required',
      province: 'Billing state/province is required',
      postal: 'Billing zip/postal code is required',
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
      countryService: { validatePostalCode: vi.fn().mockReturnValue(false) },
    });

    const result = validateBillingAddress(ctx, completeAddress, configs);

    expect(result.errors.postal).toBe(
      'Please enter a valid billing zip code (e.g. 90210)'
    );
  });

  it('prefers the country-aware phone validator when the form installed one', () => {
    const phoneValidator = vi.fn().mockReturnValue(true);
    const ctx = createContext({ phoneValidator });

    const result = validateBillingAddress(
      ctx,
      { ...completeAddress, phone: '22 12 34 56' },
      configs
    );

    expect(phoneValidator).toHaveBeenCalledWith('22 12 34 56', 'billing');
    expect(result.isValid).toBe(true);
  });

  /**
   * DEFECT (left as found) — with no `phoneValidator` installed the billing phone falls
   * back to `isValidPhone`, whose ten-digit floor is a US assumption. Unlike the shipping
   * path, there is no `phoneInputManager` fallback in between, so the billing phone is
   * judged more crudely than the shipping phone on the very same form.
   *
   * What the shopper sees: they enter a valid national billing number for a country whose
   * numbers are shorter than ten digits and are told "Please enter a valid billing phone
   * number" with no way to satisfy it — while the identical number in the shipping phone
   * field is accepted.
   */
  it('DEFECT: without the installed validator the billing phone gets the US ten-digit rule', () => {
    const result = validateBillingAddress(
      createContext(),
      { ...completeAddress, phone: '22 12 34 56' },
      configs
    );

    expect(result.errors.phone).toBe(
      'Please enter a valid billing phone number'
    );
    expect(result.isValid).toBe(false);
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

  /**
   * DEFECT (left as found) — the name check is only reached in the `else if` arm of the
   * required check, and only for `first_name` / `last_name`. `city` is never format-checked
   * here, though the shipping path checks it with `isValidCity`.
   *
   * What the shopper sees: a billing city of `12345` is accepted and reaches the order,
   * while the same value in the shipping city field is rejected.
   */
  it('DEFECT: the billing city is never format-checked, unlike the shipping city', () => {
    const result = validateBillingAddress(
      createContext(),
      { ...completeAddress, city: '12345' },
      configs
    );

    expect(result.isValid).toBe(true);
  });
});
