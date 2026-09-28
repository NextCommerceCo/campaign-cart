import { describe, expect, it } from 'vitest';

import {
  checkoutFieldNames,
  checkoutFieldSelector,
  sdkCheckoutFieldName,
} from '@/utils/checkout-field-names';

describe('sdkCheckoutFieldName', () => {
  it.each([
    ['first_name', 'fname'],
    ['last_name', 'lname'],
    ['billing-first_name', 'billing-fname'],
    ['billing-last_name', 'billing-lname'],
    ['phone_number', 'phone'],
    ['billing-phone_number', 'billing-phone'],
    ['phone', 'phone'],
    ['fname', 'fname'],
    ['email', 'email'],
    ['billing-postal', 'billing-postal'],
    // A key every object has is not a field name.
    ['constructor', 'constructor'],
  ])('%s → %s', (name, sdk) => {
    expect(sdkCheckoutFieldName(name)).toBe(sdk);
  });
});

describe('checkoutFieldNames', () => {
  it('names the field under both its names, the SDK’s first', () => {
    expect(checkoutFieldNames('fname')).toEqual(['fname', 'first_name']);
    expect(checkoutFieldNames('first_name')).toEqual(['fname', 'first_name']);
    expect(checkoutFieldNames('billing-lname')).toEqual([
      'billing-lname',
      'billing-last_name',
    ]);
    expect(checkoutFieldNames('phone')).toEqual(['phone', 'phone_number']);
    expect(checkoutFieldNames('postal')).toEqual(['postal']);
  });
});

describe('checkoutFieldSelector', () => {
  it('matches an input written under either name', () => {
    document.body.innerHTML = `
      <input id="new" data-next-checkout-field="phone_number">
      <input id="old" data-next-checkout-field="phone">
      <input id="other" data-next-checkout-field="postal">`;
    const matched = [
      ...document.querySelectorAll(checkoutFieldSelector('phone')),
    ].map(el => el.id);
    expect(matched).toEqual(['new', 'old']);
  });
});
