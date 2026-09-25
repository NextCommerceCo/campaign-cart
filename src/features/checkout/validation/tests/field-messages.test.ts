import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useConfigStore } from '@/state/config';

import {
  emojiErrors,
  fieldMessage,
  optionalLabel,
  postalMessage,
  type MessageSource,
} from '../field-messages';

/** What the address-rules service sends for a US address in Thai. */
const THAI: MessageSource = {
  getMessagesLang: () => 'th',
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

// The form is in Thai, the language THAI answered in, unless a test says otherwise.
beforeEach(() => {
  useConfigStore.setState({ locale: 'th', translations: undefined });
});

afterEach(() => {
  useConfigStore.setState({ locale: undefined, translations: undefined });
});

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

describe("the page's own translations", () => {
  function pageIn(
    locale: string,
    translations: Record<string, Record<string, string>>
  ) {
    useConfigStore.setState({ locale, translations });
  }

  it("wins over the service's wording, key by key", () => {
    pageIn('th-TH', { th: { 'error.required': 'กรุณาระบุ{label}' } });
    expect(fieldMessage(THAI, 'error.required', 'address2')).toBe(
      'กรุณาระบุที่อยู่บรรทัดที่ 2'
    );
    // Not overridden: still the service's.
    expect(fieldMessage(THAI, 'error.emoji', 'address2')).toBe(
      'ห้ามใส่อีโมจิในที่อยู่บรรทัดที่ 2'
    );
  });

  it("renames a field inside the service's sentence", () => {
    pageIn('th', { th: { 'label.line2': 'ห้อง/อาคาร' } });
    expect(fieldMessage(THAI, 'error.emoji', 'address2')).toBe(
      'ห้ามใส่อีโมจิในห้อง/อาคาร'
    );
  });

  it('serves a language the service does not, when the page names the fields too', () => {
    const english: MessageSource = {
      ...THAI,
      getMessagesLang: () => 'en',
      getMessages: () => ({ 'error.required': '{label} is required' }),
      getMessageLabels: () => ({ line2: 'Address line 2' }),
    };
    pageIn('vi', {
      vi: {
        'error.required': 'Vui lòng nhập {label}',
        'label.line2': 'Địa chỉ 2',
      },
    });
    expect(fieldMessage(english, 'error.required', 'address2')).toBe(
      'Vui lòng nhập Địa chỉ 2'
    );
  });

  it('never puts its sentence around a name in another language', () => {
    const english: MessageSource = {
      ...THAI,
      getMessagesLang: () => 'en',
      getMessageLabels: () => ({ line2: 'Address line 2' }),
    };
    pageIn('vi', { vi: { 'error.required': 'Vui lòng nhập {label}' } });
    expect(fieldMessage(english, 'error.required', 'address2')).toBe(
      'Address line 2 is required'
    );
  });

  it("ignores the service's answer in a language the form is not in", () => {
    pageIn('de', {});
    expect(fieldMessage(THAI, 'error.required', 'address2')).toBe(
      'Address line 2 is required'
    );
  });
});

describe('optionalLabel', () => {
  const thai: MessageSource = {
    getMessagesLang: () => 'th',
    getMessages: () => ({ 'field.optional': '{label} (ไม่บังคับ)' }),
  };

  it("writes the note from the service's template, in the label's language", () => {
    expect(optionalLabel(thai, 'ห้อง / ชั้น / อาคาร', 'th')).toBe(
      'ห้อง / ชั้น / อาคาร (ไม่บังคับ)'
    );
  });

  it("prefers the page's own wording", () => {
    useConfigStore.setState({
      translations: { th: { 'field.optional': '{label} - ไม่ต้องกรอกก็ได้' } },
    });
    expect(optionalLabel(thai, 'ห้อง', 'th')).toBe('ห้อง - ไม่ต้องกรอกก็ได้');
  });

  it('writes the English note for an English label, service or not', () => {
    expect(optionalLabel(undefined, 'Apartment, suite, etc.', 'en')).toBe(
      'Apartment, suite, etc. (optional)'
    );
  });

  it('leaves a label bare rather than put a note in another language on it', () => {
    // The service answered in Thai; the label is German.
    expect(optionalLabel(thai, 'Wohnung, Etage usw.', 'de')).toBe(
      'Wohnung, Etage usw.'
    );
  });
});
