import { describe, it, expect, vi } from 'vitest';
import { isValidEmail, isValidName, isValidPhone } from '../validation';
import type { Logger } from '@/core/logger';

function createMockLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe('isValidEmail', () => {
  it.each([
    'user@example.com',
    'user.name@example.co.uk',
    'user+tag@example.co',
    'a@b.io',
  ])('accepts %s', email => {
    expect(isValidEmail(email)).toBe(true);
  });

  it.each([
    '',
    'plain',
    'user@example',
    'user@example.c',
    'user..name@example.com',
    '.user@example.com',
    'user@.example.com',
  ])('rejects %s', email => {
    expect(isValidEmail(email)).toBe(false);
  });
});

describe('isValidName', () => {
  it('accepts simple, hyphenated, apostrophe’d, and accented names', () => {
    expect(isValidName('Jane')).toBe(true);
    expect(isValidName("O'Connor")).toBe(true);
    expect(isValidName('Mary-Jane')).toBe(true);
    expect(isValidName('José')).toBe(true);
  });

  it('rejects empty, single-character, and non-letter names', () => {
    expect(isValidName('')).toBe(false);
    expect(isValidName('A')).toBe(false);
    expect(isValidName('John123')).toBe(false);
  });
});

describe('isValidPhone', () => {
  it('returns false for empty input regardless of context', () => {
    const logger = createMockLogger();
    expect(
      isValidPhone('', {
        phoneField: undefined,
        minPhoneDigits: 7,
        logger: logger as unknown as Logger,
      })
    ).toBe(false);
  });

  it('uses intlTelInput.isValidNumber when the phone field carries an instance', () => {
    const logger = createMockLogger();
    const phoneField = document.createElement('input') as any;
    phoneField.iti = { isValidNumber: vi.fn().mockReturnValue(true) };

    const result = isValidPhone('+15551234567', {
      phoneField,
      minPhoneDigits: 7,
      logger: logger as unknown as Logger,
    });
    expect(result).toBe(true);
    expect(phoneField.iti.isValidNumber).toHaveBeenCalled();
  });

  it('falls back to the configured digit count when intlTelInput throws', () => {
    const logger = createMockLogger();
    const phoneField = document.createElement('input') as any;
    phoneField.iti = {
      isValidNumber: vi.fn().mockImplementation(() => {
        throw new Error('boom');
      }),
    };

    expect(
      isValidPhone('555-123-4567', {
        phoneField,
        minPhoneDigits: 7,
        logger: logger as unknown as Logger,
      })
    ).toBe(true);
    expect(
      isValidPhone('555-12', {
        phoneField: undefined,
        minPhoneDigits: 7,
        logger: logger as unknown as Logger,
      })
    ).toBe(false);
  });

  it('defaults minPhoneDigits to 7 when the context omits it', () => {
    const logger = createMockLogger();
    expect(
      isValidPhone('123456', {
        phoneField: undefined,
        minPhoneDigits: undefined,
        logger: logger as unknown as Logger,
      })
    ).toBe(false);
    expect(
      isValidPhone('1234567', {
        phoneField: undefined,
        minPhoneDigits: undefined,
        logger: logger as unknown as Logger,
      })
    ).toBe(true);
  });
});
