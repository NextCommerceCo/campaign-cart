import { describe, expect, it } from 'vitest';
import { asciiDigits, formatPhone, phoneKey, plausiblePhone } from '../../../src/checkout/state/phone';
import { TH, US } from '../../fixtures/rules';

const us = US.fields.phone_number!.format;
const th = TH.fields.phone_number!.format;

describe('phone', () => {
  it('writes Thai, Arabic-Indic and full-width digits as ASCII, one character each', () => {
    expect(asciiDigits('๐๘๑ ๒๓๔')).toBe('081 234');
    expect(asciiDigits('٠٥٠')).toBe('050');
    expect(asciiDigits('＋６６')).toBe('+66');
  });

  it('compares numbers by their digits and plus only', () => {
    expect(phoneKey('(415) 555-2671')).toBe(phoneKey('415 555 2671'));
    expect(phoneKey('+1 415 555 2671')).toBe('+14155552671');
  });

  it("masks a national number in its country's format as it is typed", () => {
    expect(formatPhone('41555', us)).toBe('(415) 55');
    expect(formatPhone('4155552671', us)).toBe('(415) 555-2671');
    expect(formatPhone('14155552671', us)).toBe('1 (415) 555-2671');
    expect(formatPhone('021234567', th)).toBe('02 123 4567');
    expect(formatPhone('0812345678', th)).toBe('081 234 5678');
  });

  it('keeps a number typed with + or 00 as written, and digits the mask has no room for as typed', () => {
    expect(formatPhone('+66 (81) 234-5678', us)).toBe('+66 81 234-5678');
    expect(formatPhone('0066812345678', us)).toBe('0066812345678');
    expect(formatPhone('415555267199', us)).toBe('415555267199');
  });

  it("checks the country's loose pattern, and only E.164 length for another country's code", () => {
    expect(plausiblePhone('(415) 555-2671', us)).toBe(true);
    expect(plausiblePhone('555-2671', us)).toBe(false);
    expect(plausiblePhone('+1 415 555 2671', us)).toBe(true);
    expect(plausiblePhone('+1 555 2671', us)).toBe(false);
    expect(plausiblePhone('+66 81 234 5678', us)).toBe(true);
    expect(plausiblePhone('+66 81', us)).toBe(false);
    expect(plausiblePhone('๐๘๑๒๓๔๕๖๗๘', th)).toBe(true);
  });

  it('counts 4 to 15 digits where the country has no pattern', () => {
    expect(plausiblePhone('888 4012')).toBe(true);
    expect(plausiblePhone('123')).toBe(false);
    expect(plausiblePhone('1234567890123456')).toBe(false);
  });
});
