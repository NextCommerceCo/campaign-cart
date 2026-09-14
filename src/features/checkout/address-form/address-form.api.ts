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

const DEFAULT_BASE_URL = 'https://next-address.kasemsanm-dev.workers.dev';

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
  const url = `${baseUrl}/v1/layout/${encodeURIComponent(countryCode)}?lang=${encodeURIComponent(lang)}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Address layout for ${countryCode} responded ${response.status} ${response.statusText}`
    );
  }

  const body = await response.json();
  if (!body?.spec?.layout) {
    throw new Error(`Address layout for ${countryCode} carried no layout`);
  }
  return body.spec as AddressSpec;
}
