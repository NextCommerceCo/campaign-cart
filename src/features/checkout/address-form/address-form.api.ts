import type { CountryRules, RulesField } from '@/core/country-service';

const text = (
  label: string,
  autocomplete: string,
  input: Partial<RulesField['input']> = {},
  required = false
): RulesField => ({
  label,
  required,
  autocomplete,
  input: { type: 'text', autoCapitalize: 'words', maxLength: 255, ...input },
});

/**
 * What a block renders when the first answer cannot be fetched, because a block with no
 * fields leaves the shopper nowhere to type. It is the service's own default layout
 * (`src/rules/default.json` in i18n-rules), in English. State and postcode are not
 * required: the country's rules are unknown, and refusing a real address is worse than
 * accepting an odd one.
 */
const BUILT_IN_RULES: Omit<CountryRules, 'country'> = {
  curated: false,
  address: {
    layout: [
      ['country'],
      ['first_name', 'last_name'],
      ['line1'],
      ['line2'],
      ['city', 'state', 'postcode'],
      ['phone_number'],
    ],
  },
  contact: {
    layout: [['first_name', 'last_name'], ['email'], ['phone_number']],
  },
  fields: {
    country: {
      label: 'Country',
      required: true,
      autocomplete: 'country',
      input: { type: 'select', options: 'countries' },
    },
    first_name: text('First name', 'given-name', {}, true),
    last_name: text('Last name', 'family-name', {}, true),
    email: {
      label: 'Email',
      required: true,
      autocomplete: 'email',
      input: {
        type: 'email',
        inputMode: 'email',
        autoCapitalize: 'none',
        maxLength: 254,
      },
    },
    phone_number: {
      label: 'Phone number',
      required: false,
      autocomplete: 'tel',
      input: { type: 'tel', inputMode: 'tel', maxLength: 24 },
    },
    line1: text('Address', 'address-line1', {}, true),
    line2: text('Apartment, suite, etc.', 'address-line2'),
    city: text('City', 'address-level2', { span: 2 }, true),
    state: text('State/Province', 'address-level1'),
    postcode: text('Postal code', 'postal-code', {
      autoCapitalize: 'characters',
      maxLength: 64,
    }),
  },
};

export function builtInRules(countryCode: string): CountryRules {
  return { ...BUILT_IN_RULES, country: countryCode };
}

const DEFAULT_BASE_URL = 'https://i18n-rules.nextcommerce.com';

/** Omitting it falls back to `Accept-Language`, which would localise shipped pages. */
const DEFAULT_LANG = 'en';

/**
 * States are deliberately not requested: the province dropdown is filled by the checkout
 * form from `CountryService`, and asking here too puts two lists on one page.
 */
export async function fetchCountryRules(
  countryCode: string,
  options: { baseUrl?: string; lang?: string } = {}
): Promise<CountryRules> {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const lang = options.lang ?? DEFAULT_LANG;
  const url = `${baseUrl}/v1/countries/${encodeURIComponent(countryCode)}?lang=${encodeURIComponent(lang)}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Address layout for ${countryCode} responded ${response.status} ${response.statusText}`
    );
  }

  const body = await response.json();
  // Checked for shape, not just presence: the caller guards the request, not the render,
  // so a `layout` that is not an array throws where nothing is listening.
  if (
    !Array.isArray(body?.address?.layout) ||
    !Array.isArray(body?.contact?.layout) ||
    !body?.fields
  ) {
    throw new Error(`Address layout for ${countryCode} carried no layout`);
  }
  return body as CountryRules;
}
