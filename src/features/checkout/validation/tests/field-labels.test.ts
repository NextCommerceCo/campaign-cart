import { describe, expect, it } from 'vitest';

import { formatFieldName } from '../field-labels';

describe('formatFieldName', () => {
  it('gives every known field a name a shopper would recognise', () => {
    expect(formatFieldName('fname')).toBe('First name');
    expect(formatFieldName('first_name')).toBe('First name');
    expect(formatFieldName('address2')).toBe('Address line 2');
    expect(formatFieldName('email')).toBe('Email');
    expect(formatFieldName('phone')).toBe('Phone number');
  });

  it('uses the generic English words, never a country’s', () => {
    expect(formatFieldName('province')).toBe('State or province');
    expect(formatFieldName('postal')).toBe('Postal code');
  });

  it('returns an unknown field name unchanged rather than dropping it', () => {
    expect(formatFieldName('vat-number')).toBe('vat-number');
  });
});
