import { describe, it, expect, vi } from 'vitest';
import {
  formatPostalCodeInPlace,
  type PostalCodeFormatContext,
} from '../postal-code-format';
import type { CountryConfig, CountryService } from '@/core/country-service';

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
    countryService: {
      formatPostalCode: formatSpy,
    } as unknown as CountryService,
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
  it('moves the caret by the length the value grew', () => {
    const { ctx } = createCtx({ format: () => 'K1A 0B1' });
    const input = createPostalInput('k1a0b1');
    input.setSelectionRange(3, 3);

    formatPostalCodeInPlace(ctx, input, createCountrySelect('CA'));

    expect(input.selectionStart).toBe(4);
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
