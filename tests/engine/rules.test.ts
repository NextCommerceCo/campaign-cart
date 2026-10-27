import { describe, expect, it } from 'vitest';
import { fieldError, formatPostcode, formErrors, requiredFields, validEmail } from '../../src/engine/rules';
import type { CheckoutState } from '../../src/engine/types';
import { CA, GB, HK, SG, US } from '../fixtures/rules';

const checkout = (fields: Record<string, string>, patch: Partial<CheckoutState> = {}): CheckoutState => ({
  fields,
  phones: {},
  sameAsShipping: true,
  paymentMethod: 'card_token',
  step: 0,
  errors: {},
  status: 'idle',
  countries: [],
  rules: { US, GB, HK, SG, CA },
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

describe('country rules', () => {
  const contact = { email: 'jane@example.com', first_name: 'Jane', last_name: 'Doe', line1: '1 Main St' };

  it("asks for the fields the country's rules require, and only those it has", () => {
    const required = (country: string) => requiredFields(checkout({ country }), 'shipping');
    expect(required('US')).toEqual([
      'email',
      'first_name',
      'last_name',
      'line1',
      'city',
      'state',
      'postcode',
      'country',
    ]);
    expect(required('SG')).toEqual(['email', 'first_name', 'last_name', 'line1', 'postcode', 'country']);
    expect(required('HK')).toEqual(['email', 'first_name', 'last_name', 'line1', 'city', 'state', 'country']);
    expect(required('FR')).toEqual(['email', 'first_name', 'last_name', 'line1', 'city', 'country']);
  });

  it('lets a Singapore address through without a city, and ignores a postcode left from another country', () => {
    expect(formErrors(checkout({ ...contact, country: 'SG', postcode: '018956' }), 'shipping')).toEqual({});
    expect(
      formErrors(checkout({ ...contact, country: 'HK', city: 'Kowloon', state: 'KLN', postcode: 'x' }), 'shipping'),
    ).toEqual({});
  });

  it("writes a postcode in its country's mask once it fits, in capitals and ASCII digits", () => {
    const ca = CA.fields.postcode!.format;
    const us = US.fields.postcode!.format;
    expect(formatPostcode('k1a0b1', ca)).toBe('K1A 0B1');
    expect(formatPostcode('k1a', ca)).toBe('K1A');
    expect(formatPostcode('902101234', us)).toBe('90210-1234');
    expect(formatPostcode('9021', us)).toBe('9021');
    expect(formatPostcode('๙๐๒๑๐', us)).toBe('90210');
    expect(formatPostcode('sw1a 1aa')).toBe('SW1A 1AA');
    expect(fieldError('postcode', '๙๐๒๑๐', true, US)).toBeUndefined();
  });
});
