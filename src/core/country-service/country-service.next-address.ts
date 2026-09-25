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

/** A field of a country's rules, as the address-rules service describes it. */
export interface RulesField {
  /** On the form. */
  label: string;
  /** Inside a message, for `{label}`. */
  messageLabel?: string;
  required: boolean;
  autocomplete: string;
  input: {
    type: 'text' | 'email' | 'tel' | 'select';
    inputMode?: 'text' | 'numeric' | 'tel' | 'email';
    autoCapitalize?: 'none' | 'words' | 'characters';
    maxLength?: number;
    placeholder?: string;
    options?: 'countries' | 'states';
    span?: number;
  };
  /** On `postcode` and `phone_number` only: see `docs/http-api.md` in the service's repo. */
  format?: {
    pattern?: string;
    example?: string;
    masks?: string[] | PhoneRules['masks'];
    callingCode?: string;
    nationalPrefix?: string;
  };
}

/** Values every address in a country shares, sent without being asked for. */
export type FixedValues = Partial<Record<'city' | 'state' | 'postcode', string>>;

/**
 * One country's rules: `GET /v1/countries/:country`, and `rules` in
 * `GET /v1/geo?include=rules`. Field names are the service's (`first_name`, `postcode`).
 */
export interface CountryRules {
  country: string;
  /** The language `label` and `messageLabel` are in. */
  lang?: string;
  /** `false` for a country the service serves the default layout. */
  curated?: boolean;
  address: { layout: string[][]; fixed?: FixedValues };
  contact: { layout: string[][] };
  /** Exactly the fields the two layouts name. */
  fields: Record<string, RulesField | undefined>;
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
  rules?: unknown;
}

/**
 * One country's rules as the `CountryConfig` the rest of the SDK already understands.
 *
 * `postcodeCompact` is the one flag that has to travel with the value: next-address
 * matches `pattern` against the postcode *compacted* — uppercased, spaces and hyphens removed — so a
 * GB pattern accepts every spacing a shopper might type. Handing that pattern to a
 * validator that tests the raw string rejects `SW1A 1AA` and blocks the checkout, which
 * is why {@link CountryConfig.postcodeCompact} exists and `validatePostalCode` reads it.
 *
 * `postcodeMinLength` is `0` because next-address serves no minimum: the pattern is the
 * shape check, and a length floor on top of it can only disagree with it.
 */
export function toCountryConfig(
  rules: CountryRules,
  currencyCode?: string | null
): CountryConfig {
  const state = rules.fields.state;
  const postcode = rules.fields.postcode;
  const postcodeFormat = postcode?.format;
  const phone = rules.fields.phone_number?.format;

  return {
    stateLabel: state?.label ?? 'State',
    stateRequired: state?.required ?? false,
    postcodeLabel: postcode?.label ?? 'Postal Code',
    // A country that asks for no postcode (Hong Kong) cannot be refused for leaving one
    // out, and one whose postcode is fixed (Vatican City) sends it without asking.
    postcodeRequired: postcode?.required ?? false,
    postcodeRegex: postcodeFormat?.pattern ?? null,
    postcodeCompact: Boolean(postcodeFormat?.pattern),
    postcodeMinLength: 0,
    postcodeMaxLength: postcode?.input.maxLength ?? Number.MAX_SAFE_INTEGER,
    postcodeExample: postcodeFormat?.example ?? null,
    postcodeFormat: (postcodeFormat?.masks as string[] | undefined) ?? null,
    // Only a rule with a pattern checks a number; a country with no file of its own sends
    // just the calling code and an example.
    ...(phone?.pattern ? { phone: phone as PhoneRules } : {}),
    ...(rules.address.fixed && Object.keys(rules.address.fixed).length > 0
      ? { fixed: rules.address.fixed }
      : {}),
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
 * A country's rules as the service answered them at `url`, with `country` read down to
 * its code. The service answers `{ code, name }`; a deployment from before it named the
 * country answers the bare code, and both are read.
 *
 * Checked for shape here rather than left to the first `layout.some(...)`, which would
 * throw a TypeError from inside the mapping and tell the caller nothing about the cause.
 */
export function readCountryRules(body: unknown, url: string): CountryRules {
  const rules = body as
    | (Omit<CountryRules, 'country'> & {
        country?: string | { code?: string };
      })
    | undefined;
  const code =
    typeof rules?.country === 'string' ? rules.country : rules?.country?.code;
  if (
    !rules ||
    !code ||
    !Array.isArray(rules.address?.layout) ||
    !Array.isArray(rules.contact?.layout) ||
    !rules.fields
  ) {
    throw new Error(`${url} carried no address layout`);
  }
  return { ...rules, country: code };
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

/** What a country's rules give the messages: each field's name in them, and their language. */
function namesOf(
  rules: CountryRules
): Pick<LocationData, 'labels' | 'messagesLang'> {
  const labels: Record<string, string> = {};
  for (const [name, field] of Object.entries(rules.fields)) {
    if (field) labels[name] = field.messageLabel ?? field.label;
  }
  return {
    labels,
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
  const rules = readCountryRules(geo.rules, geoUrl);

  return {
    detectedCountryCode: rules.country,
    detectedCountryConfig: toCountryConfig(rules, geo.currency),
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
  const rules = readCountryRules(await getJson<unknown>(url), url);

  // No currency: a country's rules describe a country, not the visitor. The one the SDK
  // prices in is read once, from geo, and held in the config store.
  return {
    countryConfig: toCountryConfig(rules),
    states: rules.states ?? [],
    rules,
    ...namesOf(rules),
  };
}
