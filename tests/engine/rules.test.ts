import { describe, expect, it } from 'vitest';
import { fieldError, formErrors, validEmail } from '../../src/engine/rules';
import type { CheckoutState } from '../../src/engine/types';
import { GB, US } from '../fixtures/rules';

const checkout = (fields: Record<string, string>, patch: Partial<CheckoutState> = {}): CheckoutState => ({
  fields,
  phones: {},
  sameAsShipping: true,
  paymentMethod: 'card_token',
  step: 0,
  errors: {},
  status: 'idle',
  countries: [],
  rules: { US, GB },
  prospectSaved: false,
  ...patch,
});

const SHIPPING = {
  email: 'jane@example.com',
  first_name: 'Jane',
  last_name: 'Doe',
  line1: '1 Main St',
  city: 'Austin',
  state: 'CA',
  postcode: '90210',
  country: 'US',
};

describe('checkout rules', () => {
  it('reads an email the way 0.4.x did', () => {
    expect(validEmail('jane.doe+x@mail.example.co')).toBe(true);
    for (const bad of ['jane@', 'jane..doe@x.com', '.jane@x.com', 'jane@x.c', 'jane@.x.com', 'jane x@x.com']) {
      expect(validEmail(bad)).toBe(false);
    }
  });

  it('refuses names with digits, any emoji, and postcodes the country does not use', () => {
    expect(fieldError('first_name', 'J4ne', true)).toBe('invalid_characters');
    expect(fieldError('last_name', "O'Brien-Smith", true)).toBeUndefined();
    expect(fieldError('city', 'Austin 🤠', true)).toBe('contains_emoji');
    expect(fieldError('postcode', '9021', true, US)).toBe('invalid');
    expect(fieldError('postcode', 'sw1a 1aa', true, GB)).toBeUndefined();
    expect(fieldError('phone_number', '12', false)).toBe('invalid');
    expect(fieldError('state', '', true, US)).toBe('not_selected');
    expect(fieldError('line2', '', false)).toBeUndefined();
  });

  it('asks for state and postcode only where the country does', () => {
    expect(formErrors(checkout({ ...SHIPPING, state: '', postcode: '' }), 'all')).toEqual({
      state: 'not_selected',
      postcode: 'blank',
    });
    const french = { ...SHIPPING, country: 'FR', state: '', postcode: '' };
    expect(
      formErrors(checkout(french, { rules: { FR: { country: { code: 'FR', name: 'France' }, fields: {} } } }), 'all'),
    ).toEqual({});
  });

  it('checks the billing address only when it differs, and express only the contact', () => {
    const different = checkout(SHIPPING, { sameAsShipping: false });
    expect(Object.keys(formErrors(different, 'all'))).toEqual([
      'billing_first_name',
      'billing_last_name',
      'billing_line1',
      'billing_city',
      'billing_country',
    ]);
    expect(formErrors(different, 'shipping')).toEqual({});
    expect(
      formErrors(checkout({ email: 'jane@example.com', first_name: 'Jane', last_name: 'Doe' }), 'express'),
    ).toEqual({});
    expect(formErrors(checkout(SHIPPING), 'all', true)).toEqual({ phone_number: 'blank' });
  });
});
