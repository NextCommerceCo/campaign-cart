import { describe, expect, it, vi } from 'vitest';

import type { CountryConfig } from '@/core/i18n-rules';

import {
  applyRule,
  createValidationRules,
  type FieldRuleContext,
} from '../field-rules';

function createContext(
  overrides: Partial<FieldRuleContext> = {}
): FieldRuleContext {
  return {
    i18nRules: { validatePostalCode: vi.fn().mockReturnValue(true) },
    ...overrides,
  };
}

describe('the phone rule and which widget it asks', () => {
  /** Finding 133.8: the rule used to hard-select the shipping widget whatever the field. */
  it('asks the billing widget for a billing field', () => {
    const asked: string[] = [];
    const ctx = createContext({
      phoneSource: (type: string) => {
        asked.push(type);
        return { getNumber: () => '+442079460958', isValidNumber: () => true };
      },
    });

    applyRule(
      { ...ctx, fieldName: 'billing-phone' },
      { type: 'phone' },
      '020 7946 0958'
    );

    expect(asked).toEqual(['billing']);
  });

  it('asks the shipping widget for the shipping field', () => {
    const asked: string[] = [];
    const ctx = createContext({
      phoneSource: (type: string) => {
        asked.push(type);
        return { getNumber: () => '+14155552671', isValidNumber: () => true };
      },
    });

    applyRule({ ...ctx, fieldName: 'phone' }, { type: 'phone' }, '4155552671');

    expect(asked).toEqual(['shipping']);
  });
});

describe('createValidationRules', () => {
  it('covers the fields the shopper types into', () => {
    const rules = createValidationRules();

    expect([...rules.keys()].sort()).toEqual([
      'address1',
      'billing-address1',
      'billing-city',
      'billing-country',
      'billing-fname',
      'billing-lname',
      'billing-phone',
      'billing-postal',
      'city',
      'country',
      'email',
      'fname',
      'lname',
      'phone',
      'postal',
    ]);
    expect(rules.get('email')?.map(r => r.type)).toEqual(['required', 'email']);
  });

  it('does not make the phone required — the markup decides that at submit', () => {
    expect(
      createValidationRules()
        .get('phone')
        ?.map(r => r.type)
    ).toEqual(['phone']);
  });

  /**
   * Issue #115: `postal` used to get `required` alone, so blur ticked `ABCDE` in a US ZIP
   * field, and the browser-autofill poll's `change` ticked it again after submit had
   * marked it, wiping the submit message.
   */
  /** The orders API takes any characters in them, so a format rule could only refuse a shopper. */
  it('only requires a name and a city, on both addresses', () => {
    const rules = createValidationRules();

    for (const name of [
      'fname',
      'lname',
      'city',
      'billing-fname',
      'billing-city',
    ]) {
      expect(rules.get(name)?.map(r => r.type)).toEqual(['required']);
    }
  });

  it('checks the postcode against its country', () => {
    expect(
      createValidationRules()
        .get('postal')
        ?.map(r => r.type)
    ).toEqual(['required', 'postal']);
  });

  it('gives every billing field its shipping twin’s rules, and email none', () => {
    const rules = createValidationRules();
    const shipping = [...rules.keys()].filter(
      name => !name.startsWith('billing-')
    );

    for (const name of shipping.filter(name => name !== 'email')) {
      expect(rules.get(`billing-${name}`)).toEqual(rules.get(name));
    }
    expect(rules.has('billing-email')).toBe(false);
  });

  it('creates no custom rule, so that branch stays unreachable', () => {
    const everyRuleType = [...createValidationRules().values()]
      .flat()
      .map(r => r.type);

    expect(everyRuleType).not.toContain('custom');
  });
});

describe('applyRule', () => {
  it('required rejects only empty, null and undefined', () => {
    const ctx = createContext();
    expect(applyRule(ctx, { type: 'required' }, 'x')).toBe(true);
    expect(applyRule(ctx, { type: 'required' }, '   ')).toBe(false);
    expect(applyRule(ctx, { type: 'required' }, null)).toBe(false);
    expect(applyRule(ctx, { type: 'required' }, undefined)).toBe(false);
  });

  it('every format rule passes an empty value, so emptiness is reported once', () => {
    const ctx = createContext();
    expect(applyRule(ctx, { type: 'email' }, '')).toBe(true);
    expect(applyRule(ctx, { type: 'postal' }, '')).toBe(true);
    expect(applyRule(ctx, { type: 'phone' }, '')).toBe(true);
  });

  it('postal checks a billing postcode against the billing country', () => {
    const gbConfig = { postcodeExample: 'SW1A 0AA' } as CountryConfig;
    const asked: string[] = [];
    const validatePostalCode = vi.fn().mockReturnValue(false);
    const ctx = createContext({
      i18nRules: { validatePostalCode },
      addressCountry: type => {
        asked.push(type);
        return { country: 'GB', config: gbConfig };
      },
      fieldName: 'billing-postal',
    });

    expect(applyRule(ctx, { type: 'postal' }, '99999')).toBe(false);
    expect(asked).toEqual(['billing']);
    expect(validatePostalCode).toHaveBeenCalledWith('99999', 'GB', gbConfig);
  });

  it('postal passes while the country has no rules loaded', () => {
    const validatePostalCode = vi.fn().mockReturnValue(false);
    const ctx = createContext({
      i18nRules: { validatePostalCode },
      addressCountry: () => undefined,
      fieldName: 'postal',
    });

    expect(applyRule(ctx, { type: 'postal' }, 'ABCDE')).toBe(true);
    expect(validatePostalCode).not.toHaveBeenCalled();
  });

  /**
   * The blur verdict and the submit verdict now come from the same place: both resolve the
   * live phone field through `phoneSource` and hand it to `checkPhone`.
   * Before that, this path could only count digits, so a number one check accepted the
   * other could refuse.
   */
  it('judges the phone through the same instance the submit path uses', () => {
    const phoneSource = vi.fn().mockReturnValue({
      getNumber: () => '+22212345678',
      isValidNumber: () => true,
      getSelectedCountryData: () => ({ dialCode: '222', iso2: 'mr' }),
    });
    const ctx = createContext({ phoneSource });

    expect(applyRule(ctx, { type: 'phone' }, '22 12 34 56')).toBe(true);
    expect(phoneSource).toHaveBeenCalledWith('shipping');
  });

  it('takes the widget’s verdict, and only the widget’s', () => {
    const refused = createContext({
      phoneSource: () => ({
        getNumber: () => '+1415555267',
        isValidNumber: () => false,
      }),
    });

    expect(applyRule(refused, { type: 'phone' }, '415555267')).toBe(false);
  });

  /**
   * A shopper is not told their phone is wrong because our own script had not arrived —
   * `checkPhone` answers `unknown` there, and `unknown` passes.
   */
  it('passes a plausible number while nothing can judge it', () => {
    expect(applyRule(createContext(), { type: 'phone' }, '4155552671')).toBe(
      true
    );
  });
});
