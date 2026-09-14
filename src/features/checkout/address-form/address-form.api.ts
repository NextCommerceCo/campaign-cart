/**
 * The per-country address layout, from the next-address Worker.
 *
 * This is the only thing this feature fetches. Which countries exist, which states a
 * country has, what a postcode must look like — all of that still comes from
 * `CountryService` and the checkout form, exactly as it does for a hand-written address
 * form. next-address answers one question the SDK could not answer before: **which fields
 * does this country collect, and in what order.**
 *
 * The API is public, `GET`-only and unauthenticated; see `docs/http-api.md` in the
 * next-address repo.
 */

/** A field's role, as an HTML `autocomplete` token — `address-line1`, `postal-code`, … */
export type AddressRole = string;

/** One field of a country's address form, already localized by the Worker. */
export interface AddressFieldSpec {
  name: string;
  label: string;
  required: boolean;
  /** Drives browser autofill. Prefixed with `shipping`/`billing` when rendered. */
  autocomplete: AddressRole;
  control: 'text' | 'select' | 'tel';
  /** A `select` whose options another part of the SDK fills. */
  optionsSource?: 'states';
  placeholder?: string;
  hint?: string;
  example?: string;
  maxLength?: number;
  inputMode?: 'text' | 'numeric' | 'tel';
  autoCapitalize?: 'none' | 'words' | 'characters';
  /** Relative width within its row. Rows are laid out as a fractional grid. */
  span?: number;
}

/**
 * Everything needed to render one country's address form.
 *
 * `layout` is the load-bearing field: rows of field names. The US puts
 * `city / state / postcode` on one line, Germany leads that line with the postcode, and
 * Japan starts the whole form with it. **A field absent from the layout is not collected
 * at all** — not shown, not required, not validated.
 */
export interface AddressSpec {
  country: string;
  layout: string[][];
  fields: Record<string, AddressFieldSpec | undefined>;
  /** True when this country has no rules of its own and uses the default format. */
  fallback?: boolean;
}

const DEFAULT_BASE_URL = 'https://next-address.kasemsanm-dev.workers.dev';

/**
 * Pinned rather than left to `Accept-Language`.
 *
 * next-address localizes labels into twelve languages and falls back to the browser's
 * header when `?lang=` is absent, so omitting it would show a Thai shopper
 * "รหัสไปรษณีย์" where every shipped page says "Postcode" today. Turning that on is a
 * change to make on purpose — `data-next-address-lang` is how a page asks for it.
 */
const DEFAULT_LANG = 'en';

/**
 * One country's layout.
 *
 * An unlisted country is answered with the default layout under its own code rather than
 * a `404`, so there is no not-found branch here: a visitor from an uncurated country
 * still has to be able to check out.
 *
 * States are deliberately **not** requested (`?include=states` is omitted). The province
 * dropdown this feature renders is filled by the checkout form's own `state-fields.ts`
 * from `CountryService`, the same way it fills a hand-written one — asking twice would
 * put two lists of provinces on one page and leave no answer for which is right.
 *
 * @example
 * ```ts
 * const spec = await fetchAddressSpec('JP');
 * spec.layout;
 * // → [['country'], ['postcode', 'state'], ['city'], ['line1'], ['line2']]
 * ```
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
