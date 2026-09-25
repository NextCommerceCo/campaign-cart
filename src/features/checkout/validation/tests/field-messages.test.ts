import { describe, expect, it } from 'vitest';

import {
  emojiErrors,
  fieldMessage,
  postalMessage,
  type MessageSource,
} from '../field-messages';

/** What the address-rules service sends for a US address in Thai. */
const THAI: MessageSource = {
  getMessages: () => ({
    'error.required': 'กรุณากรอก{label}',
    'error.pattern.example': '{label}ไม่ถูกต้อง เช่น {example}',
    'error.emoji': 'ห้ามใส่อีโมจิใน{label}',
  }),
  getMessageLabels: () => ({
    line2: 'ที่อยู่บรรทัดที่ 2',
    postcode: 'รหัส ZIP',
    first_name: 'ชื่อ',
  }),
};

describe('fieldMessage', () => {
  it("builds the sentence from the service's template and its name for the field", () => {
    expect(fieldMessage(THAI, 'error.emoji', 'address2')).toBe(
      'ห้ามใส่อีโมจิในที่อยู่บรรทัดที่ 2'
    );
    expect(fieldMessage(THAI, 'error.required', 'postal')).toBe(
      'กรุณากรอกรหัส ZIP'
    );
  });

  it('reads a billing field by the name the service knows it by', () => {
    expect(fieldMessage(THAI, 'error.required', 'billing-address2')).toBe(
      'กรุณากรอกที่อยู่บรรทัดที่ 2'
    );
    expect(fieldMessage(THAI, 'error.required', 'first_name')).toBe(
      'กรุณากรอกชื่อ'
    );
  });

  it('is all English when the service sent no template for the sentence', () => {
    // A Thai name inside an English sentence is what this rule exists to prevent.
    expect(fieldMessage(THAI, 'error.name', 'fname')).toBe(
      'First name can only contain letters, spaces, hyphens and apostrophes'
    );
  });

  it('is all English when the service has no name for the field', () => {
    expect(fieldMessage(THAI, 'error.required', 'city')).toBe(
      'City is required'
    );
  });

  it('is all English before the service has answered', () => {
    expect(fieldMessage(undefined, 'error.emoji', 'address2')).toBe(
      'Address line 2 can’t contain emojis'
    );
    expect(fieldMessage({}, 'error.email', 'email')).toBe(
      'Enter a valid email address'
    );
  });

  it("asks for the address's country's names", () => {
    const asked: (string | undefined)[] = [];
    fieldMessage(
      { ...THAI, getMessageLabels: country => (asked.push(country), {}) },
      'error.required',
      'postal',
      { country: 'US' }
    );
    expect(asked).toEqual(['US']);
  });
});

describe('postalMessage', () => {
  it("quotes the country's example when it has one", () => {
    expect(
      postalMessage(THAI, 'postal', 'US', { postcodeExample: '10001' })
    ).toBe('รหัส ZIPไม่ถูกต้อง เช่น 10001');
    expect(
      postalMessage(undefined, 'postal', 'US', { postcodeExample: null })
    ).toBe('Postal code isn’t valid');
  });
});

describe('emojiErrors', () => {
  it('reports every field holding an emoji, by its own name, and only those', () => {
    expect(
      emojiErrors(THAI, { fname: 'Jane', address2: 'Apt 4 🏠', postal: '🌆' })
    ).toEqual({
      address2: 'ห้ามใส่อีโมจิในที่อยู่บรรทัดที่ 2',
      postal: 'ห้ามใส่อีโมจิในรหัส ZIP',
    });
    expect(emojiErrors(THAI, undefined)).toEqual({});
  });
});
