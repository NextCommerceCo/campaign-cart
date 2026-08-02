import { describe, expect, it } from 'vitest';

import { formatFieldName } from '../field-labels';

describe('formatFieldName', () => {
  it('gives every known field a name a shopper would recognise', () => {
    expect(formatFieldName('fname')).toBe('First name');
    expect(formatFieldName('lname')).toBe('Last name');
    expect(formatFieldName('address1')).toBe('Address');
    expect(formatFieldName('email')).toBe('Email');
    expect(formatFieldName('phone')).toBe('Phone number');
  });

  it('uses the country wording for the two fields whose name changes', () => {
    const uk = { stateLabel: 'County', postcodeLabel: 'Postcode' };
    expect(formatFieldName('province', uk)).toBe('County');
    expect(formatFieldName('postal', uk)).toBe('Postcode');
  });

  it('falls back to the generic wording when no country is known', () => {
    expect(formatFieldName('province')).toBe('State/Province');
    expect(formatFieldName('postal')).toBe('Postal code');
  });

  /**
   * A country config with an empty label falls through `||` to the generic wording rather
   * than producing " is required". Worth pinning: `??` here would ship the empty string.
   */
  it('treats an empty country label as no label', () => {
    expect(formatFieldName('postal', { postcodeLabel: '' })).toBe(
      'Postal code'
    );
  });

  it('returns an unknown field name unchanged rather than dropping it', () => {
    expect(formatFieldName('vat-number')).toBe('vat-number');
  });
});
