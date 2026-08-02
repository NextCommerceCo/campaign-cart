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
   * DEFECT (left as found) — the `phone` rule consults `phoneInputManager` but never
   * `phoneValidator`, which is the country-aware check the form installs via
   * `setPhoneValidator`. `form-validation.ts` prefers `phoneValidator` over
   * `phoneInputManager`; this path does not know it exists.
   *
   * What the shopper sees: on a form where both are wired, the blur verdict and the submit
   * verdict come from two different checks. A number their country accepts can be marked
   * red on blur and then accepted on submit, or the reverse.
   */
  it('DEFECT: the phone rule cannot see the country-aware validator the form installs', () => {
    const phoneValidator = vi.fn().mockReturnValue(true);
    // `phoneValidator` is not part of FieldRuleContext at all — pass it and nothing reads it.
    const ctx = createContext({
      phoneValidator,
    } as unknown as Partial<FieldRuleContext>);

    expect(applyRule(ctx, { type: 'phone' }, '22 12 34 56')).toBe(false);
    expect(phoneValidator).not.toHaveBeenCalled();
  });

  /**
   * DEFECT (left as found) — when `phoneInputManager` is present the rule calls
   * `validatePhoneNumber(true)` and **ignores the `value` it was handed**. The `true`
   * hard-selects the *shipping* phone widget.
   *
   * What the shopper sees: the shipping phone's verdict is reused for whatever field was
   * blurred. A blank shipping phone can mark a filled billing phone invalid, and a valid
   * shipping phone marks any garbage typed elsewhere as fine.
   */
  it('DEFECT: with intl-tel-input active the phone rule judges the widget, not the value', () => {
    const validatePhoneNumber = vi.fn().mockReturnValue(true);
    const ctx = createContext({ phoneInputManager: { validatePhoneNumber } });

    expect(applyRule(ctx, { type: 'phone' }, 'not a phone number at all')).toBe(
      true
    );
    expect(validatePhoneNumber).toHaveBeenCalledWith(true);
  });
});
