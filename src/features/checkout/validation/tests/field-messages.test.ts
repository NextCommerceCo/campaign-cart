import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useConfigStore } from '@/state/config';

import {
  emojiErrors,
  fieldMessage,
  postalMessage,
  type MessageSource,
} from '../field-messages';

/** What the address-rules service sends for a US address in Thai: each field's errors. */
const THAI: MessageSource = {
  getMessagesLang: () => 'th',
  getFieldErrors: () => ({
    line2: {
      blank: 'กรุณากรอกที่อยู่บรรทัดที่ 2',
      contains_emoji: 'ที่อยู่บรรทัดที่ 2 ต้องไม่มีอีโมจิ',
    },
    postcode: {
      blank: 'กรุณากรอกรหัส ZIP',
      invalid: 'กรุณากรอกรหัส ZIP ให้ถูกต้อง เช่น 90210',
      contains_emoji: 'รหัส ZIP ต้องไม่มีอีโมจิ',
    },
    first_name: { blank: 'กรุณากรอกชื่อ' },
    state: { not_selected: 'กรุณาเลือกรัฐ' },
  }),
};

// The form is in Thai, the language THAI answered in, unless a test says otherwise.
beforeEach(() => {
  useConfigStore.setState({ locale: 'th', translations: undefined });
});

afterEach(() => {
  useConfigStore.setState({ locale: undefined, translations: undefined });
});

describe('fieldMessage', () => {
  it('takes the whole sentence the service wrote for the field', () => {
    expect(fieldMessage(THAI, 'contains_emoji', 'address2')).toBe(
      'ที่อยู่บรรทัดที่ 2 ต้องไม่มีอีโมจิ'
    );
    expect(fieldMessage(THAI, 'blank', 'postal')).toBe('กรุณากรอกรหัส ZIP');
  });

  it('asks an empty dropdown to be chosen from', () => {
    // The service serves a dropdown's empty sentence as `not_selected`.
    expect(fieldMessage(THAI, 'blank', 'province')).toBe('กรุณาเลือกรัฐ');
  });

  it('reads a billing field by the name the service knows it by', () => {
    expect(fieldMessage(THAI, 'blank', 'billing-address2')).toBe(
      'กรุณากรอกที่อยู่บรรทัดที่ 2'
    );
    expect(fieldMessage(THAI, 'blank', 'first_name')).toBe('กรุณากรอกชื่อ');
  });

  it('is all English when the service has no sentence for it', () => {
    // A Thai name inside an English sentence is what this rule exists to prevent.
    expect(fieldMessage(THAI, 'invalid_characters', 'fname')).toBe(
      'First name can only contain letters, spaces, hyphens and apostrophes'
    );
    expect(fieldMessage(THAI, 'blank', 'city')).toBe('City is required');
  });

  it('is all English before the service has answered', () => {
    expect(fieldMessage(undefined, 'contains_emoji', 'address2')).toBe(
      'Address line 2 can’t contain emojis'
    );
    expect(fieldMessage({}, 'invalid', 'email')).toBe(
      'Enter a valid email address'
    );
  });

  it("asks for the address's country's sentences", () => {
    const asked: (string | undefined)[] = [];
    fieldMessage(
      { ...THAI, getFieldErrors: country => (asked.push(country), {}) },
      'blank',
      'postal',
      { country: 'US' }
    );
    expect(asked).toEqual(['US']);
  });
});

describe('postalMessage', () => {
  it("takes the service's sentence, example and all, else quotes the example in English", () => {
    expect(
      postalMessage(THAI, 'postal', 'US', { postcodeExample: '90210' })
    ).toBe('กรุณากรอกรหัส ZIP ให้ถูกต้อง เช่น 90210');
    expect(
      postalMessage(undefined, 'postal', 'US', { postcodeExample: '10001' })
    ).toBe('Postal code isn’t valid, for example 10001');
    expect(
      postalMessage(undefined, 'postal', 'US', { postcodeExample: null })
    ).toBe('Postal code isn’t valid');
  });
});

describe('emojiErrors', () => {
  it('reports every field holding an emoji, in its own sentence, and only those', () => {
    expect(
      emojiErrors(THAI, { fname: 'Jane', address2: 'Apt 4 🏠', postal: '🌆' })
    ).toEqual({
      address2: 'ที่อยู่บรรทัดที่ 2 ต้องไม่มีอีโมจิ',
      postal: 'รหัส ZIP ต้องไม่มีอีโมจิ',
    });
    expect(emojiErrors(THAI, undefined)).toEqual({});
  });
});

describe("the page's own translations", () => {
  function pageIn(
    locale: string,
    translations: Record<string, Record<string, string>>
  ) {
    useConfigStore.setState({ locale, translations });
  }

  it("wins over the service's sentence, by field and error, in every country", () => {
    pageIn('th-TH', {
      th: { 'fields.line2.errors.blank': 'กรุณาระบุห้องหรืออาคาร' },
    });
    expect(fieldMessage(THAI, 'blank', 'address2')).toBe(
      'กรุณาระบุห้องหรืออาคาร'
    );
    // Not overridden: still the service's.
    expect(fieldMessage(THAI, 'contains_emoji', 'address2')).toBe(
      'ที่อยู่บรรทัดที่ 2 ต้องไม่มีอีโมจิ'
    );
  });

  it('fills the example into its own sentence', () => {
    pageIn('th', {
      th: { 'fields.postcode.errors.invalid': 'รหัสไม่ถูก ลอง {{example}}' },
    });
    expect(
      postalMessage(THAI, 'postal', 'US', { postcodeExample: '90210' })
    ).toBe('รหัสไม่ถูก ลอง 90210');
  });

  it('serves a language the service does not', () => {
    const english: MessageSource = {
      getMessagesLang: () => 'en',
      getFieldErrors: () => ({ line2: { blank: 'Enter address line 2' } }),
    };
    pageIn('vi', {
      vi: { 'fields.line2.errors.blank': 'Vui lòng nhập địa chỉ 2' },
    });
    expect(fieldMessage(english, 'blank', 'address2')).toBe(
      'Vui lòng nhập địa chỉ 2'
    );
  });

  it("ignores the service's answer in a language the form is not in", () => {
    pageIn('de', {});
    expect(fieldMessage(THAI, 'blank', 'address2')).toBe(
      'Address line 2 is required'
    );
  });
});
