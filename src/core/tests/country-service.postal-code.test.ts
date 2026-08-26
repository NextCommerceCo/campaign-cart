import { describe, it, expect, vi } from 'vitest';
import {
  formatPostalCode,
  validatePostalCode,
  withPostcodeFormats,
} from '@/core/country-service/country-service.postal-code';
import type { CountryConfig } from '@/core/country-service';
import type { Logger } from '@/core/logger';

/**
 * Snapshot of every country the countries CDN
 * (`cdn-countries.muddy-wind-c7ca.workers.dev/countries/{CODE}/states`) ships a
 * `postcodeFormat` for, captured 2026-08-26. Frozen here so the domain pass runs
 * against the authority's own data without a network call.
 *
 * [code, postcodeFormat, postcodeRegex, minLength, maxLength, postcodeExample]
 */
const CDN_FORMATS = [
  ['AT', 'NNNN', '^\\d{4}$', 4, 4, '1010'],
  ['AU', 'NNNN', '^\\d{4}$', 4, 4, '2000'],
  ['BE', 'NNNN', '^\\d{4}$', 4, 4, '1000'],
  ['BG', 'NNNN', '^\\d{4}$', 4, 4, '1000'],
  ['BR', 'NNNNN-NNN', '^\\d{5}-?\\d{3}$', 8, 9, '01310-100'],
  ['CA', 'ANA NAN', '^[A-Za-z]\\d[A-Za-z] ?\\d[A-Za-z]\\d$', 6, 7, 'K1A 0B1'],
  ['CH', 'NNNN', '^\\d{4}$', 4, 4, '8001'],
  ['CZ', 'NNN NN', '^\\d{3} ?\\d{2}$', 5, 6, '123 45'],
  ['DE', 'NNNNN', '^\\d{5}$', 5, 5, '10115'],
  ['DK', 'NNNN', '^\\d{4}$', 4, 4, '2100'],
  ['EE', 'NNNNN', '^\\d{5}$', 5, 5, '10111'],
  ['ES', 'NNNNN', '^\\d{5}$', 5, 5, '28013'],
  ['FI', 'NNNNN', '^\\d{5}$', 5, 5, '00100'],
  ['FR', 'NNNNN', '^\\d{5}$', 5, 5, '75001'],
  [
    'GB',
    'AANN NAA',
    '^[A-Za-z]{1,2}\\d[A-Za-z\\d]? ?\\d[A-Za-z]{2}$',
    5,
    8,
    'SW1A 0AA',
  ],
  ['GI', 'GX11 1AA', '^GX11 1AA$', 8, 8, 'GX11 1AA'],
  ['GR', 'NNN NN', '^\\d{3} ?\\d{2}$', 5, 6, '105 58'],
  ['HR', 'NNNNN', '^\\d{5}$', 5, 5, '10000'],
  ['HU', 'NNNN', '^\\d{4}$', 4, 4, '1051'],
  [
    'IE',
    'ANN ANNN',
    '^[A-Za-z]\\d[\\dA-Za-z] ?[\\dA-Za-z]{4}$',
    7,
    8,
    'D02 X285',
  ],
  [
    'IM',
    'IMN NAA',
    '^[Ii][Mm]\\d{1,2} ?\\d[A-HJ-NP-UW-Za-hj-np-uw-z]{2}$',
    6,
    7,
    'IM2 1AA',
  ],
  ['IS', 'NNN', '^\\d{3}$', 3, 3, '101'],
  ['IT', 'NNNNN', '^\\d{5}$', 5, 5, '00100'],
  [
    'JE',
    'JEN NAA',
    '^[Jj][Ee]\\d{1,2} ?\\d[A-HJ-NP-UW-Za-hj-np-uw-z]{2}$',
    6,
    7,
    'JE2 3ZZ',
  ],
  ['JP', 'NNN-NNNN', '^\\d{3}-?\\d{4}$', 7, 8, '100-0001'],
  ['KR', 'NNNNN', '^\\d{5}$', 5, 5, '04524'],
  ['LI', 'NNNN', '^94(8[5-9]|9[0-8])$', 4, 4, '9490'],
  ['LT', 'LT-NNNNN', '^([Ll][Tt]-)?\\d{5}$', 5, 8, 'LT-01100'],
  ['LU', 'NNNN', '^\\d{4}$', 4, 4, '1009'],
  ['MC', '980NN', '^980\\d{2}$', 5, 5, '98000'],
  ['MD', 'NNNN', '^([Mm][Dd]-?)?\\d{4}$', 4, 7, '2001'],
  ['MT', 'AAA NNNN', '^[A-Za-z]{3} ?\\d{4}$', 7, 8, 'VLT 1117'],
  ['NL', 'NNNN AA', '^\\d{4} ?[A-Za-z]{2}$', 6, 7, '1234 AB'],
  ['NO', 'NNNN', '^\\d{4}$', 4, 4, '0150'],
  ['NZ', 'NNNN', '^\\d{4}$', 4, 4, '6011'],
  ['PL', 'NN-NNN', '^\\d{2}-\\d{3}$', 6, 6, '00-001'],
  ['PT', 'NNNN-NNN', '^\\d{4}-\\d{3}$', 8, 8, '1000-001'],
  ['RO', 'NNNNNN', '^\\d{6}$', 6, 6, '010011'],
  ['RS', 'NNNNN', '^\\d{5}$', 5, 5, '11000'],
  ['SA', 'NNNNN', '^\\d{5}$', 5, 5, '11564'],
  ['SE', 'NNN NN', '^\\d{3} ?\\d{2}$', 5, 6, '123 45'],
  ['SG', 'NNNNNN', '^\\d{6}$', 6, 6, '018956'],
  ['SI', 'NNNN', '^\\d{4}$', 4, 4, '1000'],
  ['SK', 'NNN NN', '^\\d{3} ?\\d{2}$', 5, 6, '123 45'],
  ['TR', 'NNNNN', '^\\d{5}$', 5, 5, '34000'],
  [
    'US',
    'NNNNN-NNNN',
    '^(\\d{5}|\\d{5}-\\d{4})$',
    5,
    10,
    '12345 or 12345-6789',
  ],
  ['ZA', 'NNNN', '^\\d{4}$', 4, 4, '8000'],
] as const satisfies readonly (readonly [
  string,
  string,
  string,
  number,
  number,
  string,
])[];

type CdnRow = (typeof CDN_FORMATS)[number];

const rowOf = (code: string): CdnRow => {
  const row = CDN_FORMATS.find(entry => entry[0] === code);
  if (!row) throw new Error(`No frozen CDN row for ${code}`);
  return row;
};

/**
 * The config a caller actually holds: what the countries service sent, read
 * through `withPostcodeFormats` the way `CountryService` reads it.
 */
function configOf(code: string, overrides?: Partial<CountryConfig>) {
  const [, postcodeFormat, postcodeRegex, min, max, postcodeExample] =
    rowOf(code);
  return withPostcodeFormats(code, {
    stateLabel: 'State',
    stateRequired: false,
    postcodeLabel: 'Postcode',
    postcodeRegex,
    postcodeMinLength: min,
    postcodeMaxLength: max,
    postcodeExample,
    postcodeFormat,
    currencyCode: 'USD',
    currencySymbol: '$',
    ...overrides,
  } satisfies CountryConfig);
}

/** Formats with `code`'s config and asserts the result against its own regex. */
function expectAcceptedByOwnRegex(code: string, input: string): string {
  const formatted = formatPostalCode(input, configOf(code));
  expect(
    new RegExp(rowOf(code)[2]).test(formatted),
    `${code}: ${JSON.stringify(input)} formatted to ${JSON.stringify(formatted)}`
  ).toBe(true);
  return formatted;
}

const loggerStub = () =>
  ({ error: vi.fn() }) as unknown as Logger & {
    error: ReturnType<typeof vi.fn>;
  };

// ─── formatPostalCode — the CDN's own examples ────────────────────────────────

describe('formatPostalCode over every CDN country', () => {
  // US is excluded here: its postcodeExample is the prose string
  // '12345 or 12345-6789', not a postcode, so it is covered separately below.
  const examples = CDN_FORMATS.filter(row => row[0] !== 'US').map(row => [
    row[0],
    row[5],
  ]) as [string, string][];

  it.each(examples)(
    '%s formats its own postcodeExample %s into a value its own regex accepts',
    (code, example) => {
      expectAcceptedByOwnRegex(code, example);
    }
  );

  it('US postcodeExample is prose, so both real ZIP shapes are asserted instead', () => {
    expect(expectAcceptedByOwnRegex('US', '12345')).toBe('12345');
    expect(expectAcceptedByOwnRegex('US', '12345-6789')).toBe('12345-6789');
  });
});

// ─── formatPostalCode — variable-length outward codes ─────────────────────────

describe('formatPostalCode leaves a valid GB postcode as written', () => {
  // GB outward codes run 2 to 4 characters. Anchoring the format's literals to
  // the start of the code produced the second column here before the fix, so the
  // expectations are pinned as literals.
  const cases: [string, string][] = [
    ['M1 1AE', 'M1 1AE'],
    ['CR2 6XH', 'CR2 6XH'],
    ['B33 8TH', 'B33 8TH'],
    ['W1A 0AX', 'W1A 0AX'],
    ['L1 8JQ', 'L1 8JQ'],
    ['SW1A 1AA', 'SW1A 1AA'],
    ['DN55 1PT', 'DN55 1PT'],
    ['M60 1NW', 'M60 1NW'],
    ['E1W 3TJ', 'E1W 3TJ'],
    ['EC1A 1BB', 'EC1A 1BB'],
  ];

  it.each(cases)('%s stays %s', (input, expected) => {
    expect(expectAcceptedByOwnRegex('GB', input)).toBe(expected);
  });
});

// ─── formatPostalCode — repairing separator-less input ────────────────────────

describe('formatPostalCode inserts the separators a country writes', () => {
  const cases: [string, string, string][] = [
    ['GB', 'm11ae', 'M1 1AE'],
    ['GB', 'cr26xh', 'CR2 6XH'],
    ['CA', 'k1a0b1', 'K1A 0B1'],
    ['NL', '1012JS', '1012 JS'],
    ['JP', '5300001', '530-0001'],
    ['BR', '01310100', '01310-100'],
    ['US', '12345', '12345'],
    ['US', '123456789', '12345-6789'],
  ];

  it.each(cases)('%s %s becomes %s', (code, input, expected) => {
    expect(expectAcceptedByOwnRegex(code, input)).toBe(expected);
  });
});

// ─── formatPostalCode — formats whose literals collide with slot letters ──────

describe('formatPostalCode over countries whose format carries literals', () => {
  // The pattern language has no escape, so a literal that is also a slot
  // character is consumed as a slot (MC '980NN', GI 'GX11 1AA'). IM 'IMN NAA'
  // and JE 'JEN NAA' go the other way: 'I'/'M'/'J'/'E' are literals, leaving
  // four slots for a six-character code, so neither anchor can place it. Every
  // result below is still accepted by its own regex.
  const cases: [string, string, string][] = [
    ['MC', '98000', '98000'],
    ['IM', 'IM2 1AA', 'IM2 1AA'],
    ['JE', 'JE2 3ZZ', 'JE2 3ZZ'],
    ['LT', 'LT-01100', 'LT-01100'],
    ['LT', '01100', 'LT-01100'],
    ['GI', 'GX11 1AA', 'GX11 1AA'],
  ];

  it.each(cases)('%s %s becomes %s', (code, input, expected) => {
    expect(expectAcceptedByOwnRegex(code, input)).toBe(expected);
  });

  it('keeps the separator the shopper typed', () => {
    expect(expectAcceptedByOwnRegex('IM', 'im2 1aa')).toBe('IM2 1AA');
  });
});

// ─── formatPostalCode — a config carrying several formats ────────────────────

describe('formatPostalCode tries every format the config lists', () => {
  // withPostcodeFormats puts this SDK's formats in front of the one the service
  // sent, for the patterns neither anchor expresses.
  const cases: [string, string, string][] = [
    ['IM', 'im21aa', 'IM2 1AA'],
    ['JE', 'je23zz', 'JE2 3ZZ'],
    ['GI', 'GX111AA', 'GX11 1AA'],
    ['LT', 'LT55798', 'LT-55798'],
  ];

  it.each(cases)('%s %s becomes %s', (code, input, expected) => {
    expect(expectAcceptedByOwnRegex(code, input)).toBe(expected);
  });

  it('leaves a 7-character IM code unspaced, since spaced it exceeds the country maximum', () => {
    expect(formatPostalCode('IM991AA', configOf('IM'))).toBe('IM991AA');
  });
});

// ─── a config that lists its own formats ─────────────────────────────────────

describe('withPostcodeFormats', () => {
  it('leaves a country it has no formats for untouched', () => {
    const [, format, regex, min, max, example] = rowOf('DE');
    const sent = {
      stateLabel: 'State',
      stateRequired: false,
      postcodeLabel: 'Postcode',
      postcodeRegex: regex,
      postcodeMinLength: min,
      postcodeMaxLength: max,
      postcodeExample: example,
      postcodeFormat: format,
      currencyCode: 'EUR',
      currencySymbol: '€',
    } satisfies CountryConfig;

    expect(withPostcodeFormats('DE', sent)).toBe(sent);
  });

  it("puts its own formats in front of the service's, without repeating one", () => {
    const merged = withPostcodeFormats('LT', configOf('LT'));
    expect(merged.postcodeFormat).toEqual(['LT-NNNNN', 'AA-NNNNN']);
  });

  it('is case-insensitive about the country code', () => {
    const merged = withPostcodeFormats('gi', configOf('DE'));
    expect(merged.postcodeFormat).toEqual(['AANN NAA', 'NNNNN']);
  });
});

describe('formatPostalCode with a list in the config', () => {
  // A country described by three formats instead of one, which is what a
  // countries service shipping a list for GB would send.
  const gbAsAList = configOf('GB', {
    postcodeFormat: ['AANN NAA', 'AAN NAA', 'AN NAA'],
  });

  const cases: [string, string][] = [
    ['m11ae', 'M1 1AE'],
    ['cr26xh', 'CR2 6XH'],
    ['sw1a1aa', 'SW1A 1AA'],
    ['dn551pt', 'DN55 1PT'],
  ];

  it.each(cases)('%s becomes %s', (input, expected) => {
    expect(formatPostalCode(input, gbAsAList)).toBe(expected);
  });

  it('still leaves a half-typed postcode alone', () => {
    expect(formatPostalCode('M11A', gbAsAList)).toBe('M11A');
  });
});

// ─── formatPostalCode — negative controls ────────────────────────────────────

describe('formatPostalCode leaves a partial postcode alone', () => {
  // The formatter is bound to the field's `input` event, so every prefix of a
  // postcode is an input it receives.
  it.each(['M', 'M1', 'M11', 'M11A', 'CR26', 'CR26X'])(
    'GB %s comes back unchanged',
    partial => {
      expect(formatPostalCode(partial, configOf('GB'))).toBe(partial);
    }
  );

  it('does not rearrange a half-typed outward code', () => {
    const gb = configOf('GB');
    expect(formatPostalCode('M11A', gb)).not.toBe('M 11A');
    expect(formatPostalCode('CR26', gb)).not.toBe('CR26 X');
  });
});

// ─── formatPostalCode — fallbacks ────────────────────────────────────────────

describe('formatPostalCode without a usable format', () => {
  const noFormat = configOf('GB', { postcodeFormat: null });

  it('uppercases a value containing letters', () => {
    expect(formatPostalCode('sw1a 1aa', noFormat)).toBe('SW1A 1AA');
  });

  it('returns a digits-only value untouched', () => {
    expect(formatPostalCode('12345', noFormat)).toBe('12345');
  });

  it('returns an empty string unchanged', () => {
    expect(formatPostalCode('', configOf('GB'))).toBe('');
  });

  it('returns a punctuation-only value unchanged', () => {
    expect(formatPostalCode('---', configOf('GB'))).toBe('---');
  });
});

// ─── validatePostalCode ──────────────────────────────────────────────────────

describe('validatePostalCode', () => {
  it('rejects an empty value', () => {
    const logger = loggerStub();
    expect(validatePostalCode(logger, '', 'GB', configOf('GB'))).toBe(false);
  });

  it('rejects a value shorter than the country minimum', () => {
    const logger = loggerStub();
    expect(validatePostalCode(logger, 'M1', 'GB', configOf('GB'))).toBe(false);
  });

  it('rejects a value longer than the country maximum', () => {
    const logger = loggerStub();
    expect(
      validatePostalCode(logger, 'SW1A 1AA 1AA', 'GB', configOf('GB'))
    ).toBe(false);
  });

  it('accepts any in-range value when the country ships no regex', () => {
    const logger = loggerStub();
    const config = configOf('GB', { postcodeRegex: null });
    expect(validatePostalCode(logger, '1234567', 'GB', config)).toBe(true);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('accepts the value and reports the pattern when the regex will not compile', () => {
    const logger = loggerStub();
    const config = configOf('GB', { postcodeRegex: '^[a' });
    expect(validatePostalCode(logger, 'SW1A 1AA', 'GB', config)).toBe(true);
    expect(logger.error).toHaveBeenCalledWith(
      'Invalid postal code regex:',
      '^[a'
    );
  });

  it("returns the country regex's verdict for an in-range value", () => {
    const logger = loggerStub();
    const config = configOf('GB');
    expect(validatePostalCode(logger, 'SW1A 1AA', 'GB', config)).toBe(true);
    expect(validatePostalCode(logger, '12345678', 'GB', config)).toBe(false);
    expect(logger.error).not.toHaveBeenCalled();
  });
});
