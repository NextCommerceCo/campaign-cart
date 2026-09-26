import { describe, expect, it } from 'vitest';

import {
  formatPhone,
  isPlausiblePhone,
  toE164,
  type PhoneRules,
} from '@/core/country-service/country-service.phone';

// Copied from the address-rules service's country files (i18n-rules `src/rules/*.json`),
// where each is held to libphonenumber's example numbers for the country.
const US: PhoneRules = {
  callingCode: '1',
  nationalPrefix: '1',
  masks: [{ mask: '(###) ###-####' }],
  pattern: '^[0-9]{10,11}$',
  example: '(201) 555-0123',
};
const TH: PhoneRules = {
  callingCode: '66',
  nationalPrefix: '0',
  masks: [
    { start: '02', mask: '## ### ####' },
    { start: '0[3-57]', mask: '### ### ###' },
    { start: '1', mask: '#### ### ###' },
    { mask: '### ### ####' },
  ],
  pattern: '^[0-9]{8,14}$',
  example: '081 234 5678',
};
const IT: PhoneRules = {
  callingCode: '39',
  masks: [
    { start: '02', mask: '## ### ####' },
    { start: '0[3-57]', mask: '### ### ###' },
    { start: '1', mask: '#### ### ###' },
    { mask: '### ### ####' },
  ],
  pattern: '^[0-9]{6,12}$',
  example: '312 345 6789',
};
const AR: PhoneRules = {
  nationalPrefix: '0',
  masks: [{ mask: '### ##-####-####' }],
  pattern: '^[0-9]{10,13}$',
  example: '011 15-2345-6789',
};

describe('formatPhone', () => {
  it('fills the mask as the number is typed, and stops at the last digit', () => {
    expect(formatPhone('415', US)).toBe('(415');
    expect(formatPhone('41555', US)).toBe('(415) 55');
    expect(formatPhone('4155552671', US)).toBe('(415) 555-2671');
  });

  it('reads the digits out of text it already formatted', () => {
    expect(formatPhone('(415) 555-267', US)).toBe('(415) 555-267');
    expect(formatPhone('(415) 555-2671', US)).toBe('(415) 555-2671');
  });

  it('shows a national prefix the mask has no place for before it', () => {
    expect(formatPhone('14155552671', US)).toBe('1 (415) 555-2671');
  });

  it('picks the mask by how the number starts', () => {
    expect(formatPhone('020176091', TH)).toBe('02 017 6091');
    expect(formatPhone('0831234567', TH)).toBe('083 123 4567');
    expect(formatPhone('053123456', TH)).toBe('053 123 456');
    expect(formatPhone('1800123456', TH)).toBe('1800 123 456');
  });

  it('uses the default mask until the digits reach a start', () => {
    expect(formatPhone('0', TH)).toBe('0');
    expect(formatPhone('0201', TH)).toBe('02 01');
  });

  it('keeps a prefix the mask already holds inside it', () => {
    expect(formatPhone('0812345678', TH)).toBe('081 234 5678');
  });

  it('leaves a number typed with + as + and its digits', () => {
    expect(formatPhone('+1 212-555-0123', US)).toBe('+12125550123');
  });

  it('reads a leading 00 as +', () => {
    expect(formatPhone('0066 81 234 5678', TH)).toBe('+66812345678');
  });

  it('shows digits the mask has no room for as typed', () => {
    expect(formatPhone('415555267199', US)).toBe('415555267199');
  });

  it('shows the digits as typed without a rule or a mask', () => {
    expect(formatPhone('0812345678')).toBe('0812345678');
    expect(formatPhone('0812345678', { pattern: '^[0-9]{8,14}$' })).toBe(
      '0812345678'
    );
  });
});

describe('isPlausiblePhone', () => {
  it('checks a national number against the pattern', () => {
    expect(isPlausiblePhone('(415) 555-2671', US)).toBe(true);
    expect(isPlausiblePhone('415 555', US)).toBe(false);
  });

  it("checks a + number with the country's own code without that code", () => {
    expect(isPlausiblePhone('+66 81 234 5678', TH)).toBe(true);
    expect(isPlausiblePhone('+66 81', TH)).toBe(false);
  });

  it('reads a leading 00 as + when checking', () => {
    expect(isPlausiblePhone('0066 81 234 5678', TH)).toBe(true);
  });

  it('only asks a + number with another code to be the length of E.164', () => {
    expect(isPlausiblePhone('+44 7400 123456', US)).toBe(true);
    expect(isPlausiblePhone('+44 74', US)).toBe(false);
  });
});

describe('toE164', () => {
  it('drops one national prefix and adds the calling code', () => {
    expect(toE164('081 234 5678', TH)).toBe('+66812345678');
    expect(toE164('1 (415) 555-2671', US)).toBe('+14155552671');
    expect(toE164('(415) 555-2671', US)).toBe('+14155552671');
  });

  it("keeps Italy's leading zero, which is part of the number", () => {
    expect(toE164('02 1234 5678', IT)).toBe('+390212345678');
  });

  it('keeps a number typed with + or 00 as typed', () => {
    expect(toE164('+44 7400 123456', US)).toBe('+447400123456');
    expect(toE164('0066 81 234 5678', TH)).toBe('+66812345678');
  });

  it('does not add the calling code to digits that may already carry it', () => {
    // Pasted without its +: adding +66 again would send +6666812345678.
    expect(toE164('66812345678', TH)).toBe('');
    // The US prefix is also its calling code, and is dropped as a prefix.
    expect(toE164('14155552671', US)).toBe('+14155552671');
  });

  it('sends nothing to convert for a country without a calling code, or no digits', () => {
    expect(toE164('011 15-2345-6789', AR)).toBe('');
    expect(toE164('', US)).toBe('');
    expect(toE164('0812345678')).toBe('');
  });
});
