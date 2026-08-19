import { describe, expect, it, vi } from 'vitest';

import {
  applyRule,
  createValidationRules,
  type FieldRuleContext,
} from '../field-rules';

function createContext(
  overrides: Partial<FieldRuleContext> = {}
): FieldRuleContext {
  return {
    countryService: { validatePostalCode: vi.fn().mockReturnValue(true) },
    ...overrides,
  };
}

describe('createValidationRules', () => {
  it('covers the fields the shopper types into', () => {
    const rules = createValidationRules();

    expect([...rules.keys()].sort()).toEqual([
      'address1',
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
   * DEFECT (left as found) — `applyRule` implements `postal` and `custom`, but the table
   * is the only producer of rules and it produces neither: `postal` gets `required` alone.
   * There is no public method to register a rule either, so both branches, and the
   * `default` arm, are dead code.
   *
   * What the shopper sees: type `ABCDE` into a US ZIP field and blur it. The field goes
   * green, because the only rule that ran was "not empty". The format is not checked until
   * they press pay, at which point `form-validation.ts` runs the country check and the
   * field they thought was accepted turns red. The per-field and submit-time paths
   * disagree about the same value.
   */
  it('DEFECT: no rule of type postal or custom is ever created, so blur never checks the format', () => {
    const everyRuleType = [...createValidationRules().values()]
      .flat()
      .map(r => r.type);

    expect(everyRuleType).not.toContain('postal');
    expect(everyRuleType).not.toContain('custom');

    // The branch works — nothing reaches it.
    const ctx = createContext({
      countryService: { validatePostalCode: vi.fn().mockReturnValue(false) },
    });
    const context = {
      country: 'US',
      countryConfigs: new Map([['US', {} as any]]),
    };
    expect(applyRule(ctx, { type: 'postal' }, 'ABCDE', context)).toBe(false);
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
    expect(applyRule(ctx, { type: 'name' }, '')).toBe(true);
    expect(applyRule(ctx, { type: 'city' }, '')).toBe(true);
    expect(applyRule(ctx, { type: 'phone' }, '')).toBe(true);
  });

  it('postal passes when the country is unknown to the config map', () => {
    const validatePostalCode = vi.fn().mockReturnValue(false);
    const ctx = createContext({ countryService: { validatePostalCode } });
    expect(
      applyRule(ctx, { type: 'postal' }, 'ABCDE', {
        country: 'US',
        countryConfigs: new Map(),
      })
    ).toBe(true);
    expect(validatePostalCode).not.toHaveBeenCalled();
  });

  /**
   * The blur verdict and the submit verdict now come from the same place: both resolve the
   * live `intl-tel-input` instance through `phoneSource` and hand it to `checkPhone`.
   * Before that, this path could only count digits, so a number one check accepted the
   * other could refuse.
   */
  it('judges the phone through the same instance the submit path uses', () => {
    const phoneSource = vi.fn().mockReturnValue({
      getNumber: () => '+22212345678',
      isValidNumber: () => true,
      isValidNumberPrecise: () => true,
      getSelectedCountryData: () => ({ dialCode: '222', iso2: 'mr' }),
    });
    const ctx = createContext({ phoneSource });

    expect(applyRule(ctx, { type: 'phone' }, '22 12 34 56')).toBe(true);
    expect(phoneSource).toHaveBeenCalledWith('shipping');
  });

  it('rejects a junk number even though the widget calls it the right length', () => {
    const ctx = createContext({
      phoneSource: () => ({
        getNumber: () => '+10000000000',
        isValidNumber: () => true,
        isValidNumberPrecise: () => true,
        getSelectedCountryData: () => ({ dialCode: '1', iso2: 'us' }),
      }),
    });

    expect(applyRule(ctx, { type: 'phone' }, '0000000000')).toBe(false);
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
