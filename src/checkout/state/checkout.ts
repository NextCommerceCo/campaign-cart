import { orderError } from '../../engine/api';
import type { CartActions } from '../../engine/cart/cart';
import type { Context } from '../../engine/engine';
import { nextUrl } from '../../engine/params';
import { EXPRESS_METHODS, orderBody, type OrderUrls, paymentCode, publicAddress, userOf } from './order-body';
import { asciiDigits, PHONES, phoneFieldOf, phoneKey, phoneOf } from './phone';
import {
  ADDRESS,
  addressValid,
  fieldError,
  formErrors,
  type RemoteCheck,
  type RulesApi,
  type Scope,
  validEmail,
} from './rules';
import type { AddressType, Contact } from '../../engine/events';
import type { CheckoutError, Order } from '../../engine/types';
import type { AddressSuggestion, CheckoutState, CountryOption, FieldError } from './types';

const PHONE_WAIT = 2000;

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
});

const countryOf = (fields: Record<string, string>, name: string) =>
  name.startsWith('billing_') ? fields.billing_country : fields.country;

const within = (work: Promise<unknown>, ms: number) =>
  Promise.race([work, new Promise((done) => setTimeout(done, ms))]);

export function redirectFor(
  order: Order,
  successUrl: string | undefined,
  current: URL,
  params: Record<string, string>,
) {
  if (order.payment_complete_url) return order.payment_complete_url;
  if (!successUrl) {
    return nextUrl(order.order_status_url ?? `/checkout/confirmation/?ref_id=${order.ref_id}`, current, params);
  }
  const url = new URL(successUrl, current);
  url.searchParams.set('ref_id', order.ref_id);
  return nextUrl(url.href, current, params);
}

export interface PlaceOrder extends OrderUrls {
  method?: string;
  tokenize?: () => Promise<string>;
  phoneRequired?: boolean;
}

export function createCheckout(ctx: Context, cart: CartActions, rulesApi: RulesApi) {
  const state = () => ctx.getState().checkout!;
  const set = (patch: Partial<CheckoutState>, options?: { silent?: boolean }) => ctx.update('checkout', patch, options);
  let started = false;
  let prospecting = false;

  set({ ...emptyCheckout(), ...ctx.saved<Partial<CheckoutState>>('checkout'), status: 'idle', errors: {} });

  const contactOf = (): Contact | undefined => {
    const { fields } = state();
    const [email, first_name, last_name] = ['email', 'first_name', 'last_name'].map((n) => fields[n]?.trim() ?? '');
    if (!validEmail(email!) || first_name!.length < 2 || last_name!.length < 2) return;
    const phone = phoneOf(state(), 'phone_number');
    const accepts_marketing = fields.accepts_marketing !== 'false';
    return {
      email: email!,
      first_name: first_name!,
      last_name: last_name!,
      ...(phone && { phone }),
      accepts_marketing,
    };
  };
  const contactKey = (contact?: Contact) => JSON.stringify(contact ?? null);
  let contact = state().prospectSaved ? contactKey(contactOf()) : undefined;
  const addresses: Partial<Record<AddressType, string>> = {};

  const loadCountry = async (code: string): Promise<void> => {
    if (!code || state().rules[code]) return;
    try {
      const rules = await rulesApi.country(code);
      set({ rules: { ...state().rules, [code]: rules } });
    } catch (err) {
      set({ rulesDown: true });
      ctx.fail('address.rules', err);
    }
  };

  const saveContact = async (): Promise<void> => {
    const now = contactOf();
    const campaign = ctx.getState().campaign;
    if (!now || prospecting || !campaign) return;
    if (state().prospectSaved) {
      if (contactKey(now) === contact) return;
      contact = contactKey(now);
      set({ contact: now });
      ctx.emit('contact.updated', cart.currentCheckout());
      return;
    }
    prospecting = true;
    try {
      const saved = await ctx.api.createCart({
        lines: cart.lines(),
        user: userOf(state().fields, now.phone),
        currency: campaign.currency,
        attribution: ctx.attribution(),
      });
      set({ prospectSaved: true, openCart: saved, contact: now });
      contact = contactKey(now);
      ctx.emit('contact.entered', cart.currentCheckout());
    } catch (err) {
      ctx.fail('contact.save', err);
    } finally {
      prospecting = false;
    }
  };

  const announceAddresses = () => {
    if (!started) return;
    const checkout = state();
    for (const type of ['shipping', 'billing'] as const) {
      const prefix = type === 'billing' ? 'billing_' : '';
      if ((type === 'billing' && checkout.sameAsShipping) || !addressValid(checkout, prefix)) continue;
      const now = ADDRESS.map((name) => checkout.fields[prefix + name]?.trim() ?? '').join('|');
      const before = addresses[type];
      if (now === before) continue;
      addresses[type] = now;
      set(
        type === 'billing'
          ? { billingAddress: publicAddress(checkout, prefix) }
          : { shippingAddress: publicAddress(checkout, prefix) },
      );
      ctx.emit(before === undefined ? 'address.entered' : 'address.updated', {
        ...cart.currentCheckout(),
        address_type: type,
      });
    }
  };

  const verifyPostcode = async (): Promise<void> => {
    const { fields } = state();
    const value = fields.postcode?.trim();
    if (!fields.country || !value) return;
    try {
      const sent = { postcode: value, ...(fields.state && { state: fields.state }) };
      const result = (await rulesApi.validate(fields.country, sent)).postcode;
      if (state().fields.postcode?.trim() !== value || !result?.error || state().errors.postcode) return;
      set({ errors: { ...state().errors, postcode: { ...result.error, warning: true } } });
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

  return {
    begin(): void {
      if (started || !cart.lines().length) return;
      started = true;
      ctx.emit('checkout.started', cart.currentCheckout());
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
      if (isCountry) void loadCountry(value).then(() => (announceAddresses(), checkPhone(phone, true)));
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
      if (changed) ctx.emit('payment.selected', cart.currentCheckout());
    },

    setStep(step: number): void {
      set({ step });
    },

    problems(scope: Scope = 'all'): Record<string, FieldError> {
      return formErrors(state(), scope);
    },

    validate(scope: Scope, phoneRequired = false): boolean {
      const errors = formErrors(state(), scope, phoneRequired);
      set({ errors: showErrors(errors) });
      return !Object.keys(errors).length;
    },

    paymentReady(): void {
      if (!state().cardReady) set({ cardReady: true });
    },

    async suggestAddresses(query: string, country: string, signal?: AbortSignal): Promise<AddressSuggestion[]> {
      try {
        return (await ctx.api.autocomplete(query, country, signal)).results ?? [];
      } catch (err) {
        if (!signal?.aborted) ctx.fail('address.autocomplete', err);
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
        ctx.fail('address.rules', err);
        countries = (campaign?.available_shipping_countries ?? []).map((c) => ({ code: c.code, name: c.label }));
        countries = countries.filter(keep);
      }
      set({ countries });
      const listed = (code?: string) => countries.find((c) => c.code === code?.toUpperCase())?.code;
      let country = listed(state().fields.country) ?? listed(ctx.getState().visit.params.country);
      if (!country) {
        try {
          const geo = await rulesApi.geo();
          country = listed(geo.country?.code);
          if (country && geo.rules) set({ rules: { ...state().rules, [country]: geo.rules } });
        } catch {}
      }
      country = state().fields.country || (country ?? listed('US') ?? countries[0]?.code);
      if (country && country !== state().fields.country) set({ fields: { ...state().fields, country } });
      await Promise.all([country && loadCountry(country), loadCountry(state().fields.billing_country ?? '')]);
    },

    async placeOrder(input: PlaceOrder): Promise<Order | undefined> {
      if (state().status !== 'idle') return undefined;
      const method = input.method ? paymentCode(input.method) : state().paymentMethod;
      const express = EXPRESS_METHODS.includes(method);
      set({ status: 'placing' });
      cart.freeze(true);
      const fail = (errors: Record<string, CheckoutError>) => {
        set({ status: 'idle', errors });
        cart.freeze(false);
        return undefined;
      };
      const stop = (errors: Record<string, CheckoutError>) => {
        ctx.emit('checkout.submitted', { ...cart.currentCheckout(), payment_method: method, valid: false, errors });
        return fail(errors);
      };

      if (!express) {
        const phones = PHONES.filter((name) => !name.startsWith('billing_') || !state().sameAsShipping);
        await within(Promise.all(phones.map((name) => checkPhone(name))), PHONE_WAIT);
      }
      const invalid = input.method ? {} : formErrors(state(), express ? 'express' : 'all', input.phoneRequired);
      if (Object.keys(invalid).length) return stop(showErrors(invalid));
      if (!cart.lines().length) return stop({ form: { code: 'empty_cart' } });
      await cart.settled();

      let token: string | undefined;
      if (method === 'card_token') {
        if (!input.tokenize) {
          ctx.log.warn('card payment needs cc-number and cvv fields and a campaign payment_env_key');
          return stop({ form: { code: 'card' } });
        }
        try {
          token = await input.tokenize();
        } catch (err) {
          return stop({ form: { code: 'card', message: err instanceof Error ? err.message : undefined } });
        }
      }

      ctx.emit('checkout.submitted', { ...cart.currentCheckout(), payment_method: method, valid: true, errors: {} });
      try {
        const vouchers = cart.vouchers();
        const order = await ctx.api.createOrder(
          orderBody(ctx.getState(), {
            method,
            token,
            lines: cart.lines(),
            vouchers,
            attribution: ctx.attribution(),
            urls: input,
          }),
        );
        if (vouchers[0]) ctx.update('order', { coupon: { refId: order.ref_id, code: vouchers[0] } }, { silent: true });
        ctx.emit('order.created', { order });
        if (order.payment_complete_url) {
          set({
            status: 'placed',
            pendingRef: order.ref_id,
            failurePath: new URL(input.failureUrl, input.pageUrl).pathname,
          });
        } else {
          cart.clearAfterOrder();
          set({ ...emptyCheckout(), status: 'placed' }, { silent: true });
        }
        return order;
      } catch (err) {
        const error = orderError(err);
        ctx.fail('order.create', err);
        ctx.emit('order.failed', {
          stage: 'order',
          code: error.code,
          ...(error.message && { message: error.message }),
          ...(error.decline && { decline: error.decline }),
        });
        return fail({ form: error });
      }
    },
  };
}

export type CheckoutActions = ReturnType<typeof createCheckout>;
