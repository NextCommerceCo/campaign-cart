/**
 * The next-address Worker as this SDK's source of country and address rules.
 *
 * Replaces the two `cdn-countries` endpoints `CountryService` used to call. Everything
 * built on top of them — the localStorage cache, the campaign/config country filtering,
 * the postcode formatter — is unchanged: this module only fetches and translates.
 *
 * The API is public, `GET`-only and unauthenticated; see `docs/http-api.md` in the
 * next-address repo. Four routes carry everything this SDK asks for:
 *
 * | Route | Answers |
 * |---|---|
 * | `GET /v1/geo?include=rules,states` | the visitor, and the rules and states of the country they are in |
 * | `GET /v1/countries` | the country list |
 * | `GET /v1/countries/:country?include=states` | one country's rules and states |
 * | `GET /v1/locales/:lang` | the message templates, in one language |
 *
 * Only the first depends on the visitor, so the first three of `LocationData`'s requests
 * go out together and two of them come from the edge cache. `geo` carries the visitor's
 * currency and IP alongside their country. The currency is a reading of where the visitor
 * is, not an instruction about what to charge: the SDK uses it as the lowest-priority
 * default, under `?currency=` and the choice saved for the session.
 *
 * No `currencySymbol` is served and none is needed — prices are formatted by
 * `core/currency-formatter.ts` through `Intl.NumberFormat`, which derives the symbol from
 * the code.
 */

import type {
  Country,
  CountryConfig,
  CountryStatesData,
  LocationData,
  State,
} from '@/core/country-service/country-service';
import type { PhoneRules } from '@/core/country-service/country-service.phone';

const NEXT_ADDRESS_BASE_URL =
  'https://i18n-rules.nextcommerce.com';

/** The country's flag, a 4:3 SVG served by the same service: `…/v1/flags/gb.svg`. */
export function flagUrl(
  countryCode: string,
  baseUrl: string = NEXT_ADDRESS_BASE_URL
): string {
  return `${baseUrl}/v1/flags/${encodeURIComponent(countryCode.toLowerCase())}.svg`;
}

/**
 * Always sent, never left to `Accept-Language`: without `?lang=` the service answers in
 * the browser's language, and a shipped page would relabel itself per visitor. A name
 * the service has no translation for comes back in English.
 */
const DEFAULT_LANG = 'en';

/** The subset of next-address's `FieldSpec` this SDK reads. */
interface FieldSpec {
  label?: string;
  required?: boolean;
  pattern?: string;
  example?: string;
  maxLength?: number;
}

/** The subset of next-address's `ResolvedCountrySpec` this SDK reads. */
interface CountrySpec {
  country: string;
  layout: string[][];
  fields: Record<string, FieldSpec | undefined>;
  postcode?: { formatter?: string };
  phone?: PhoneRules;
}

/**
 * next-address names a postcode's written form; this SDK describes it as a slot pattern.
 *
 * Every slot character in `country-service.postal-code.ts` accepts any character, so a
 * pattern only says **where the separators fall**. That makes each of the four named
 * formatters one pattern, read straight off its implementation in next-address's
 * `packages/core/src/normalize.ts`:
 *
 * | Formatter | Does | Pattern |
 * |---|---|---|
 * | `ca-postal` | `k1a0b1` → `K1A 0B1` | `NNN NNN` |
 * | `jp-postal` | `1000001` → `100-0001` | `NNN-NNNN` |
 * | `nl-postal` | `1012ab` → `1012 AB` | `NNNN NN` |
 *
 * `gb-postcode` is deliberately absent. It splits before the final three characters
 * whatever the length, which is three patterns rather than one, and
 * {@link withPostcodeFormats} already carries all three for GB. Emitting a single pattern
 * here would append a fourth, wrong-length shape behind them.
 */
const POSTCODE_PATTERNS: Record<string, string> = {
  'ca-postal': 'NNN NNN',
  'jp-postal': 'NNN-NNNN',
  'nl-postal': 'NNNN NN',
};

/** `GET /v1/countries/:country`, and `rules` in `GET /v1/geo?include=rules`. */
interface CountryResponse {
  /** The language `labels` is in: the one asked for if the service has it, else `en`. */
  lang?: string;
  spec: CountrySpec;
  labels?: Record<string, string>;
  states?: State[];
}

/** A row of `GET /v1/countries`, as far as this SDK reads it. */
interface CountryRow {
  code: string;
  name: string;
}

interface GeoResponse {
  ip?: string | null;
  currency?: string | null;
  rules?: CountryResponse;
}

/**
 * Whether this country actually collects `field`.
 *
 * `spec.fields` describes all ten fields for every country; `spec.layout` is what says
 * which of them are rendered, required and validated. Reading `fields.state` alone would
 * report a state label for Germany, which collects none — next-address's own
 * `listCountries` makes the same check for the same reason.
 */
function collects(spec: CountrySpec, field: string): boolean {
  return spec.layout.some(row => row.includes(field));
}

function fieldOf(spec: CountrySpec, name: string): FieldSpec | undefined {
  return collects(spec, name) ? spec.fields[name] : undefined;
}

/**
 * One country's spec as the `CountryConfig` the rest of the SDK already understands.
 *
 * `postcodeCompact` is the one flag that has to travel with the value: next-address
 * matches `pattern` against the postcode *compacted* — uppercased, spaces removed — so a
 * GB pattern accepts every spacing a shopper might type. Handing that pattern to a
 * validator that tests the raw string rejects `SW1A 1AA` and blocks the checkout, which
 * is why {@link CountryConfig.postcodeCompact} exists and `validatePostalCode` reads it.
 *
 * `postcodeMinLength` is `0` because next-address serves no minimum: the pattern is the
 * shape check, and a length floor on top of it can only disagree with it.
 */
export function toCountryConfig(
  spec: CountrySpec,
  currencyCode?: string | null
): CountryConfig {
  const state = fieldOf(spec, 'state');
  const postcode = fieldOf(spec, 'postcode');

  return {
    stateLabel: state?.label ?? 'State',
    stateRequired: state?.required ?? false,
    postcodeLabel: postcode?.label ?? 'Postal Code',
    postcodeRegex: postcode?.pattern ?? null,
    postcodeCompact: Boolean(postcode?.pattern),
    postcodeMinLength: 0,
    postcodeMaxLength: postcode?.maxLength ?? Number.MAX_SAFE_INTEGER,
    postcodeExample: postcode?.example ?? null,
    postcodeFormat: POSTCODE_PATTERNS[spec.postcode?.formatter ?? ''] ?? null,
    // Read whether or not the layout collects a phone: the checkout collects one in its
    // own step, outside any address layout.
    ...(spec.phone ? { phone: spec.phone } : {}),
    currencyCode: currencyCode ?? '',
    currencySymbol: '',
  };
}

/**
 * The three empty fields are read from nowhere: `country-service.filtering.ts` already
 * writes `''` for `phonecode` on every country it builds itself, and currency is read
 * through `LocationData.detectedCountryConfig`, never from a row of this list.
 */
function toCountries(rows: CountryRow[]): Country[] {
  return rows.map(row => ({
    code: row.code,
    name: row.name,
    phonecode: '',
    currencyCode: '',
    currencySymbol: '',
  }));
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} responded ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

/**
 * Checked here rather than left to the first `layout.some(...)`, which would throw a
 * TypeError from inside the mapping and tell the caller nothing about the cause.
 */
function rulesIn(
  rules: CountryResponse | undefined,
  url: string
): CountryResponse {
  if (!rules || !Array.isArray(rules.spec?.layout)) {
    throw new Error(`${url} carried no address layout`);
  }
  return rules;
}

/**
 * The message templates in `lang`, or `undefined` when the service could not answer: the
 * messages are then the SDK's English, and the checkout goes on. A language the service
 * has no file for comes back in English; `messagesLang` (the language `rules` came back
 * in) is what stops those being used for a page in another language.
 */
async function fetchMessages(
  baseUrl: string,
  lang: string
): Promise<Record<string, string> | undefined> {
  try {
    return await getJson<Record<string, string>>(
      `${baseUrl}/v1/locales/${encodeURIComponent(lang)}`
    );
  } catch {
    return undefined;
  }
}

/** What {@link CountryResponse} gives the messages: the names in them, and their language. */
function namesOf(
  rules: CountryResponse
): Pick<LocationData, 'labels' | 'messagesLang'> {
  return {
    ...(rules.labels ? { labels: rules.labels } : {}),
    ...(rules.lang ? { messagesLang: rules.lang } : {}),
  };
}

/**
 * The visitor's country, its rules and states, the country list and the messages.
 *
 * The three requests go out at once. Only geo depends on the visitor, and it carries the
 * rules of the country it detected, because a form cannot know which country's rules to
 * ask for until geo has answered: asking afterwards would be two round trips in a row on
 * a checkout page's critical path.
 *
 * The country list is not narrowed with `?countries=` even though the route accepts it:
 * `applyCountryFiltering` already narrows it against the campaign and the page config,
 * and asking for a filtered list would make the cached response depend on which campaign
 * loaded first.
 */
export async function fetchLocationData(
  baseUrl: string = NEXT_ADDRESS_BASE_URL,
  lang: string = DEFAULT_LANG
): Promise<LocationData> {
  const query = `lang=${encodeURIComponent(lang)}`;
  const geoUrl = `${baseUrl}/v1/geo?include=rules,states&${query}`;
  const [geo, countries, messages] = await Promise.all([
    getJson<GeoResponse>(geoUrl),
    getJson<CountryRow[]>(`${baseUrl}/v1/countries?${query}`),
    fetchMessages(baseUrl, lang),
  ]);
  const rules = rulesIn(geo.rules, geoUrl);

  return {
    detectedCountryCode: rules.spec.country,
    detectedCountryConfig: toCountryConfig(rules.spec, geo.currency),
    detectedStates: rules.states ?? [],
    countries: toCountries(countries),
    ...(geo.ip ? { detectedIp: geo.ip } : {}),
    ...(messages ? { messages } : {}),
    ...namesOf(rules),
  };
}

/**
 * One country's rules and its subdivisions. The messages came with `LocationData` and
 * do not change with the country; the names inside them do.
 *
 * An uncurated country is answered with the default layout under its own code rather
 * than a `404`, so there is no not-found branch here: a visitor from such a country
 * still has to be able to check out.
 */
export async function fetchCountryStates(
  countryCode: string,
  baseUrl: string = NEXT_ADDRESS_BASE_URL,
  lang: string = DEFAULT_LANG
): Promise<CountryStatesData> {
  const url = `${baseUrl}/v1/countries/${encodeURIComponent(countryCode)}?include=states&lang=${encodeURIComponent(lang)}`;
  const rules = rulesIn(await getJson<CountryResponse>(url), url);

  // No currency: a country's rules describe a country, not the visitor. The one the SDK
  // prices in is read once, from geo, and held in the config store.
  return {
    countryConfig: toCountryConfig(rules.spec),
    states: rules.states ?? [],
    ...namesOf(rules),
  };
}
