export interface AddressFieldSpec {
  name: string;
  label: string;
  required: boolean;
  autocomplete: string;
  control: 'text' | 'select' | 'tel';
  optionsSource?: 'states';
  placeholder?: string;
  hint?: string;
  example?: string;
  maxLength?: number;
  inputMode?: 'text' | 'numeric' | 'tel';
  autoCapitalize?: 'none' | 'words' | 'characters';
  span?: number;
}

export interface AddressSpec {
  country: string;
  /** Rows of field names. A field absent from it is not collected at all. */
  layout: string[][];
  fields: Record<string, AddressFieldSpec | undefined>;
  fallback?: boolean;
}

/**
 * What the block renders when the first layout cannot be fetched, because a block with no
 * fields leaves the shopper nowhere to type an address. It is the service's own default
 * layout (`zz` in i18n-rules `src/rules/default.ts`), in English. State and postcode are
 * not required: the country's rules are unknown, and refusing a real address is worse
 * than accepting an odd one.
 */
const BUILT_IN_SPEC: Omit<AddressSpec, 'country'> = {
  layout: [
    ['country'],
    ['first_name', 'last_name'],
    ['line1'],
    ['line2'],
    ['city', 'state', 'postcode'],
    ['phone_number'],
  ],
  fields: {
    country: {
      name: 'country',
      label: 'Country',
      required: true,
      autocomplete: 'country',
      control: 'select',
    },
    first_name: {
      name: 'first_name',
      label: 'First name',
      required: true,
      autocomplete: 'given-name',
      control: 'text',
      maxLength: 255,
      autoCapitalize: 'words',
    },
    last_name: {
      name: 'last_name',
      label: 'Last name',
      required: true,
      autocomplete: 'family-name',
      control: 'text',
      maxLength: 255,
      autoCapitalize: 'words',
    },
    line1: {
      name: 'line1',
      label: 'Address',
      required: true,
      autocomplete: 'address-line1',
      control: 'text',
      maxLength: 255,
      autoCapitalize: 'words',
    },
    line2: {
      name: 'line2',
      label: 'Apartment, suite, etc. (optional)',
      required: false,
      autocomplete: 'address-line2',
      control: 'text',
      maxLength: 255,
      autoCapitalize: 'words',
    },
    city: {
      name: 'city',
      label: 'City',
      required: true,
      autocomplete: 'address-level2',
      control: 'text',
      maxLength: 255,
      autoCapitalize: 'words',
      span: 2,
    },
    state: {
      name: 'state',
      label: 'State/Province',
      required: false,
      autocomplete: 'address-level1',
      control: 'text',
      maxLength: 255,
      autoCapitalize: 'words',
    },
    postcode: {
      name: 'postcode',
      label: 'Postal code',
      required: false,
      autocomplete: 'postal-code',
      control: 'text',
      maxLength: 64,
      autoCapitalize: 'characters',
    },
    phone_number: {
      name: 'phone_number',
      label: 'Phone number',
      required: false,
      autocomplete: 'tel',
      control: 'tel',
      maxLength: 24,
      inputMode: 'tel',
    },
  },
  fallback: true,
};

export function builtInAddressSpec(countryCode: string): AddressSpec {
  return { ...BUILT_IN_SPEC, country: countryCode };
}

const DEFAULT_BASE_URL = 'https://i18n-rules.nextcommerce.com';

/** Omitting it falls back to `Accept-Language`, which would localise shipped pages. */
const DEFAULT_LANG = 'en';

/**
 * States are deliberately not requested: the province dropdown is filled by the checkout
 * form from `CountryService`, and asking here too puts two lists on one page.
 */
export async function fetchAddressSpec(
  countryCode: string,
  options: { baseUrl?: string; lang?: string } = {}
): Promise<AddressSpec> {
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
  if (!Array.isArray(body?.spec?.layout)) {
    throw new Error(`Address layout for ${countryCode} carried no layout`);
  }
  return body.spec as AddressSpec;
}
