/**
 * The next-address Worker as this SDK's source of country and address rules.
 *
 * Replaces the two `cdn-countries` endpoints `I18nRules` used to call. Everything
 * built on top of them — the localStorage cache, the campaign/config country filtering,
 * the postcode formatter — is unchanged: this module only fetches and translates.
 *
 * The API is public and unauthenticated; see `docs/guides/reference/routes.md` in the
 * i18n-rules repo. Five routes carry everything this SDK asks for:
 *
 * | Route | Answers |
 * |---|---|
 * | `GET /v1/geo?include=rules,states` | the visitor, and the rules and states of the country they are in |
 * | `GET /v1/countries` | the country list |
 * | `GET /v1/countries/:country?include=states` | one country's rules and states |
 * | `GET /v1/locales/:lang` | the message templates, in one language |
 * | `POST /v1/validate?lang=` | what a typed phone number or postcode is, as the shopper leaves it |
 *
 * The last is the one the shopper's typing reaches, so it is a `POST` that is never
 * cached, and nothing waits on it longer than {@link VALIDATE_TIMEOUT_MS}.
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
} from '@/core/i18n-rules/i18n-rules';
import { flattenTexts } from '@/core/flatten-texts';
import type {
  PhoneNumberResult,
  PhoneRules,
} from '@/core/i18n-rules/i18n-rules.phone';

const NEXT_ADDRESS_BASE_URL = 'https://i18n-rules.nextcommerce.com';

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
  /**
   * Where the field's texts are in the service's locale file: `fields.postcode.zip_code`.
   * A page overrides one by this key plus the text's own, `…zip_code.errors.invalid`.
   */
  label_id?: string;
  /** On the form. */
  label: string;
  /** The label when the field is not required, with the language's note. */
  label_optional?: string;
  /**
   * What the form says when a value is refused, by what is wrong (`blank`, `not_selected`,
   * `invalid`, `invalid_characters`, `contains_emoji`, `too_long`), in `lang`.
   */
  errors?: Readonly<Record<string, string>>;
  required: boolean;
  autocomplete: string;
  input: {
    type: 'text' | 'email' | 'tel' | 'select';
    input_mode?: 'text' | 'numeric' | 'tel' | 'email';
    auto_capitalize?: 'none' | 'words' | 'characters';
    max_length?: number;
    placeholder?: string;
    options?: 'countries' | 'states';
    span?: number;
  };
  /**
   * On `postcode` and `phone_number`, and a `pattern` alone on a text field the service
   * chooses to check ({@link SERVED_PATTERN_FIELDS}): see the service's fields reference.
   */
  format?: {
    pattern?: string;
    example?: string;
    masks?: string[] | PhoneRules['masks'];
    calling_code?: string;
    national_prefix?: string;
    national_prefix_for_parsing?: string;
    national_prefix_transform_rule?: string;
    national_number_pattern?: string;
  };
}

/**
 * The text fields a pattern from the service can check: its name for each, and this SDK's.
 * A pattern is compiled with the `u` flag and matched against the trimmed value.
 */
const SERVED_PATTERN_FIELDS = {
  first_name: 'fname',
  last_name: 'lname',
  line1: 'address1',
  line2: 'address2',
  city: 'city',
} as const;

/** Values every address in a country shares, sent without being asked for. */
export type FixedValues = Partial<
  Record<'city' | 'state' | 'postcode', string>
>;

/**
 * One country's rules: `GET /v1/countries/:country`, and `rules` in
 * `GET /v1/geo?include=rules`. Field names are the service's (`first_name`, `postcode`).
 */
export interface CountryRules {
  country: string;
  /** The language `label`, `label_optional` and `errors` are in. */
  lang?: string;
  /** `false` for a country the service serves the default layout. */
  curated?: boolean;
  address: { layout: string[][]; fixed?: FixedValues };
  /** Every field the address layout names, and the email. */
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
  const fieldPatterns = Object.fromEntries(
    Object.entries(SERVED_PATTERN_FIELDS).flatMap(([service, sdk]) => {
      const pattern = rules.fields[service]?.format?.pattern;
      return pattern ? [[sdk, pattern]] : [];
    })
  );

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
    postcodeMaxLength: postcode?.input.max_length ?? Number.MAX_SAFE_INTEGER,
    postcodeExample: postcodeFormat?.example ?? null,
    postcodeFormat: (postcodeFormat?.masks as string[] | undefined) ?? null,
    // A rule with a pattern checks a number. A country with no file of its own has none,
    // but its facts still read one into E.164 once the service sends
    // `national_number_pattern`; before that they were a calling code and an example, and
    // too little to build a number from.
    ...(phone?.pattern || phone?.national_number_pattern
      ? { phone: phone as PhoneRules }
      : {}),
    ...(rules.address.fixed && Object.keys(rules.address.fixed).length > 0
      ? { fixed: rules.address.fixed }
      : {}),
    ...(Object.keys(fieldPatterns).length > 0 ? { fieldPatterns } : {}),
    currencyCode: currencyCode ?? '',
    currencySymbol: '',
  };
}

/**
 * The three empty fields are read from nowhere: `i18n-rules.filtering.ts` already
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
    throw new Error(
      `${url} responded ${response.status} ${response.statusText}`
    );
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
    return flattenTexts(
      await getJson<unknown>(
        `${baseUrl}/v1/locales/${encodeURIComponent(lang)}`
      )
    );
  } catch {
    return undefined;
  }
}

/**
 * How long the SDK waits for the service to check a field. Long enough for a slow mobile
 * connection, short enough that a value it never checks goes on as typed rather than
 * holding anything up.
 */
const VALIDATE_TIMEOUT_MS = 4000;

/**
 * What the service says about a postcode (`postcode` in `POST /v1/validate`'s answer):
 * whether its country uses it, and the state sent beside it does.
 */
export interface PostcodeResult {
  /** `null` where the service checks nothing: a country with no postcode pattern. */
  valid: boolean | null;
  /** The postcode as its country writes it, where `valid`. */
  value?: string;
  /** Why it does not pass, with the sentence to show, in the language asked for. */
  error?: { code: string; message: string };
  /** The state the postcode is in, as the form submits it, where one state's start like it. */
  state?: string;
}

/**
 * The service's answer for each field sent (`POST /v1/validate`), with its messages in
 * `lang`, or `undefined` when it could not answer. The caller then goes on without it.
 *
 * `fetch()`, never `navigator.sendBeacon`: a beacon is a `ping` request, which EasyPrivacy
 * blocks for every third-party host. The values are in the body, never the URL.
 */
async function postValidate(
  fields: Record<string, string>,
  country: string,
  lang: string,
  baseUrl: string
): Promise<Record<string, Record<string, unknown>> | undefined> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), VALIDATE_TIMEOUT_MS);
  try {
    const response = await fetch(
      `${baseUrl}/v1/validate?lang=${encodeURIComponent(lang)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ country, fields }),
        signal: abort.signal,
      }
    );
    if (!response.ok) return undefined;
    const body = (await response.json()) as {
      fields?: Record<string, Record<string, unknown>>;
    };
    return body.fields;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

/** The string keys of `result` among `keys`, the rest dropped. */
function strings<K extends string>(
  result: Record<string, unknown>,
  keys: readonly K[]
): Partial<Record<K, string>> {
  return Object.fromEntries(
    keys
      .filter(key => typeof result[key] === 'string')
      .map(key => [key, result[key]])
  ) as Partial<Record<K, string>>;
}

/** `{ code, message }` when both are strings, else nothing. */
function errorOf(
  result: Record<string, unknown>
): { error: { code: string; message: string } } | object {
  const error = result.error as Record<string, unknown> | undefined;
  return typeof error?.code === 'string' && typeof error.message === 'string'
    ? { error: { code: error.code, message: error.message } }
    : {};
}

/**
 * What the service reads `number` as, typed for an address in `country`, or `undefined`
 * when it could not answer: the number is then sent as typed, and the order API reads it.
 */
export async function fetchPhoneNumber(
  number: string,
  country: string,
  lang: string = DEFAULT_LANG,
  baseUrl: string = NEXT_ADDRESS_BASE_URL
): Promise<PhoneNumberResult | undefined> {
  const result = (
    await postValidate({ phone_number: number }, country, lang, baseUrl)
  )?.phone_number;
  if (typeof result?.valid !== 'boolean') return undefined;
  return {
    valid: result.valid,
    ...strings(result, [
      'value',
      'country',
      'type',
      'national',
      'international',
    ]),
    ...errorOf(result),
  };
}

/**
 * What the service says about `postcode` for an address in `country`, checked against
 * `state` where one is given, or `undefined` when it could not answer.
 */
export async function fetchPostcode(
  postcode: string,
  country: string,
  state: string | undefined,
  lang: string = DEFAULT_LANG,
  baseUrl: string = NEXT_ADDRESS_BASE_URL
): Promise<PostcodeResult | undefined> {
  const fields = { postcode, ...(state ? { state } : {}) };
  const result = (await postValidate(fields, country, lang, baseUrl))?.postcode;
  if (typeof result?.valid !== 'boolean' && result?.valid !== null)
    return undefined;
  return {
    valid: result.valid as boolean | null,
    ...strings(result, ['value', 'state']),
    ...errorOf(result),
  };
}

/**
 * The service's texts in `lang`, and the language they are really in: one it has no file
 * for is answered in English, and says so in `Content-Language` (a CORS-safelisted
 * header). `undefined` when the service could not answer.
 */
export async function fetchTexts(
  lang: string,
  baseUrl: string = NEXT_ADDRESS_BASE_URL
): Promise<{ texts: Record<string, string>; lang: string } | undefined> {
  try {
    const response = await fetch(
      `${baseUrl}/v1/locales/${encodeURIComponent(lang)}`
    );
    if (!response.ok) return undefined;
    const texts = flattenTexts(await response.json());
    return { texts, lang: response.headers.get('content-language') ?? lang };
  } catch {
    return undefined;
  }
}

/**
 * What a country's rules give the messages: each field's errors, where its texts are, and
 * their language.
 */
function errorsOf(
  rules: CountryRules
): Pick<LocationData, 'fieldErrors' | 'fieldLabelIds' | 'messagesLang'> {
  const fieldErrors: Record<string, Readonly<Record<string, string>>> = {};
  const fieldLabelIds: Record<string, string> = {};
  for (const [name, field] of Object.entries(rules.fields)) {
    if (field?.errors) fieldErrors[name] = field.errors;
    if (field?.label_id) fieldLabelIds[name] = field.label_id;
  }
  return {
    fieldErrors,
    fieldLabelIds,
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
    ...errorsOf(rules),
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
    ...errorsOf(rules),
  };
}
