import { describe, expect, it } from 'vitest';

import {
  VALIDATION_PATTERNS,
  isValidCity,
  isValidEmail,
  isValidName,
  isValidPhone,
} from '../validation-patterns';

describe('isValidEmail', () => {
  it('accepts ordinary addresses, including two-letter TLDs', () => {
    expect(isValidEmail('shopper@example.com')).toBe(true);
    expect(isValidEmail('shopper@example.co')).toBe(true);
    expect(isValidEmail('first.last+tag@sub.example.co.uk')).toBe(true);
  });

  it('rejects the shapes a mistyped address takes', () => {
    expect(isValidEmail('shopper@example')).toBe(false);
    expect(isValidEmail('shopper@@example.com')).toBe(false);
    expect(isValidEmail('shopper..name@example.com')).toBe(false);
    expect(isValidEmail('.shopper@example.com')).toBe(false);
    expect(isValidEmail('shopper@example.c')).toBe(false);
  });
});

describe('isValidPhone', () => {
  it('accepts a punctuated ten-digit number', () => {
    expect(isValidPhone('(555) 123-4567')).toBe(true);
    expect(isValidPhone('+1 555 123 4567')).toBe(true);
  });

  it('rejects letters and anything under ten digits', () => {
    expect(isValidPhone('555-CALL-NOW')).toBe(false);
    expect(isValidPhone('555 1234')).toBe(false);
  });

  /**
   * DEFECT (left as found) — the ten-digit floor is a US assumption applied to every
   * country. A shopper in Norway (8 national digits), Denmark (8) or Iceland (7) types a
   * complete, correct number and is told "Please enter a valid phone number".
   *
   * It only bites where `intl-tel-input` is not wired up, because the form installs a
   * country-aware `phoneValidator` that takes priority — see `form-validation.ts`. On a
   * page without it, checkout is unreachable for those countries.
   */
  it('DEFECT: rejects complete national numbers shorter than ten digits', () => {
    expect(isValidPhone('+47 22 12 34 56')).toBe(true); // has 10 digits once the +47 counts
    expect(isValidPhone('22 12 34 56')).toBe(false); // the same Norwegian number, nationally
  });
});

describe('isValidName', () => {
  it('accepts Latin names with the separators people actually use', () => {
    expect(isValidName('Ada')).toBe(true);
    expect(isValidName("O'Brien")).toBe(true);
    expect(isValidName('Anne-Marie du Pré')).toBe(true);
  });

  it('rejects digits and empty input', () => {
    expect(isValidName('Jane 2nd')).toBe(false);
    expect(isValidName('   ')).toBe(false);
  });

  // Finding 130 — NAME used to be [A-Za-zÀ-ÿ], Latin-1 only, while the city check next
  // door already used \p{L} and accepted every script. A shopper whose name is written
  // in Japanese, Cyrillic, Greek, Thai or Chinese could not get past the first name
  // field, while the same shopper's city in the same script passed on the same form.
  it('accepts names written in any script, matching the city check', () => {
    expect(isValidName('田中')).toBe(true);
    expect(isValidName('Владимир')).toBe(true);
    expect(isValidName('Γεώργιος')).toBe(true);
    expect(isValidName('สมชาย')).toBe(true);

    expect(isValidCity('東京')).toBe(true);
    expect(isValidCity('Москва')).toBe(true);
  });

  // \p{L} is a proper Unicode letter class, unlike the old À-ÿ code-point range, so it
  // no longer lets U+00D7 (×) and U+00F7 (÷) — maths symbols, not letters — through.
  it('rejects the multiplication and division signs the old Latin-1 range let through', () => {
    expect(isValidName('A×B')).toBe(false);
    expect(isValidName('A÷B')).toBe(false);
  });

  // Finding 130 — the separator class held only the straight apostrophe (U+0027).
  // iOS, macOS and Word all autocorrect a typed `'` to the curly U+2019, so
  // "O'Brien" as actually typed on an iPhone was rejected with nothing on screen
  // explaining why.
  it('accepts both the straight and the curly apostrophe', () => {
    expect(isValidName("O'Brien")).toBe(true); // U+0027
    expect(isValidName('O’Brien')).toBe(true); // U+2019, what an iPhone types
  });

  it('still rejects a leading, trailing, or doubled separator', () => {
    expect(isValidName('-Paris')).toBe(false);
    expect(isValidName('Paris-')).toBe(false);
    expect(isValidName('Anne--Marie')).toBe(false);
  });

  it('still rejects markup and digits mixed into an otherwise valid name', () => {
    expect(isValidName('<script>')).toBe(false);
    expect(isValidName('John3')).toBe(false);
  });
});

describe('isValidCity', () => {
  it('accepts real city names in any script', () => {
    expect(isValidCity('New York')).toBe(true);
    expect(isValidCity('São Paulo')).toBe(true);
    expect(isValidCity('Mont-Saint-Michel')).toBe(true);
    expect(isValidCity('St. Johns')).toBe(true);
  });

  it('rejects digits, one-character input, and a leading symbol', () => {
    expect(isValidCity('Area 51')).toBe(false);
    expect(isValidCity('X')).toBe(false);
    expect(isValidCity('-Paris')).toBe(false);
    expect(isValidCity('')).toBe(false);
  });

  // Finding 130 — the CITY class held U+0027 twice and no U+2019, despite the comment
  // above the pattern claiming it handled "both straight and curly" and citing
  // "St. John's" as a worked example. Now the class actually contains U+2019.
  it('accepts the curly apostrophe the comment always claimed to allow', () => {
    const cityClass = VALIDATION_PATTERNS.CITY.source;
    expect(cityClass).toContain('’');

    expect(isValidCity("St. John's")).toBe(true); // U+0027
    expect(isValidCity('St. John’s')).toBe(true); // U+2019, what an iPhone types
  });
});
