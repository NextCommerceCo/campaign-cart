/**
 * The next-address adapter: what the Worker serves, as the `CountryConfig` the rest of
 * the SDK already reads.
 *
 * The shapes asserted here are taken from the service repo's `docs/http-api.md`, not
 * invented: a country's rules name the fields it asks for in `address` and `contact`, and
 * describe exactly those in `fields`.
 */

import { describe, expect, it, vi, afterEach } from 'vitest';

import {
  fetchCountryStates,
  fetchLocationData,
  flagUrl,
  toCountryConfig,
  type CountryRules,
  type RulesField,
} from '@/core/country-service/country-service.next-address';
import { validatePostalCode } from '@/core/country-service/country-service.postal-code';
import { Logger } from '@/core/logger';
import { CountryService } from '@/core/country-service';
import { useConfigStore } from '@/state/config';

const field = (
  label: string,
  format?: RulesField['format'],
  input: Partial<RulesField['input']> = {}
): RulesField => ({
  label,
  required: true,
  autocomplete: 'off',
  input: { type: 'text', ...input },
  ...(format ? { format } : {}),
});

const rules = (
  country: string,
  address: string[][],
  fields: Record<string, RulesField>,
  extra: Partial<CountryRules> = {}
): CountryRules => ({
  country,
  lang: 'en',
  address: { layout: address, fixed: {} },
  contact: { layout: [['first_name', 'last_name'], ['email']] },
  fields,
  ...extra,
});

/** GB: a state-less country whose postcode pattern is written against the compact value. */
const GB = rules('GB', [['country'], ['line1'], ['city'], ['postcode']], {
  postcode: field(
    'Postcode',
    {
      pattern: '^[A-Z]{1,2}\\d[A-Z\\d]?\\d[A-Z]{2}$',
      example: 'SW1A 1AA',
      masks: ['## ###', '### ###', '#### ###'],
    },
    { maxLength: 8 }
  ),
});

/** DE collects no state at all, and no postcode rule of its own. */
const DE = rules('DE', [['country'], ['line1'], ['city']], {});

const US = rules(
  'US',
  [['country'], ['line1'], ['city', 'state', 'postcode']],
  {
    state: field('State', undefined, { type: 'select', options: 'states' }),
    postcode: field('ZIP Code', { pattern: '^\\d{5}$' }, { maxLength: 5 }),
  }
);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('toCountryConfig', () => {
  it("carries the country's phone rule from the phone field", () => {
    const phone = {
      callingCode: '49',
      nationalPrefix: '0',
      pattern: '^[0-9]{5,15}$',
    };
    const config = toCountryConfig({
      ...DE,
      fields: { phone: field('Phone', phone, { type: 'tel' }) },
    });
    expect(config.phone).toEqual(phone);
  });

  it('checks no number for a phone field with only a calling code and an example', () => {
    const config = toCountryConfig({
      ...DE,
      fields: {
        phone: field('Phone', { callingCode: '977', example: '984-1234567' }),
      },
    });
    expect(config.phone).toBeUndefined();
  });

  it('reads the state label and whether it is required', () => {
    expect(toCountryConfig(US).stateLabel).toBe('State');
    expect(toCountryConfig(US).stateRequired).toBe(true);
  });

  it('asks for no state and no postcode where the country names neither', () => {
    const config = toCountryConfig(DE);
    expect(config.stateRequired).toBe(false);
    expect(config.postcodeRequired).toBe(false);
    expect(config.postcodeRegex).toBeNull();
    expect(config.postcodeCompact).toBe(false);
  });

  it('asks for a postcode where the country names one', () => {
    expect(toCountryConfig(US).postcodeRequired).toBe(true);
  });

  it('carries the values the country fixes, and none where it fixes nothing', () => {
    const va = rules(
      'VA',
      [['country'], ['line1']],
      {},
      {
        address: {
          layout: [['country'], ['line1']],
          fixed: { city: 'Vatican City', postcode: '00120' },
        },
      }
    );
    expect(toCountryConfig(va).fixed).toEqual({
      city: 'Vatican City',
      postcode: '00120',
    });
    expect(toCountryConfig(US).fixed).toBeUndefined();
  });

  it('marks a served pattern as compact-matching', () => {
    expect(toCountryConfig(GB).postcodeCompact).toBe(true);
  });

  /**
   * next-address serves no minimum length: the pattern is the shape check, and a floor
   * on top of it can only disagree with it.
   */
  it('sets no postcode minimum length', () => {
    expect(toCountryConfig(GB).postcodeMinLength).toBe(0);
    expect(toCountryConfig(GB).postcodeMaxLength).toBe(8);
  });

  it("uses the country's masks as its postcode formats", () => {
    expect(toCountryConfig(GB).postcodeFormat).toEqual([
      '## ###',
      '### ###',
      '#### ###',
    ]);
  });

  it('has no postcode format for a country with no masks', () => {
    expect(toCountryConfig(US).postcodeFormat).toBeNull();
  });

  it('carries the currency it is given, and no symbol', () => {
    expect(toCountryConfig(US, 'USD').currencyCode).toBe('USD');
    // Intl derives the symbol from the code in `core/currency-formatter.ts`.
    expect(toCountryConfig(US, 'USD').currencySymbol).toBe('');
  });

  it('leaves currency empty when the service names none', () => {
    expect(toCountryConfig(US, null).currencyCode).toBe('');
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
  const gb = toCountryConfig(GB);

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
    const raw = { ...toCountryConfig(US), postcodeCompact: false };
    expect(validatePostalCode(logger, '90210', 'US', raw)).toBe(true);
  });
});

/**
 * The service, one answer per route: `geo` for `/v1/geo`, `countries` for the list,
 * `country` for `/v1/countries/:country`, `locale` for `/v1/locales/:lang`. A route with
 * no answer is a 404, which is how a request that failed looks to the SDK.
 */
function stubService(answers: {
  geo?: unknown;
  countries?: unknown;
  country?: unknown;
  locale?: unknown;
}): ReturnType<typeof vi.fn> {
  const fn = vi.fn(async (url: string) => {
    const { pathname } = new URL(url);
    const body = pathname.startsWith('/v1/geo')
      ? answers.geo
      : pathname.startsWith('/v1/locales/')
        ? answers.locale
        : pathname === '/v1/countries'
          ? answers.countries
          : answers.country;
    return body === undefined
      ? { ok: false, status: 404, statusText: 'Not Found' }
      : { ok: true, status: 200, statusText: 'OK', json: async () => body };
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

const urlsOf = (fn: ReturnType<typeof vi.fn>): string[] =>
  fn.mock.calls.map(call => String(call[0]));

describe('fetchLocationData', () => {
  it('asks geo for the rules, and the list and messages at the same time', async () => {
    const fetchMock = stubService({
      geo: {
        country: 'GB',
        rules: { ...GB, states: [{ code: 'ENG', name: 'England' }] },
      },
      countries: [
        { code: 'GB', name: 'United Kingdom' },
        { code: 'US', name: 'United States' },
      ],
      locale: { 'error.emoji': '{label} can’t contain emojis' },
    });

    const data = await fetchLocationData('https://addr.test');

    expect(urlsOf(fetchMock).sort()).toEqual([
      'https://addr.test/v1/countries?lang=en',
      'https://addr.test/v1/geo?include=rules,states&lang=en',
      'https://addr.test/v1/locales/en',
    ]);
    expect(data.detectedCountryCode).toBe('GB');
    expect(data.detectedCountryConfig.postcodeLabel).toBe('Postcode');
    expect(data.detectedStates).toEqual([{ code: 'ENG', name: 'England' }]);
    expect(data.countries.map(c => c.code)).toEqual(['GB', 'US']);
    expect(data.messages?.['error.emoji']).toBe('{label} can’t contain emojis');
    expect(data.messagesLang).toBe('en');
  });

  it('goes on without messages when the service could not send them', async () => {
    stubService({
      geo: {
        rules: {
          ...GB,
          fields: { line1: { ...field('Address'), messageLabel: 'Address' } },
        },
      },
      countries: [],
    });

    const data = await fetchLocationData('https://addr.test', 'vi');

    expect(data.messages).toBeUndefined();
    // The names came back in English, which is what stops a Vietnamese sentence
    // being built around them.
    expect(data.messagesLang).toBe('en');
    expect(data.labels).toEqual({ line1: 'Address' });
  });

  /** A country with no subdivisions omits `states` entirely rather than sending `[]`. */
  it('reports no states when the response carries none', async () => {
    stubService({ geo: { rules: DE }, countries: [] });
    expect(
      (await fetchLocationData('https://addr.test')).detectedStates
    ).toEqual([]);
  });

  it('reads the visitor currency and IP the service reports with their country', async () => {
    stubService({
      geo: { currency: 'GBP', ip: '203.0.113.7', rules: GB },
      countries: [],
    });

    const data = await fetchLocationData('https://addr.test');

    expect(data.detectedCountryConfig.currencyCode).toBe('GBP');
    expect(data.detectedIp).toBe('203.0.113.7');
  });

  it('reports no IP rather than an empty one when the edge resolved none', async () => {
    stubService({ geo: { ip: null, rules: GB }, countries: [] });
    expect(await fetchLocationData('https://addr.test')).not.toHaveProperty(
      'detectedIp'
    );
  });

  it('rejects an answer whose layout is not a list of rows', async () => {
    stubService({
      geo: { rules: { ...US, address: { layout: {} } } },
      countries: [],
    });
    await expect(fetchLocationData('https://addr.test')).rejects.toThrow(
      'carried no address layout'
    );
  });

  it('rejects a geo answer that carries no rules', async () => {
    stubService({ geo: { country: 'GB' }, countries: [] });
    await expect(fetchLocationData('https://addr.test')).rejects.toThrow(
      'carried no address layout'
    );
  });

  it('throws on a non-ok response so the caller can fall back', async () => {
    stubService({ countries: [] });
    await expect(fetchLocationData('https://addr.test')).rejects.toThrow('404');
  });
});

describe('fetchCountryStates', () => {
  it("asks for the country's rules with its states", async () => {
    const fetchMock = stubService({
      country: { ...US, states: [{ code: 'NY', name: 'New York' }] },
    });

    const data = await fetchCountryStates('US', 'https://addr.test');

    expect(urlsOf(fetchMock)).toEqual([
      'https://addr.test/v1/countries/US?include=states&lang=en',
    ]);
    expect(data.countryConfig.postcodeLabel).toBe('ZIP Code');
    expect(data.states).toEqual([{ code: 'NY', name: 'New York' }]);
    expect(data.messagesLang).toBe('en');
  });

  it('escapes the country code rather than pasting it into the path', async () => {
    const fetchMock = stubService({ country: US });
    await fetchCountryStates('../v1/geo', 'https://addr.test');
    expect(urlsOf(fetchMock)[0]).toContain('%2F');
  });
});

describe('flagUrl', () => {
  it('asks the address-rules service for the lower-case code', () => {
    expect(flagUrl('GB')).toBe(
      'https://i18n-rules.nextcommerce.com/v1/flags/gb.svg'
    );
  });
});

describe('CountryService language', () => {
  afterEach(() => {
    localStorage.clear();
    useConfigStore.setState({ locale: undefined });
  });

  it("asks in the page's locale, and keeps English where none is set", async () => {
    const fetchMock = stubService({ country: { ...US, states: [] } });
    const service = CountryService.getInstance();

    await service.getCountryStates('US');
    useConfigStore.setState({ locale: 'th-TH' });
    await service.getCountryStates('US');

    expect(urlsOf(fetchMock)).toEqual([
      expect.stringContaining('/v1/countries/US?include=states&lang=en'),
      expect.stringContaining('/v1/countries/US?include=states&lang=th-TH'),
    ]);
  });

  it("keeps each country's names for its messages, and the last as the default", async () => {
    const service = CountryService.getInstance();
    stubService({
      country: US,
    });
    await service.getCountryStates('US');
    stubService({
      country: GB,
    });
    await service.getCountryStates('GB');

    expect(service.getMessageLabels('US').postcode).toBe('ZIP Code');
    expect(service.getMessageLabels('GB').postcode).toBe('Postcode');
    expect(service.getMessageLabels().postcode).toBe('Postcode');
  });

  it('refetches rather than serve a cached answer in another language', async () => {
    const fetchMock = stubService({ country: { ...US, states: [] } });
    const service = CountryService.getInstance();

    await service.getCountryStates('US');
    await service.getCountryStates('US');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    useConfigStore.setState({ locale: 'th' });
    await service.getCountryStates('US');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
