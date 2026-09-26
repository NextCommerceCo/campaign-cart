import { describe, it, expect } from 'vitest';

import { validateExpressFields } from '../express-field-validation';
import type { PhoneNumberSource } from '../../validation/phone-validation';

const widget = (e164: string, valid: boolean | null): PhoneNumberSource => ({
  getNumber: () => e164,
  isValidNumber: () => valid,
});

const ctx = (source?: PhoneNumberSource) => ({ phoneSource: () => source });

describe('validateExpressFields', () => {
  it('passes when every named field is filled and well formed', () => {
    const result = validateExpressFields(
      ctx(widget('+14155552671', true)),
      { email: 'shopper@example.com', phone: '4155552671' },
      ['email', 'phone']
    );

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('reads a field named the orders API’s way from where the SDK keeps it', () => {
    const result = validateExpressFields(
      ctx(),
      { fname: 'Ada', lname: '' },
      ['first_name', 'last_name']
    );

    expect(result.errors).toEqual({ lname: 'Last Name is required' });
    expect(result.firstErrorField).toBe('lname');
  });

  it('reports a missing field by its shopper-facing label', () => {
    const result = validateExpressFields(ctx(), { email: '   ' }, ['email']);

    expect(result.errors.email).toBe('Email is required');
    expect(result.firstErrorField).toBe('email');
  });

  it('checks the email for shape, not only presence', () => {
    const result = validateExpressFields(ctx(), { email: 'not-an-email' }, [
      'email',
    ]);

    expect(result.errors.email).toBe('Please enter a valid email address');
  });

  /**
   * The asymmetry this module was extracted to close: email was checked for shape here and
   * the phone only for presence, so express accepted a number the form and the step refused.
   */
  it('checks the phone for shape too, through the same gate the form uses', () => {
    const result = validateExpressFields(
      ctx(widget('+1415', false)),
      { phone: '415' },
      ['phone']
    );

    expect(result.errors.phone).toBe('Please enter a valid phone number');
  });

  it('lets a phone through when nothing could judge it', () => {
    // The utils script has not landed, so the widget answers `null`, not `false`.
    const result = validateExpressFields(
      ctx(widget('', null)),
      { phone: '4155552671' },
      ['phone']
    );

    expect(result.isValid).toBe(true);
  });

  it('checks presence only for a field with no shape rule', () => {
    const result = validateExpressFields(ctx(), { city: '12345' }, ['city']);

    expect(result.isValid).toBe(true);
  });

  it('names the first failing field in the order asked for', () => {
    const result = validateExpressFields(ctx(), { email: '', phone: '' }, [
      'phone',
      'email',
    ]);

    expect(result.firstErrorField).toBe('phone');
  });

  it('omits firstErrorField when nothing failed', () => {
    const result = validateExpressFields(ctx(), { city: 'London' }, ['city']);

    expect('firstErrorField' in result).toBe(false);
  });
});
