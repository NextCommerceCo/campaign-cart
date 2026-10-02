import { describe, expect, it } from 'vitest';

import {
  callingCodesOf,
  countryOfNumber,
  formatPhone,
  isE164,
  isPlausiblePhone,
  isTypedAbroad,
  toE164,
  type CallingCodes,
  type PhoneRules,
} from '@/core/country-service/country-service.phone';

// Copied from the address-rules service's country files (i18n-rules `src/rules/*.json`),
// where each is held to libphonenumber's example numbers for the country.
const US: PhoneRules = {
  calling_code: '1',
  national_prefix: '1',
  masks: [{ mask: '(###) ###-####' }],
  pattern: '^[0-9]{10,11}$',
  example: '(201) 555-0123',
};
const TH: PhoneRules = {
  calling_code: '66',
  national_prefix: '0',
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
  calling_code: '39',
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
  national_prefix: '0',
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

  it('shows a number dialled with 00 as its digits, not as a +', () => {
    expect(formatPhone('0066 81 234 5678', TH)).toBe('0066812345678');
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

// What the service sends once it serves libphonenumber's reading facts: i18n-rules
// `src/rules/{ag,br,by,gb,ru,rw,th,us}.json`, the facts only. Each expected E.164 is
// `phonenumbers.parse`'s for the same input, most of them from i18n-rules
// `test/fixtures/phone-parsing.json`.
const READ: Record<string, PhoneRules> = {
  AG: {
    calling_code: '1',
    international_prefix: '011',
    national_prefix: '1',
    national_prefix_for_parsing: '([457]\\d{6})$|1',
    national_prefix_transform_rule: '268$1',
    national_number_pattern: '(?:268|[58]\\d\\d|900)\\d{7}',
  },
  BR: {
    calling_code: '55',
    national_prefix: '0',
    national_prefix_for_parsing:
      '(?:0|90)(?:(1[245]|2[1-35]|31|4[13]|[56]5|99)(\\d{10,11}))?',
    national_prefix_transform_rule: '$2',
    national_number_pattern:
      '[1-467]\\d{9,10}|55[0-46-9]\\d{8}|[34]\\d{7}|55\\d{7,8}|(?:5[0-46-9]|[89]\\d)\\d{7,9}',
  },
  BY: {
    calling_code: '375',
    national_prefix: '80',
    national_prefix_for_parsing: '0|80?',
    national_number_pattern:
      '(?:[12]\\d|33|44|902)\\d{7}|8(?:0[0-79]\\d{5,7}|[1-7]\\d{9})|8(?:1[0-489]|[5-79]\\d)\\d{7}|8[1-79]\\d{6,7}|8[0-79]\\d{5}|8\\d{5}',
  },
  GB: {
    calling_code: '44',
    international_prefix: '00',
    national_prefix: '0',
    national_prefix_for_parsing: '0|180020',
    national_number_pattern: '[1-357-9]\\d{9}|[18]\\d{8}|8\\d{6}',
  },
  RU: {
    calling_code: '7',
    national_prefix: '8',
    national_number_pattern: '8\\d{13}|[347-9]\\d{9}',
  },
  RW: {
    calling_code: '250',
    national_prefix: '0',
    national_number_pattern: '(?:06|[27]\\d\\d|[89]00)\\d{6}',
  },
  TH: {
    calling_code: '66',
    international_prefix: '00[1-9]',
    national_prefix: '0',
    national_number_pattern: '(?:001800|[2-57]|[689]\\d)\\d{7}|1\\d{7,9}',
  },
  US: {
    calling_code: '1',
    international_prefix: '011',
    national_prefix: '1',
    national_number_pattern: '[2-9]\\d{9}|3\\d{6}',
  },
};

describe('toE164, with the facts libphonenumber reads a number with', () => {
  it.each([
    ['TH', '081 234 5678', '+66812345678'],
    ['US', '1 415 555 2671', '+14155552671'],
    ['AG', '464 1234', '+12684641234'],
    ['BR', '(11) 96123-4567', '+5511961234567'],
    ['BR', '0 15 11 96123-4567', '+5511961234567'],
    ['BY', '8 029 491-19-11', '+375294911911'],
    ['BY', '8 801 123 4567', '+3758011234567'],
    ['RU', '8 800 123-45-67', '+78001234567'],
    ['RW', '250 123 456', '+250250123456'],
    ['TH', '66812345678', '+66812345678'],
  ])('reads %s %s as %s', (country, typed, e164) => {
    expect(toE164(typed, READ[country])).toBe(e164);
  });

  it('gives no E.164 for digits that are not yet a number of the country', () => {
    expect(toE164('081 23', READ['TH'])).toBe('');
    expect(toE164('415 555', READ['US'])).toBe('');
  });

  it("checks a number typed with + against its own country's numbers", () => {
    expect(toE164('+66 81 234 5678', READ['TH'])).toBe('+66812345678');
    expect(toE164('+66 81 23', READ['TH'])).toBe('');
    // Another country's code is not this rule's to check.
    expect(toE164('+44 7400 123456', READ['TH'])).toBe('+447400123456');
  });

  it.each([
    ['TH', '001 66 812345678', '+66812345678'],
    ['US', '011 1 2015550123', '+12015550123'],
    ['GB', '00 44 7400123456', '+447400123456'],
    ['US', '011 44 7400 123456', '+447400123456'],
  ])(
    "reads %s %s, dialled with the country's prefix, as %s",
    (country, typed, e164) => {
      expect(toE164(typed, READ[country])).toBe(e164);
    }
  );

  it('reads 00 as + in every country, the way a number is written in a form', () => {
    // phonenumbers.parse reads 0066… in Thailand as its carrier prefix 006 and a code 68,
    // +6812345678; the shopper meant +66, as they would anywhere else.
    expect(toE164('0066 81 234 5678', READ['TH'])).toBe('+66812345678');
    expect(toE164('0044 7400 123456', READ['TH'])).toBe('+447400123456');
    // 00 is no US prefix, but a shopper writing it still means +.
    expect(toE164('0044 7400 123456', READ['US'])).toBe('+447400123456');
    expect(
      countryOfNumber(
        '0066 81 234 5678',
        { '66': [{ code: 'TH', calling_code: '66' }] },
        READ['TH']
      )
    ).toBe('TH');
  });

  it('reads no calling code after the prefix when a 0 follows it', () => {
    expect(isTypedAbroad('011 0123', READ['US'])).toBe(false);
  });

  it.each([
    ['GB', '+44 (0) 7400123456', '+447400123456'],
    ['TH', '+66 (0) 812345678', '+66812345678'],
    ['TH', '+66 81 234 5678', '+66812345678'],
  ])(
    'drops the national prefix kept after the code: %s %s',
    (country, typed, e164) => {
      expect(toE164(typed, READ[country])).toBe(e164);
    }
  );

  it('reads digits from other keyboards as the ASCII ones', () => {
    expect(toE164('๐๘๑ ๒๓๔ ๕๖๗๘', READ['TH'])).toBe('+66812345678');
    expect(toE164('０８１２３４５６７８', READ['TH'])).toBe('+66812345678');
    expect(toE164('＋６６ ８１ ２３４ ５６７８', READ['TH'])).toBe(
      '+66812345678'
    );
    expect(formatPhone('๐๘๑๒๓๔๕๖๗๘', TH)).toBe('081 234 5678');
  });
});

describe('countryOfNumber', () => {
  // As `GET /v1/phone-numbers` lists them, by code: the US is +1's main country, and
  // Antigua is told apart by how its numbers start.
  const CODES: CallingCodes = callingCodesOf([
    { code: 'AG', calling_code: '1', leading_digits: '268' },
    { code: 'AR', national_prefix: '0' },
    { code: 'CA', calling_code: '1' },
    { code: 'GB', calling_code: '44' },
    { code: 'TH', calling_code: '66' },
    { code: 'US', calling_code: '1', main_country_for_code: true },
  ]);

  it.each([
    ['+66 81 234 5678', 'TH'],
    ['0066 81 234 5678', 'TH'],
    ['+1 268 464 1234', 'AG'],
    ['+1 415 555 2671', 'US'],
    // Canada is told apart from the US by no start of its own, so it reads as +1's main
    // country: the flag differs, the E.164 does not.
    ['+1 506 234 5678', 'US'],
    ['+1 800 234 5678', 'US'],
  ])('names %s as %s', (typed, country) => {
    expect(countryOfNumber(typed, CODES)).toBe(country);
  });

  it('reads a number dialled abroad by the prefix of the country it is typed in', () => {
    expect(countryOfNumber('001 66 81 234 5678', CODES, READ['TH'])).toBe('TH');
    expect(countryOfNumber('011 44 7400 123456', CODES, READ['US'])).toBe('GB');
    expect(
      countryOfNumber('011 44 7400 123456', CODES, READ['GB'])
    ).toBeUndefined();
  });

  it('groups no country whose rules have no calling code', () => {
    expect(
      Object.values(CODES)
        .flat()
        .map(country => country.code)
    ).not.toContain('AR');
    expect(countryOfNumber('+54 9 11 2345 6789', CODES)).toBeUndefined();
  });

  it('names no country for a number typed nationally, or a code none has', () => {
    expect(countryOfNumber('081 234 5678', CODES)).toBeUndefined();
    expect(countryOfNumber('+999 123', CODES)).toBeUndefined();
    expect(countryOfNumber('+', CODES)).toBeUndefined();
  });
});

describe('isE164 accepts only + and 8 to 15 digits, the first not 0', () => {
  it.each([
    '+14155552671',
    '+66812345678',
    '+447700900123',
    '+12345678',
    '+123456789012345',
  ])('accepts %s', number => expect(isE164(number)).toBe(true));

  it.each([
    '(415) 555-2671',
    '4155552671',
    '14155552671',
    '+1 415 555 2671',
    '+1-415-555-2671',
    '+04155552671',
    '+1234567',
    '+1234567890123456',
    '+',
    '',
    ' +14155552671',
  ])('refuses %j', number => expect(isE164(number)).toBe(false));

  it('refuses a missing value', () => {
    expect(isE164(undefined)).toBe(false);
    expect(isE164(null)).toBe(false);
  });
});
