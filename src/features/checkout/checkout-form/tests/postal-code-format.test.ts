import { describe, it, expect, vi } from 'vitest';
import {
  formatPostalCodeInPlace,
  type PostalCodeFormatContext,
} from '../postal-code-format';
import type { CountryConfig, I18nRules } from '@/core/i18n-rules';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CA_CONFIG = { countryCode: 'CA' } as unknown as CountryConfig;

function createCtx(
  options: {
    format?: (value: string) => string;
    configs?: Array<[string, CountryConfig]>;
  } = {}
): {
  ctx: PostalCodeFormatContext;
  formatSpy: ReturnType<typeof vi.fn>;
} {
  const formatSpy = vi.fn((value: string) =>
    options.format ? options.format(value) : value
  );
  const ctx: PostalCodeFormatContext = {
    i18nRules: {
      formatPostalCode: formatSpy,
    } as unknown as I18nRules,
    countryConfigs: new Map(options.configs ?? [['CA', CA_CONFIG]]),
  };
  return { ctx, formatSpy };
}

function createCountrySelect(value: string): HTMLSelectElement {
  const select = document.createElement('select');
  const option = document.createElement('option');
  option.value = value;
  select.appendChild(option);
  select.value = value;
  return select;
}

function createPostalInput(value: string): HTMLInputElement {
  const input = document.createElement('input');
  input.value = value;
  document.body.appendChild(input);
  return input;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('formatPostalCodeInPlace', () => {
  it('rewrites the value into the country format', () => {
    const { ctx } = createCtx({ format: () => 'K1A 0B1' });
    const input = createPostalInput('k1a0b1');

    formatPostalCodeInPlace(ctx, input, createCountrySelect('CA'));

    expect(input.value).toBe('K1A 0B1');
  });

  /**
   * The reason the caret is repaired at all: inserting the space would otherwise drop the
   * cursor to the end of the field, and a shopper correcting a character mid-postcode
   * types the rest of it backwards.
   */
  it('puts the caret back after the same characters, before a space the format added', () => {
    const { ctx } = createCtx({ format: () => 'K1A 0B1' });
    const input = createPostalInput('k1a0b1');
    input.setSelectionRange(3, 3);

    formatPostalCodeInPlace(ctx, input, createCountrySelect('CA'));

    expect(input.selectionStart).toBe(3);
  });

  describe('the caret, against a UK-style format', () => {
    const uk = (value: string): string => {
      const compact = value.replace(/[\s-]/g, '').toUpperCase();
      return compact.length > 3
        ? `${compact.slice(0, -3)} ${compact.slice(-3)}`
        : compact;
    };

    it('stays after a character typed at the start', () => {
      const { ctx } = createCtx({ format: uk });
      const input = createPostalInput('SW1A1AA');
      input.setSelectionRange(1, 1);

      formatPostalCodeInPlace(ctx, input, createCountrySelect('CA'));

      expect(input.value).toBe('SW1A 1AA');
      expect(input.selectionStart).toBe(1);
    });

    it('lets Backspace step back over the space instead of sticking behind it', () => {
      const { ctx } = createCtx({ format: uk });
      // `SW1A 1AA` with the space just deleted, caret where it was.
      const input = createPostalInput('SW1A1AA');
      input.setSelectionRange(4, 4);

      formatPostalCodeInPlace(ctx, input, createCountrySelect('CA'));

      expect(input.value).toBe('SW1A 1AA');
      expect(input.selectionStart).toBe(4);
    });

    it('follows typing at the end past the space it adds', () => {
      const { ctx } = createCtx({ format: uk });
      const input = createPostalInput('sw1a1');
      input.setSelectionRange(5, 5);

      formatPostalCodeInPlace(ctx, input, createCountrySelect('CA'));

      expect(input.value).toBe('SW 1A1');
      expect(input.selectionStart).toBe(6);
    });
  });

  it('leaves an already-formatted value untouched', () => {
    const { ctx } = createCtx({ format: value => value });
    const input = createPostalInput('K1A 0B1');
    input.setSelectionRange(2, 2);

    formatPostalCodeInPlace(ctx, input, createCountrySelect('CA'));

    expect(input.value).toBe('K1A 0B1');
    expect(input.selectionStart).toBe(2);
  });

  it('does nothing when no country is selected yet', () => {
    const { ctx, formatSpy } = createCtx({ format: () => 'K1A 0B1' });
    const input = createPostalInput('k1a0b1');

    formatPostalCodeInPlace(ctx, input, createCountrySelect(''));

    expect(formatSpy).not.toHaveBeenCalled();
    expect(input.value).toBe('k1a0b1');
  });

  it('does nothing when the country field is absent', () => {
    const { ctx, formatSpy } = createCtx({ format: () => 'K1A 0B1' });
    const input = createPostalInput('k1a0b1');

    formatPostalCodeInPlace(ctx, input, undefined);

    expect(formatSpy).not.toHaveBeenCalled();
  });

  /**
   * The config arrives from a network fetch, so early keystrokes can land before it does.
   * Formatting is skipped rather than guessed — the value is still written to the store.
   */
  it('does nothing when the country config has not arrived', () => {
    const { ctx, formatSpy } = createCtx({
      format: () => 'K1A 0B1',
      configs: [],
    });
    const input = createPostalInput('k1a0b1');

    formatPostalCodeInPlace(ctx, input, createCountrySelect('CA'));

    expect(formatSpy).not.toHaveBeenCalled();
    expect(input.value).toBe('k1a0b1');
  });
});
