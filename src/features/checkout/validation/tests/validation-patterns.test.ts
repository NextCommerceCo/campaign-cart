import { describe, expect, it } from 'vitest';

import { hasEmoji, isValidEmail } from '../validation-patterns';

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

describe('hasEmoji', () => {
  it('finds any emoji, however it is built', () => {
    for (const value of ['Jane 😀', '🇹🇭', '👩‍💻', '👍🏽', '❤️', '1️⃣', '™️']) {
      expect(hasEmoji(value), value).toBe(true);
    }
  });

  it('takes symbols and scripts that are text, not emojis', () => {
    for (const value of [
      'Acme™ Ltd',
      '© ®',
      'Unit 4 → rear',
      'สมชาย ใจดี',
      'क्‍ष',
      'Straße 5',
      '★',
    ]) {
      expect(hasEmoji(value), value).toBe(false);
    }
  });

  it('ignores a value that is not text', () => {
    expect(hasEmoji(undefined)).toBe(false);
    expect(hasEmoji(true)).toBe(false);
  });
});
