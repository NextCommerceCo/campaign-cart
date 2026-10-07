/**
 * The address values a country fixes for every address in it: Vatican City's city and
 * postcode, Singapore's city. The address-rules service sends them in place of a field,
 * and the order still needs them, so they are written into the address as the country is
 * chosen, and taken back out when the shopper moves to a country that fixes nothing.
 */

import type { I18nRules, FixedValues } from '@/core/i18n-rules';
import type { Logger } from '@/core/logger';
import { useCheckoutStore } from '@/state/checkout';

/** The checkout field each fixable field is kept in, shipping and billing alike. */
const FORM_FIELD = {
  city: 'city',
  state: 'province',
  postcode: 'postal',
} as const;

/**
 * What to write to take `address` from one country's fixed values to another's: each new
 * value, and an empty one for each old value still there. A value the shopper changed is
 * theirs and is left alone.
 *
 * `{ city: 'Vatican City' }` → `{}` on `{ city: 'Vatican City' }` gives `{ city: '' }`.
 */
export function fixedValuesPatch(
  address: Readonly<Record<string, unknown>> | undefined,
  from: FixedValues | undefined,
  to: FixedValues | undefined
): Record<string, string> {
  const patch: Record<string, string> = {};
  for (const [name, value] of Object.entries(from ?? {})) {
    const key = FORM_FIELD[name as keyof FixedValues];
    if (
      address?.[key] === value &&
      to?.[name as keyof FixedValues] === undefined
    ) {
      patch[key] = '';
    }
  }
  for (const [name, value] of Object.entries(to ?? {})) {
    if (value !== undefined)
      patch[FORM_FIELD[name as keyof FixedValues]] = value;
  }
  return patch;
}

/** What {@link applyFixedValues} needs from the checkout form. */
export interface FixedValuesContext {
  i18nRules: I18nRules;
  logger: Logger;
  updateFormData: (data: Record<string, string>) => void;
}

/** The country whose values an address holds now, per address. */
export interface AppliedFixedValues {
  country?: string;
  values?: FixedValues;
  /** `values` are `country`'s: false while that country's rules are loading. */
  settled?: boolean;
}

/** Writes `patch` into one address, and says so in the debug log. */
function writeFixedValues(
  ctx: FixedValuesContext,
  form: 'shipping' | 'billing',
  country: string | undefined,
  patch: Record<string, string>
): void {
  if (Object.keys(patch).length === 0) return;

  const state = useCheckoutStore.getState();
  if (form === 'shipping') {
    ctx.updateFormData(patch);
  } else if (state.billingAddress) {
    state.setBillingAddress({ ...state.billingAddress, ...patch });
  }
  ctx.logger.debug(
    `Wrote the fixed ${form} address values of ${country ?? 'no country'}`,
    {
      fields: Object.keys(patch),
    }
  );
}

/**
 * Brings one address's fixed values in line with `country`. `applied` is updated in place,
 * before the country's rules are fetched, so a store update this makes does not start it
 * again; a country changed again while they load is left to that newer call.
 */
export async function applyFixedValues(
  ctx: FixedValuesContext,
  form: 'shipping' | 'billing',
  country: string | undefined,
  applied: AppliedFixedValues
): Promise<void> {
  applied.country = country;
  applied.settled = false;
  let values: FixedValues | undefined;
  if (country) {
    try {
      values = (await ctx.i18nRules.getCountryStates(country)).countryConfig
        .fixed;
    } catch (error) {
      ctx.logger.warn(
        `Could not read the fixed address values of ${country}`,
        error
      );
    }
  }
  if (applied.country !== country) return;

  const state = useCheckoutStore.getState();
  const address = form === 'shipping' ? state.formData : state.billingAddress;
  const patch = fixedValuesPatch(address, applied.values, values);
  applied.values = values;
  applied.settled = true;
  writeFixedValues(ctx, form, country, patch);
}

/**
 * Writes back the fixed values an address lost while its country stayed the same.
 *
 * The billing toggle empties the address each time the section opens and keeps the
 * country, so {@link applyFixedValues}, which runs on a country change, never put Vatican
 * City's city back: submit then asked for a city the block has no field for. Only an empty
 * value is refilled, so one the shopper typed stays theirs.
 */
export function refillFixedValues(
  ctx: FixedValuesContext,
  form: 'shipping' | 'billing',
  applied: AppliedFixedValues
): void {
  if (!applied.settled) return;

  const state = useCheckoutStore.getState();
  const address: Readonly<Record<string, unknown>> | undefined =
    form === 'shipping' ? state.formData : state.billingAddress;
  const patch: Record<string, string> = {};
  for (const [name, value] of Object.entries(applied.values ?? {})) {
    const key = FORM_FIELD[name as keyof FixedValues];
    if (value !== undefined && !address?.[key]) patch[key] = value;
  }
  writeFixedValues(ctx, form, applied.country, patch);
}
