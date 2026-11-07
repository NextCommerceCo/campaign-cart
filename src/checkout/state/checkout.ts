import type { CartActions } from '../../engine/cart/cart';
import type { Context } from '../../engine/engine';
import { visitorGeo } from '../../engine/geo';
import { newId } from '../../engine/id';
import { createContact, type Lead } from './contact';
import { paymentCode, publicAddress } from './order-body';
import { createPlaceOrder } from './place-order';
import { asciiDigits, PHONES, phoneFieldOf, phoneKey } from './phone';
import {
  addressValid,
  fieldError,
  formErrors,
  postcodeChecked,
  type RemoteCheck,
  type RulesApi,
  type Scope,
} from './rules';
import type { Address, AddressType, Checkout } from '../../engine/events/checkout';
import type { CheckoutError } from '../../engine/types';
import type { AddressSuggestion, CheckoutState, CountryOption, FieldError } from './types';

const emptyCheckout = (): CheckoutState => ({
  fields: {},
  phones: {},
  sameAsShipping: true,
  paymentMethod: 'card_token',
  step: 0,
  errors: {},
  status: 'idle',
  countries: [],
  rules: {},
  prospectSaved: false,
  shippingAddress: undefined,
  billingAddress: undefined,
  id: undefined,
  reported: undefined,
  user: undefined,
  openCart: undefined,
  pendingRef: undefined,
  pendingMethod: undefined,
  express: undefined,
  steps: undefined,
});

const countryOf = (fields: Record<string, string>, name: string) =>
  name.startsWith('billing_') ? fields.billing_country : fields.country;

export function createCheckout(
  ctx: Context,
  cart: CartActions,
  rulesApi: RulesApi,
  { lead = 'email', opened }: { lead?: Lead; opened?: (checkout: Checkout) => void } = {},
) {
  const state = () => ctx.getState().checkout!;
  const set = (patch: Partial<CheckoutState>, options?: { silent?: boolean }) => ctx.update('checkout', patch, options);
  let bound = false;
  let open = false;

  set({ ...emptyCheckout(), ...ctx.saved<Partial<CheckoutState>>('checkout'), status: 'idle', errors: {} });

  const saveContact = createContact(ctx, cart, lead, () => open);

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

  const announceAddresses = () => {
    if (!open) return;
    const checkout = state();
    for (const type of ['shipping', 'billing'] as const) {
      const prefix = type === 'billing' ? 'billing_' : '';
      if ((type === 'billing' && checkout.sameAsShipping) || !addressValid(checkout, prefix)) continue;
      const before = type === 'billing' ? checkout.billingAddress : checkout.shippingAddress;
      const address = publicAddress(checkout, prefix);
      if (JSON.stringify(address) === JSON.stringify(before)) continue;
      set(type === 'billing' ? { billingAddress: address } : { shippingAddress: address });
      ctx.emit(before ? 'address.updated' : 'address.entered', { ...address, type });
    }
  };

  const verifyPostcode = async (): Promise<void> => {
    const { fields } = state();
    const value = fields.postcode?.trim();
    if (!fields.country || !value) return;
    try {
      const sent = { postcode: value, ...(fields.state && { state: fields.state }) };
      const result = (await rulesApi.validate(fields.country, sent)).postcode;
      const errors = postcodeChecked(state(), fields, result);
      if (errors) set({ errors });
    } catch {}
  };

  const phoneChecks = new Map<string, Promise<RemoteCheck | undefined>>();
  const checkPhone = async (name: string, warn = false): Promise<void> => {
    const country = countryOf(state().fields, name);
    const typed = asciiDigits(state().fields[name]?.trim() ?? '');
    if (!country || !typed) return;
    const key = `${country}|${phoneKey(typed)}`;
    let check = phoneChecks.get(key);
    if (!check) {
      check = rulesApi.validate(country, { phone_number: typed }).then(
        (fields) => fields.phone_number,
        () => undefined,
      );
      phoneChecks.set(key, check);
      void check.then((result) => result || phoneChecks.delete(key));
    }
    const result = await check;
    const { fields, phones, errors } = state();
    if (!result || countryOf(fields, name) !== country || phoneKey(fields[name] ?? '') !== phoneKey(typed)) return;
    if (result.valid && result.value) {
      const { [name]: error, ...rest } = errors;
      set({
        phones: {
          ...phones,
          [name]: {
            value: result.value,
            country: result.country ?? country,
            national: result.national,
            international: result.international,
          },
        },
        ...(error?.code === 'invalid' && { errors: rest }),
      });
    } else if (warn && result.error && !errors[name]) {
      set({ errors: { ...errors, [name]: { ...result.error, warning: true } } });
    }
  };

  const showErrors = (errors: Record<string, string>) =>
    Object.fromEntries(Object.entries(errors).map(([name, code]) => [name, { code } as CheckoutError]));

  const validate = (scope: Scope, phoneRequired = false): boolean => {
    const errors = formErrors(state(), scope, phoneRequired);
    set({ errors: showErrors(errors) });
    return !Object.keys(errors).length;
  };

  const start = () => {
    if (!bound || open || !cart.lines().length) return;
    open = true;
    if (state().id) opened?.(cart.currentCheckout());
    else {
      set({ id: newId() });
      const off = ctx.on('checkout.started', (e) => {
        off();
        opened?.(e.data);
      });
      ctx.emit('checkout.started', cart.currentCheckout());
    }
    announceAddresses();
    void saveContact();
  };
  ctx.on('cart.updated', start);

  const invalid = (errors: Record<string, CheckoutError>, method?: string) =>
    ctx.emit('checkout.invalid', { ...cart.currentCheckout(), ...(method && { payment_method: method }), errors });

  const placeOrder = createPlaceOrder(ctx, cart, {
    checkPhone,
    showErrors,
    invalid,
    reset: () => set({ ...emptyCheckout(), status: 'placed' }, { silent: true }),
  });

  return {
    placeOrder,
    begin(): void {
      bound = true;
      start();
    },

    reported: (name: string): boolean => !!state().reported?.includes(name),

    markReported(name: string): void {
      const reported = state().reported ?? [];
      if (!reported.includes(name)) set({ reported: [...reported, name] }, { silent: true });
    },

    setField(name: string, value: string): void {
      const { fields, phones } = state();
      if (state().status === 'placed' || fields[name] === value) return;
      const isCountry = name === 'country' || name === 'billing_country';
      const phone = isCountry ? phoneFieldOf(name) : name;
      const forget =
        isCountry || (PHONES.includes(name) && phoneKey(fields[name] ?? '') !== phoneKey(value)) ? phone : undefined;
      const { [name]: _, ...errors } = state().errors;
      if (isCountry && errors[phone]?.warning) delete errors[phone];
      const { [forget ?? '']: __, ...kept } = phones;
      set({
        fields: {
          ...fields,
          [name]: value,
          ...(isCountry && !!fields[name] && { [name.replace('country', 'state')]: '' }),
        },
        errors,
        phones: kept,
      });
      if (isCountry) void loadCountry(value).then(() => checkPhone(phone, true).then(announceAddresses));
    },

    async leave(name: string): Promise<void> {
      const { fields, rules } = state();
      const country = name.startsWith('billing_') ? fields.billing_country : fields.country;
      const code = fieldError(name, fields[name] ?? '', false, rules[country ?? '']);
      if (code) set({ errors: { ...state().errors, [name]: { code } } });
      if (PHONES.includes(name)) await checkPhone(name, true);
      if (name === 'postcode' || name === 'state') await verifyPostcode();
      announceAddresses();
      await saveContact();
    },

    readPhone(name: string): Promise<void> {
      return checkPhone(name);
    },

    writePhone(name: string): void {
      const { fields, phones } = state();
      const read = phones[name];
      const written = read && (read.country === countryOf(fields, name) ? read.national : read.international);
      if (written && written !== fields[name]) set({ fields: { ...fields, [name]: written } });
    },

    setSameAsShipping(same: boolean): void {
      if (same === state().sameAsShipping) return;
      set({ sameAsShipping: same });
      if (!same && !state().fields.billing_country && state().fields.country) {
        set({ fields: { ...state().fields, billing_country: state().fields.country! } });
      }
      announceAddresses();
    },

    setPaymentMethod(word: string): void {
      const { form: _, ...errors } = state().errors;
      const method = paymentCode(word);
      const changed = method !== state().paymentMethod;
      set({ paymentMethod: method, errors });
      if (changed && open) ctx.emit('payment.selected', { method });
    },

    setStep(step: number, page?: string): void {
      set({ step, ...(page !== undefined && { steps: { ...state().steps, [page]: step } }) });
    },

    nextStep(phoneRequired = false): boolean {
      if (!validate('shipping', phoneRequired)) {
        invalid(state().errors);
        return false;
      }
      ctx.emit('checkout.continued', cart.currentCheckout());
      set({ step: (state().step || 1) + 1 });
      return true;
    },

    problems(scope: Scope = 'all'): Record<string, FieldError> {
      return formErrors(state(), scope);
    },

    validate,

    autofill(type: AddressType, { address }: AddressSuggestion): void {
      if (!open) return;
      const filled: Partial<Address> = {
        line1: address.line1,
        city: address.city,
        postcode: address.postcode,
        country: address.country_code,
        state: address.state_code,
      };
      ctx.emit('address.autofilled', {
        ...Object.fromEntries(Object.entries(filled).filter(([, value]) => value)),
        type,
      });
    },

    paymentReady(): void {
      if (!state().cardReady) set({ cardReady: true });
    },

    async suggestAddresses(query: string, country: string, signal?: AbortSignal): Promise<AddressSuggestion[]> {
      try {
        return (await ctx.api.autocomplete(query, country, signal)).results ?? [];
      } catch (err) {
        if (!signal?.aborted) ctx.fail('address.suggest', err);
        return [];
      }
    },

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

export type CheckoutActions = ReturnType<typeof createCheckout>;
