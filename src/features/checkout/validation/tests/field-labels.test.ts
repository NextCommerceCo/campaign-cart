import { describe, expect, it } from 'vitest';

import { checkoutFieldLabel, formatFieldName } from '../field-labels';

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

/** The express message once named `billing-phone` raw: its hand-written map had no entry. */
describe('checkoutFieldLabel', () => {
  it('names the address a billing field belongs to', () => {
    expect(checkoutFieldLabel('billing-phone')).toBe('Billing phone number');
    expect(checkoutFieldLabel('billing-address2')).toBe(
      'Billing address line 2'
    );
  });

  it('names a shipping or card field as the form does', () => {
    expect(checkoutFieldLabel('postal')).toBe('Postal code');
    expect(checkoutFieldLabel('cc-month')).toBe('Expiration month');
  });
});
