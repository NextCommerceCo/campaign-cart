/**
 * The next-address adapter: what the Worker serves, as the `CountryConfig` the rest of
 * the SDK already reads.
 *
 * The shapes asserted here are taken from the next-address repo's `docs/http-api.md` and
 * its `packages/data/src/types.ts`, not invented — a spec describes all ten fields for
 * every country and uses `layout` to say which of them the country actually collects.
 */

import { describe, expect, it, vi, afterEach } from 'vitest';

import {
  fetchCountryStates,
  fetchLocationData,
  flagUrl,
  toCountryConfig,
} from '@/core/country-service/country-service.next-address';
import { validatePostalCode } from '@/core/country-service/country-service.postal-code';
import { Logger } from '@/core/logger';

/** GB: a state-less country whose postcode pattern is written against the compact value. */
const GB_SPEC = {
  country: 'GB',
  layout: [
    ['country'],
    ['first_name', 'last_name'],
    ['line1'],
    ['city'],
    ['postcode'],
  ],
  fields: {
    state: { label: 'County', required: true },
    postcode: {
      label: 'Postcode',
      required: true,
      pattern: '^[A-Z]{1,2}\\d[A-Z\\d]?\\d[A-Z]{2}$',
      example: 'SW1A 1AA',
      maxLength: 8,
    },
  },
};

/** DE collects no postcode rule of its own and no state at all. */
const DE_SPEC = {
  country: 'DE',
  layout: [['country'], ['first_name', 'last_name'], ['line1'], ['city']],
  fields: { state: { label: 'Bundesland', required: true } },
};

const US_SPEC = {
  country: 'US',
  layout: [['country'], ['line1'], ['city', 'state', 'postcode']],
  fields: {
    state: { label: 'State', required: true },
    postcode: { label: 'ZIP Code', required: true, pattern: '^\\d{5}$', maxLength: 5 },
  },
};

function stubFetch(body: unknown): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => body,
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('toCountryConfig', () => {
  it('carries the phone rules even where the layout collects no phone', () => {
    // The checkout collects the phone in its own step, outside the address layout.
    const phone = { lengths: [9], pattern: '[1-9]\\d{8}', types: [], formats: [] };
    const config = toCountryConfig({
      ...DE_SPEC,
      fields: { ...DE_SPEC.fields, phone_number: { callingCode: '49', phone } },
    });
    expect(config.phone).toEqual({ callingCode: '49', ...phone });
  });

  it('leaves the phone rules out when the service sends none', () => {
    expect(toCountryConfig(DE_SPEC).phone).toBeUndefined();
  });

  it('reads the state label only when the country collects a state', () => {
    expect(toCountryConfig(US_SPEC).stateLabel).toBe('State');
    expect(toCountryConfig(US_SPEC).stateRequired).toBe(true);
  });

  /**
   * `fields.state` is present for every country; `layout` is what says it is collected.
   * Reading the field alone would put a "Bundesland" dropdown on a German address, which
   * collects no state — the same check next-address's own `listCountries` makes.
   */
  it('ignores a state field the layout does not render', () => {
    const config = toCountryConfig(DE_SPEC);
    expect(config.stateLabel).toBe('State');
    expect(config.stateRequired).toBe(false);
  });

  it('ignores a postcode field the layout does not render', () => {
    expect(toCountryConfig(DE_SPEC).postcodeRegex).toBeNull();
    expect(toCountryConfig(DE_SPEC).postcodeCompact).toBe(false);
  });

  it('marks a served pattern as compact-matching', () => {
    expect(toCountryConfig(GB_SPEC).postcodeCompact).toBe(true);
  });

  /**
   * next-address serves no minimum length: the pattern is the shape check, and a floor
   * on top of it can only disagree with it.
   */
  it('sets no postcode minimum length', () => {
    expect(toCountryConfig(GB_SPEC).postcodeMinLength).toBe(0);
  });

  /**
   * next-address names the written form (`ca-postal`); this SDK describes it as a slot
   * pattern. Without the translation Canadian postcodes stop being spaced at all, because
   * `withPostcodeFormats` carries no built-in entry for CA.
   */
  it.each([
    ['ca-postal', 'NNN NNN'],
    ['jp-postal', 'NNN-NNNN'],
    ['nl-postal', 'NNNN NN'],
  ])('turns the %s formatter into %s', (formatter, pattern) => {
    const spec = { ...US_SPEC, postcode: { formatter } };
    expect(toCountryConfig(spec).postcodeFormat).toBe(pattern);
  });

  /** GB has three shapes by length, which `withPostcodeFormats` already owns. */
  it('emits no pattern for gb-postcode', () => {
    const spec = { ...GB_SPEC, postcode: { formatter: 'gb-postcode' } };
    expect(toCountryConfig(spec).postcodeFormat).toBeNull();
  });

  it('emits no pattern for a country with no formatter', () => {
    expect(toCountryConfig(US_SPEC).postcodeFormat).toBeNull();
  });

  it('carries the currency it is given, and no symbol', () => {
    expect(toCountryConfig(US_SPEC, 'USD').currencyCode).toBe('USD');
    // Intl derives the symbol from the code in `core/currency-formatter.ts`.
    expect(toCountryConfig(US_SPEC, 'USD').currencySymbol).toBe('');
  });

  it('leaves currency empty when the service names none', () => {
    expect(toCountryConfig(US_SPEC, null).currencyCode).toBe('');
  });
});

/**
 * The reason {@link toCountryConfig} emits `postcodeCompact` at all.
 *
 * Without it the GB pattern is tested against the string as typed, `SW1A 1AA` fails, and
 * a British shopper cannot get past the address step.
 */
describe('a compact pattern against a postcode as typed', () => {
  const logger = new Logger('test');
  const gb = toCountryConfig(GB_SPEC);

  it.each(['SW1A 1AA', 'sw1a 1aa', 'SW1A1AA', 'sw1a1aa'])(
    'accepts %s',
    postcode => {
      expect(validatePostalCode(logger, postcode, 'GB', gb)).toBe(true);
    }
  );

  it('still rejects a postcode that is the wrong shape', () => {
    expect(validatePostalCode(logger, 'NOT A CODE', 'GB', gb)).toBe(false);
  });

  it('leaves a raw-matched country alone', () => {
    const raw = { ...toCountryConfig(US_SPEC), postcodeCompact: false };
    expect(validatePostalCode(logger, '90210', 'US', raw)).toBe(true);
  });
});

describe('fetchLocationData', () => {
  it('reads the detected country, its rules, its states and the country list', async () => {
    const fetchMock = stubFetch({
      geo: { country: 'GB' },
      spec: GB_SPEC,
      countries: [
        { code: 'GB', name: 'United Kingdom' },
        { code: 'US', name: 'United States' },
      ],
      states: [{ code: 'ENG', name: 'England' }],
    });

    const data = await fetchLocationData('https://addr.test');

    expect(fetchMock).toHaveBeenCalledWith('https://addr.test/v1/bootstrap?lang=en');
    expect(data.detectedCountryCode).toBe('GB');
    expect(data.detectedCountryConfig.postcodeLabel).toBe('Postcode');
    expect(data.detectedStates).toEqual([{ code: 'ENG', name: 'England' }]);
    expect(data.countries.map(c => c.code)).toEqual(['GB', 'US']);
  });

  it('takes each country\'s calling code, and none from a deployment that sends none', async () => {
    stubFetch({
      geo: { country: 'GB' },
      spec: GB_SPEC,
      countries: [
        { code: 'GB', name: 'United Kingdom', callingCode: '44' },
        { code: 'US', name: 'United States' },
      ],
    });

    const data = await fetchLocationData('https://addr.test');

    expect(data.countries.map(c => c.phonecode)).toEqual(['44', '']);
  });

  /** A country with no subdivisions omits `states` entirely rather than sending `[]`. */
  it('reports no states when the response carries none', async () => {
    stubFetch({ geo: { country: 'DE' }, spec: DE_SPEC, countries: [] });
    expect((await fetchLocationData('https://addr.test')).detectedStates).toEqual([]);
  });

  it('reads the visitor currency and IP the service reports with their country', async () => {
    stubFetch({
      geo: { country: 'GB', currency: 'GBP', ip: '203.0.113.7' },
      spec: GB_SPEC,
      countries: [{ code: 'GB', name: 'United Kingdom' }],
    });

    const data = await fetchLocationData('https://addr.test');

    expect(data.detectedCountryConfig.currencyCode).toBe('GBP');
    expect(data.detectedIp).toBe('203.0.113.7');
  });

  it('reports no IP rather than an empty one when the edge resolved none', async () => {
    stubFetch({
      geo: { country: 'GB', currency: 'GBP', ip: null },
      spec: GB_SPEC,
      countries: [],
    });

    expect(await fetchLocationData('https://addr.test')).not.toHaveProperty('detectedIp');
  });

  it('rejects a body whose layout is not a list of rows', async () => {
    stubFetch({ geo: {}, spec: { country: 'US', layout: {}, fields: {} }, countries: [] });
    await expect(fetchLocationData('https://addr.test')).rejects.toThrow(
      'carried no address layout'
    );
  });

  it('throws on a non-ok response so the caller can fall back', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 503, statusText: 'Unavailable' })
    );
    await expect(fetchLocationData('https://addr.test')).rejects.toThrow('503');
  });
});

describe('fetchCountryStates', () => {
  it('asks for the country layout with its states', async () => {
    const fetchMock = stubFetch({ spec: US_SPEC, states: [{ code: 'NY', name: 'New York' }] });

    const data = await fetchCountryStates('US', 'https://addr.test');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://addr.test/v1/layout/US?include=states&lang=en'
    );
    expect(data.countryConfig.postcodeLabel).toBe('ZIP Code');
    expect(data.states).toEqual([{ code: 'NY', name: 'New York' }]);
  });

  it('escapes the country code rather than pasting it into the path', async () => {
    const fetchMock = stubFetch({ spec: US_SPEC });
    await fetchCountryStates('../v1/geo', 'https://addr.test');
    expect(fetchMock.mock.calls[0][0]).toContain('%2F');
  });
});

describe('flagUrl', () => {
  it('asks the address-rules service for the lower-case code', () => {
    expect(flagUrl('GB')).toBe('https://i18n-rules.nextcommerce.com/v1/flags/gb.svg');
  });
});
