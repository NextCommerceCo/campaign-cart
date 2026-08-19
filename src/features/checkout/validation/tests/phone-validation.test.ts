import { describe, it, expect } from 'vitest';

import {
  checkPhone,
  isJunkPhoneNumber,
  normalizePhone,
  type PhoneNumberSource,
} from '../phone-validation';

/**
 * A stand-in for one `intl-tel-input` instance.
 *
 * `null` from the two verdict methods is the library's way of saying its utils script has
 * not loaded, and `''` from `getNumber()` is the same condition — so the default here is
 * the state a real instance is in for the first moments of a page.
 */
function source(overrides: Partial<PhoneNumberSource> = {}): PhoneNumberSource {
  return {
    getNumber: () => '',
    isValidNumber: () => null,
    isValidNumberPrecise: () => null,
    getSelectedCountryData: () => ({ dialCode: '1', iso2: 'us' }),
    ...overrides,
  };
}

/** An instance with the utils script loaded, answering as it would for a US number. */
function loadedSource(
  verdict: boolean,
  e164 = '+14155552671'
): PhoneNumberSource {
  return source({
    getNumber: () => e164,
    isValidNumber: () => verdict,
    isValidNumberPrecise: () => verdict,
  });
}

describe('isJunkPhoneNumber', () => {
  it('rejects a number that is one digit repeated', () => {
    expect(isJunkPhoneNumber('0000000000')).toBe(true);
    expect(isJunkPhoneNumber('5555555555')).toBe(true);
  });

  it('rejects a consecutive run, including the 9 to 0 wrap', () => {
    expect(isJunkPhoneNumber('1234567890')).toBe(true);
    expect(isJunkPhoneNumber('9876543210')).toBe(true);
  });

  it('rejects a short unit repeated at least three times', () => {
    expect(isJunkPhoneNumber('1212121212')).toBe(true);
    expect(isJunkPhoneNumber('123123123123')).toBe(true);
  });

  it('accepts real numbers that merely repeat some digits', () => {
    expect(isJunkPhoneNumber('4155552671')).toBe(false);
    expect(isJunkPhoneNumber('2025550147')).toBe(false);
    expect(isJunkPhoneNumber('7700900123')).toBe(false);
  });

  it('does not run on numbers too short to be phone numbers anyway', () => {
    expect(isJunkPhoneNumber('123')).toBe(false);
    expect(isJunkPhoneNumber('000')).toBe(false);
  });
});

describe('checkPhone', () => {
  it('treats an empty value as nothing to judge', () => {
    const check = checkPhone('   ');
    expect(check.verdict).toBe('unknown');
    expect(check.reason).toBe('empty');
    expect(check.value).toBe('');
  });

  it('rejects junk before asking the library, which would accept it', () => {
    // This is the reported bug: the library's length check passes any ten digits.
    const check = checkPhone('0000000000', loadedSource(true, '+10000000000'));

    expect(check.verdict).toBe('invalid');
    expect(check.reason).toBe('junk-pattern');
  });

  it('rejects junk written internationally, past the dial code', () => {
    const check = checkPhone(
      '+1 0000000000',
      loadedSource(true, '+10000000000')
    );

    expect(check.verdict).toBe('invalid');
    expect(check.reason).toBe('junk-pattern');
  });

  it('takes the library verdict and its E.164 number when utils are loaded', () => {
    const check = checkPhone('(415) 555-2671', loadedSource(true));

    expect(check.verdict).toBe('valid');
    expect(check.reason).toBe('library-length');
    expect(check.value).toBe('+14155552671');
    expect(check.isE164).toBe(true);
  });

  it('blocks a number the library rejects on length', () => {
    const check = checkPhone('123', loadedSource(false, ''));

    expect(check.verdict).toBe('invalid');
    expect(check.reason).toBe('library-length');
  });

  it('carries the precise verdict without acting on it', () => {
    const precise = source({
      getNumber: () => '+11112223333',
      isValidNumber: () => true,
      isValidNumberPrecise: () => false,
    });
    const check = checkPhone('1112223333', precise);

    expect(check.precise).toBe(false);
    expect(check.verdict).toBe('valid');
  });

  it('says unknown rather than invalid while the utils script is loading', () => {
    const check = checkPhone('4155552671', source());

    expect(check.verdict).toBe('unknown');
    expect(check.reason).toBe('utils-not-loaded');
    expect(check.value).toBe('4155552671');
    expect(check.isE164).toBe(false);
  });

  it('says unknown when there is no phone widget on the page at all', () => {
    const check = checkPhone('4155552671');

    expect(check.verdict).toBe('unknown');
    expect(check.reason).toBe('no-instance');
  });

  it('keeps a number that was already written internationally', () => {
    const check = checkPhone('+44 7700 900123');

    expect(check.value).toBe('+447700900123');
    expect(check.isE164).toBe(true);
    expect(check.verdict).toBe('unknown');
  });

  it('rejects a digit count outside E.164 when nothing else can judge', () => {
    expect(checkPhone('12345').verdict).toBe('invalid');
    expect(checkPhone('12345').reason).toBe('digit-count');
    expect(checkPhone('12345678901234567').verdict).toBe('invalid');
  });
});

describe('normalizePhone', () => {
  it('returns the E.164 number when the library can give one', () => {
    expect(normalizePhone('(415) 555-2671', loadedSource(true))).toBe(
      '+14155552671'
    );
  });

  it('returns the text as typed rather than blanking it mid-load', () => {
    // `getNumber()` answers '' until the utils script lands. Writing that back would
    // erase a phone the shopper had already typed.
    expect(normalizePhone('(415) 555-2671', source())).toBe('(415) 555-2671');
  });
});
