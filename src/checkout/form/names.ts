import type { CheckoutState, CountryRules } from '../state/types';
import { countryOf } from '../state/phone';
import { LEGACY_FIELDS, pageFieldName } from '../../compat/checkout';

const V2_NAMES: Record<string, string> = {
  'card.number': 'cc-number',
  'card.cvv': 'cvv',
  'card.expiry': 'cc-expiry',
  payment_method: 'payment-method',
  billing_same_as_shipping: 'use-shipping-address',
};

const ADDRESS_KEYS = ['first_name', 'last_name', 'phone', 'country', 'line1', 'line2', 'city', 'state', 'postcode'];

/** A field name in any spelling (`billing-fname`, `billing_first_name`, `phone`) as its API name, split. */
export function parse(raw: string): { billing: boolean; api: string } {
  const base = raw.replace(/^billing[-_]/, '');
  return { billing: base !== raw, api: LEGACY_FIELDS[base] ?? base };
}

/** `billing-fname` → `billing_first_name`. */
export function toApi(raw: string): string {
  const { billing, api } = parse(raw);
  return billing ? `billing_${api}` : api;
}

/** The page name `data-next-address` gives a field it builds: `billing_line1` → `billing-address1`. */
export const toPage = (name: string) => pageFieldName(name, '-');

/** The `data-next-field` key of an API field: `phone_number` is `phone`. */
export const toV2 = (name: string) => name.replace(/phone_number$/, 'phone');

/** The page name a `data-next-field` key stands for; address keys inside a billing block are billing fields. */
export const fromV2 = (key: string, billing: boolean) =>
  V2_NAMES[key] ?? (billing && ADDRESS_KEYS.includes(key) ? `billing-${key}` : key);

/** The rules of the country the field's address is in. */
export const rulesOf = (state: CheckoutState | undefined, name: string): CountryRules | undefined =>
  state?.rules[countryOf(state.fields, name) ?? ''];
