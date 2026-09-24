import { describe, it, expect } from 'vitest';

import {
  checkPhone,
  normalizePhone,
  type PhoneNumberSource,
} from '../phone-validation';

/**
 * A stand-in for one phone field.
 *
 * `null` from `isValidNumber()` is a field saying its rules have not loaded, and `''` from
 * `getNumber()` is the same condition — so the default here is the state a real field is
 * in for the first moments of a page.
 */
function source(overrides: Partial<PhoneNumberSource> = {}): PhoneNumberSource {
  return {
    getNumber: () => '',
    isValidNumber: () => null,
    ...overrides,
  };
}

/**
 * A field answering as it would for a US number. `null` is the rules not having loaded,
 * which is what `isValidNumber` really returns then.
 */
function loadedSource(
  verdict: boolean | null,
  e164 = '+14155552671'
): PhoneNumberSource {
  return source({
    getNumber: () => e164,
    isValidNumber: () => verdict,
  });
}

describe('checkPhone', () => {
  it('treats an empty value as nothing to judge', () => {
    const check = checkPhone('   ');
    expect(check.verdict).toBe('unknown');
    expect(check.reason).toBe('empty');
    expect(check.value).toBe('');
  });

  /**
   * Whether anybody holds a well-formed number is the server's call. The SDK refuses only
   * what the phone library refuses, so a placeholder of the right length goes through and
   * is normalised on the way out.
   */
  it('sends on a well-formed number whoever holds it', () => {
    const check = checkPhone('0000000000', loadedSource(true, '+10000000000'));

    expect(check.verdict).toBe('valid');
    expect(check.value).toBe('+10000000000');
  });

  it("takes the field's verdict and its E.164 number when its rules are loaded", () => {
    const check = checkPhone('(415) 555-2671', loadedSource(true));

    expect(check.verdict).toBe('valid');
    expect(check.reason).toBe('library-length');
    expect(check.value).toBe('+14155552671');
    expect(check.isE164).toBe(true);
  });

  it('blocks a number the library rejects on length', () => {
    // Nine digits where the country wants ten. The widget still formats it, which is why
    // it is the widget's verdict that decides and not the digit count.
    const check = checkPhone('415555267', loadedSource(false, '+1415555267'));

    expect(check.verdict).toBe('invalid');
    expect(check.reason).toBe('library-length');
  });

  it('says unknown rather than invalid while the rules are loading', () => {
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

  it('rejects only what no numbering plan could hold when nothing can judge', () => {
    // Three digits is a service code, seventeen is past E.164's ceiling.
    expect(checkPhone('123').verdict).toBe('invalid');
    expect(checkPhone('123').reason).toBe('digit-count');
    expect(checkPhone('12345678901234567').verdict).toBe('invalid');
  });

  it('does not refuse a short number some country really assigns', () => {
    // Ascension assigns five digits, Niue and Tokelau four. A seven-digit floor here
    // refused every number in nineteen countries.
    expect(checkPhone('62889').verdict).toBe('unknown');
    expect(checkPhone('7012').verdict).toBe('unknown');
  });
});

describe('normalizePhone', () => {
  it('returns the E.164 number when the field can give one', () => {
    expect(normalizePhone('(415) 555-2671', loadedSource(true))).toBe(
      '+14155552671'
    );
  });

  it('returns the text as typed rather than blanking it mid-load', () => {
    // `getNumber()` answers '' until the rules load. Writing that back would
    // erase a phone the shopper had already typed.
    expect(normalizePhone('(415) 555-2671', source())).toBe('(415) 555-2671');
  });
});

describe('a widget whose field is empty', () => {
  /**
   * `getNumber()` answers `''` for an empty field just as it does while the rules load,
   * but the verdict that comes with it is `false`, not `null` — a judgement on a
   * number that is not there. A phone restored from an earlier visit is judged before the
   * field is populated, and taking that `false` would refuse a number that is fine.
   */
  const emptyField: PhoneNumberSource = {
    getNumber: () => '',
    isValidNumber: () => false,
  };

  it('does not take its verdict', () => {
    const check = checkPhone('+14155552671', emptyField);

    expect(check.verdict).toBe('unknown');
    expect(check.reason).toBe('no-instance');
    expect(check.value).toBe('+14155552671');
    expect(check.isE164).toBe(true);
  });

  it('still says unknown while unloaded rules are the reason there is no number', () => {
    const check = checkPhone('4155552671', source());

    expect(check.verdict).toBe('unknown');
    expect(check.reason).toBe('utils-not-loaded');
  });
});

describe('an E.164 number written in the text, with no widget', () => {
  /**
   * One length rule for both sources. The text path used to demand eight digits, so a
   * complete E.164 number from a short numbering plan was reported as *not* E.164 and the
   * order builder warned that it had failed to convert something already converted.
   */
  it('recognises a number as short as a dial code plus four digits', () => {
    expect(checkPhone('+6831234').isE164).toBe(true); // Niue
    expect(checkPhone('+2901234').isE164).toBe(true); // Saint Helena
  });

  it('still refuses a bare dial code', () => {
    expect(checkPhone('+1').isE164).toBe(false);
    expect(checkPhone('+299').isE164).toBe(false);
  });

  it('still refuses more digits than E.164 allows', () => {
    expect(checkPhone('+1234567890123456').isE164).toBe(false);
  });

  /** Counting digits alone would call these E.164 and send the letters to the API. */
  it('refuses anything but digits after the plus', () => {
    expect(checkPhone('+1415CALL2671').isE164).toBe(false);
    expect(checkPhone('+1 415 ABC 2671').isE164).toBe(false);
    expect(checkPhone('+1_415_555_2671').isE164).toBe(false);
  });

  it('still strips the punctuation a shopper types', () => {
    expect(checkPhone('+44 7700 900123').value).toBe('+447700900123');
  });
});

describe('a widget offering a dial code instead of a number', () => {
  /** Adopting it would replace the shopper's ten digits with a country. */
  it('does not take a bare dial code as the number', () => {
    const check = checkPhone('4155552671', loadedSource(null, '+1'));

    expect(check.value).toBe('4155552671');
    expect(check.isE164).toBe(false);
  });

  it('does not take a three-digit dial code either', () => {
    const check = checkPhone('4155552671', loadedSource(null, '+299'));

    expect(check.value).toBe('4155552671');
    expect(check.isE164).toBe(false);
  });

  it('still takes a real number that is barely longer than one', () => {
    // Greenland: +299 321000. Five digits would be the floor; this is nine.
    const check = checkPhone('321000', loadedSource(true, '+299321000'));

    expect(check.value).toBe('+299321000');
    expect(check.isE164).toBe(true);
  });
});

describe('a widget speaking for its own field', () => {
  /** The value came from the field this widget is bound to — the contract on `checkPhone`. */
  it('takes the international form of a number written nationally', () => {
    const uk = loadedSource(true, '+447700900123');

    expect(checkPhone('07700 900123', uk).value).toBe('+447700900123');
    expect(checkPhone('07700 900123', uk).verdict).toBe('valid');
  });

  it('trusts it for a national number shorter than a dial code', () => {
    // Greenland: +299 321000, six national digits.
    const check = checkPhone('32 10 00', loadedSource(true, '+299321000'));

    expect(check.verdict).toBe('valid');
    expect(check.value).toBe('+299321000');
  });
});
