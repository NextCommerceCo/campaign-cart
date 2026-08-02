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

  /**
   * DEFECT (left as found) — `NAME` is `[A-Za-zÀ-ÿ]`, which is Latin-1 only, while the
   * city check next door uses `\p{L}` and accepts every script. So a shopper whose name
   * is written in Japanese, Cyrillic, Greek, Arabic, Thai or Chinese cannot get past the
   * first name field: they are told "Name can only contain letters, spaces, hyphens, and
   * apostrophes" about a name made entirely of letters.
   *
   * This blocks the sale outright — the same shopper may type their *city* in the same
   * script and it passes.
   */
  it('DEFECT: rejects every non-Latin script, while the city check accepts them', () => {
    expect(isValidName('田中')).toBe(false);
    expect(isValidName('Владимир')).toBe(false);
    expect(isValidName('Γεώργιος')).toBe(false);

    expect(isValidCity('東京')).toBe(true);
    expect(isValidCity('Москва')).toBe(true);
  });

  /**
   * DEFECT (left as found) — the range `À-ÿ` is a *code-point* range, and U+00D7 (×) and
   * U+00F7 (÷) sit inside it. Both are maths symbols, not letters, so a name containing
   * one passes a check whose whole purpose is to reject non-letters.
   *
   * Harmless to the shopper; it means the rule is looser than its own error message.
   */
  it('DEFECT: the Latin-1 range lets the multiplication and division signs through', () => {
    expect(isValidName('A×B')).toBe(true);
    expect(isValidName('A÷B')).toBe(true);
  });

  /**
   * DEFECT (left as found) — the separator class is `[' -]` with a **straight**
   * apostrophe. iOS, macOS and Word all convert a typed `'` to the curly U+2019, so
   * "O’Brien" as actually typed on an iPhone is rejected.
   */
  it('DEFECT: rejects the curly apostrophe every phone keyboard produces', () => {
    expect(isValidName("O'Brien")).toBe(true); // U+0027
    expect(isValidName('O’Brien')).toBe(false); // U+2019, what an iPhone types
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

  /**
   * DEFECT (left as found) — the `CITY` character class is `[\p{L}\s.''-]`, in which the
   * two apostrophes are **both** U+0027; the curly U+2019 is not in the class at all. The
   * comment above the pattern says it allows "apostrophes (both straight and curly)" and
   * lists `"St. John's"` and `"O'Fallon"` as working examples, so the code and its own
   * documentation disagree.
   *
   * A shopper on an iPhone typing "St. John's" — where the keyboard produces U+2019 — is
   * told "Please enter a valid city name" and cannot complete the order without knowing to
   * retype the apostrophe.
   */
  it('DEFECT: the curly apostrophe the comment claims to allow is not in the pattern', () => {
    const cityClass = VALIDATION_PATTERNS.CITY.source;
    expect(cityClass).not.toContain('’');

    expect(isValidCity("St. John's")).toBe(true); // U+0027
    expect(isValidCity('St. John’s')).toBe(false); // U+2019, what an iPhone types
  });
});
