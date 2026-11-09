import type { Context } from '../../engine/engine';
import { visitorGeo } from '../../engine/geo';
import type { RulesApi } from './rules';
import type { CheckoutState, CountryOption } from './types';

/** The checkout's countries and each country's rules, from i18n-rules; the campaign's countries when it is down. */
export function createCountries(ctx: Context, rulesApi: RulesApi) {
  const state = () => ctx.getState().checkout!;
  const set = (patch: Partial<CheckoutState>) => ctx.update('checkout', patch);

  const loadCountry = async (code: string): Promise<void> => {
    if (!code || state().rules[code]) return;
    try {
      const rules = await rulesApi.country(code);
      set({ rules: { ...state().rules, [code]: rules } });
    } catch (err) {
      set({ rulesDown: true });
      ctx.fail('address.load_rules', err);
    }
  };

  return {
    loadCountry,
    async loadCountries(allowed: string[] = []): Promise<void> {
      const campaign = ctx.getState().campaign;
      const offered = campaign?.available_shipping_countries?.map((c) => c.code) ?? [];
      const keep = (c: CountryOption) =>
        (!offered.length || offered.includes(c.code)) && (!allowed.length || allowed.includes(c.code));
      let countries: CountryOption[] = [];
      try {
        countries = (await rulesApi.countries()).filter(keep);
      } catch (err) {
        ctx.fail('address.load_rules', err);
        countries = (campaign?.available_shipping_countries ?? []).map((c) => ({ code: c.code, name: c.label }));
        countries = countries.filter(keep);
      }
      set({ countries });
      const listed = (code?: string) => countries.find((c) => c.code === code?.toUpperCase())?.code;
      let country = listed(state().fields.country) ?? listed(ctx.getState().visit.params.country);
      const located = visitorGeo(ctx, () => rulesApi.geo());
      if (!country) country = listed((await located)?.country?.code);
      country = state().fields.country || (country ?? listed('US') ?? countries[0]?.code);
      if (country && country !== state().fields.country) set({ fields: { ...state().fields, country } });
      await Promise.all([country && loadCountry(country), loadCountry(state().fields.billing_country ?? '')]);
    },
  };
}
