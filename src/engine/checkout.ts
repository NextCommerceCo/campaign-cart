import type { Attribution } from './attribution';
import type { CartActions } from './cart';
import type { Context } from './engine';
import { orderError } from './errors';
import { nextUrl } from './params';
import { fieldError, formErrors, type RulesApi, type Scope, validEmail } from './rules';
import type {
  Address,
  ApiLine,
  CheckoutError,
  CheckoutState,
  CountryOption,
  EventMap,
  Order,
  OrderBody,
  State,
} from './types';

export const EXPRESS_METHODS = ['paypal', 'apple_pay', 'google_pay', 'shop_pay'];
const LANGUAGE = 'en';

export function paymentCode(word: string): string {
  const code = word.trim().toLowerCase().replace(/-/g, '_');
  return ['credit', 'credit_card', 'card', 'card_token'].includes(code) ? 'card_token' : code;
}

const emptyCheckout = (): CheckoutState => ({
  fields: {},
  sameAsShipping: true,
  paymentMethod: 'card_token',
  step: 0,
  errors: {},
  status: 'idle',
  countries: [],
  rules: {},
  prospectSaved: false,
});

export interface OrderUrls {
  successUrl?: string;
  failureUrl: string;
  pageUrl: string;
}

function address(fields: Record<string, string>, prefix: '' | 'billing_', phone?: string): Address {
  const get = (name: string) => fields[prefix + name]?.trim() || undefined;
  const optional = { line2: get('line2'), state: get('state'), postcode: get('postcode'), phone_number: phone };
  return {
    first_name: get('first_name') ?? '',
    last_name: get('last_name') ?? '',
    line1: get('line1') ?? '',
    line4: get('city') ?? '',
    country: get('country') ?? '',
    ...Object.fromEntries(Object.entries(optional).filter(([, v]) => v)),
  };
}

export function orderBody(
  state: State,
  order: {
    method: string;
    token?: string;
    lines: ApiLine[];
    vouchers: string[];
    attribution: Attribution;
    urls: OrderUrls;
  },
): OrderBody {
  const { method, token, urls } = order;
  const campaign = state.campaign!;
  const body: OrderBody = {
    lines: order.lines,
    vouchers: order.vouchers,
    attribution: order.attribution,
    currency: campaign.currency,
    shipping_method: state.cart.shippingId ?? campaign.shipping_methods[0]?.ref_id ?? 1,
    payment_detail: { payment_method: method, ...(token && { card_token: token }) },
    success_url: new URL(urls.successUrl ?? '/success', urls.pageUrl).href,
    payment_failed_url: urls.failureUrl,
  };
  if (EXPRESS_METHODS.includes(method)) return body;
  const checkout = state.checkout!;
  const f = checkout.fields;
  const phone = checkout.phoneE164 ?? (f.phone_number?.trim() || undefined);
  return {
    ...body,
    user: {
      email: f.email?.trim() ?? '',
      first_name: f.first_name?.trim() ?? '',
      last_name: f.last_name?.trim() ?? '',
      language: LANGUAGE,
      ...(phone && { phone_number: phone }),
      accepts_marketing: f.accepts_marketing !== 'false',
    },
    shipping_address: address(f, '', phone),
    billing_same_as_shipping_address: checkout.sameAsShipping,
    ...(!checkout.sameAsShipping && { billing_address: address(f, 'billing_', f.billing_phone_number?.trim()) }),
  };
}

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
  const once = new Set<string>();
  let prospecting = false;

  set({ ...emptyCheckout(), ...ctx.saved<Partial<CheckoutState>>('checkout'), status: 'idle', errors: {} });

  const emitOnce = <K extends 'checkout.started' | 'checkout.shipping-added' | 'checkout.payment-added'>(
    name: K,
    data: EventMap[K],
  ) => {
    if (once.has(name)) return;
    once.add(name);
    ctx.emit(name, data);
  };

  const tier = () => ctx.getState().cart.summary?.shipping_method?.name ?? 'Standard';
  ctx.on(
    'shipping.changed',
    () => once.has('checkout.started') && emitOnce('checkout.shipping-added', { tier: tier() }),
  );

  const loadCountry = async (code: string): Promise<void> => {
    if (!code || state().rules[code]) return;
    try {
      const rules = await rulesApi.country(code);
      set({ rules: { ...state().rules, [code]: rules } });
    } catch (err) {
      ctx.fail('country', err);
    }
  };

  const saveProspect = async (): Promise<void> => {
    const { fields, prospectSaved, phoneE164 } = state();
    const email = fields.email?.trim() ?? '';
    const named = (name?: string) => (name?.trim().length ?? 0) >= 2;
    const campaign = ctx.getState().campaign;
    if (prospectSaved || prospecting || !campaign || !validEmail(email)) return;
    if (!named(fields.first_name) || !named(fields.last_name)) return;
    prospecting = true;
    const phone = phoneE164 ?? (fields.phone_number?.trim() || undefined);
    try {
      const saved = await ctx.api.createCart({
        lines: cart.lines(),
        user: {
          email,
          first_name: fields.first_name!.trim(),
          last_name: fields.last_name!.trim(),
          language: LANGUAGE,
          ...(phone && { phone_number: phone }),
          accepts_marketing: fields.accepts_marketing !== 'false',
        },
        currency: campaign.currency,
        attribution: ctx.attribution(),
      });
      set({ prospectSaved: true });
      ctx.emit('prospect.saved', { cart: saved, email, phone });
    } catch (err) {
      ctx.fail('prospect', err);
    } finally {
      prospecting = false;
    }
  };

  const shippingComplete = () => {
    const { fields, rules } = state();
    const stateRequired = rules[fields.country ?? '']?.fields.state?.required;
    return !!fields.line1?.trim() && !!fields.city?.trim() && (!stateRequired || !!fields.state);
  };

  const verify = async (name: 'phone_number' | 'postcode', timeoutMs?: number): Promise<void> => {
    const { fields } = state();
    const value = fields[name]?.trim();
    if (!fields.country || !value) return;
    const sent: Record<string, string> =
      name === 'postcode' ? { postcode: value, ...(fields.state && { state: fields.state }) } : { [name]: value };
    try {
      const result = (await rulesApi.validate(fields.country, sent, timeoutMs))[name];
      if (state().fields[name]?.trim() !== value || !result) return;
      if (name === 'phone_number' && result.valid && result.value) set({ phoneE164: result.value });
      if (result.error && !state().errors[name]) {
        set({ errors: { ...state().errors, [name]: { ...result.error, warning: true } } });
      }
    } catch {}
  };

  const showErrors = (errors: Record<string, string>) =>
    Object.fromEntries(Object.entries(errors).map(([name, code]) => [name, { code } as CheckoutError]));

  return {
    begin(): void {
      if (cart.lines().length) emitOnce('checkout.started', { lines: cart.lines() });
    },

    setField(name: string, value: string): void {
      if (state().status === 'placed' || state().fields[name] === value) return;
      const { [name]: _, ...errors } = state().errors;
      const country = (name === 'country' || name === 'billing_country') && !!state().fields[name];
      set({
        fields: { ...state().fields, [name]: value, ...(country && { [name.replace('country', 'state')]: '' }) },
        errors,
        ...(name === 'phone_number' && { phoneE164: undefined }),
      });
      if (name === 'country' || name === 'billing_country') void loadCountry(value);
      if (once.has('checkout.started') && shippingComplete()) emitOnce('checkout.shipping-added', { tier: tier() });
    },

    async leave(name: string): Promise<void> {
      const { fields, rules } = state();
      const country = name.startsWith('billing_') ? fields.billing_country : fields.country;
      const code = fieldError(name, fields[name] ?? '', false, rules[country ?? '']);
      if (code) set({ errors: { ...state().errors, [name]: { code } } });
      if (name === 'phone_number') await verify('phone_number');
      if (name === 'postcode' || name === 'state') await verify('postcode');
      await saveProspect();
    },

    setSameAsShipping(same: boolean): void {
      if (same === state().sameAsShipping) return;
      set({ sameAsShipping: same });
      if (!same && !state().fields.billing_country && state().fields.country) {
        set({ fields: { ...state().fields, billing_country: state().fields.country! } });
      }
    },

    setPaymentMethod(word: string): void {
      const { form: _, ...errors } = state().errors;
      set({ paymentMethod: paymentCode(word), errors });
    },

    setStep(step: number): void {
      set({ step });
    },

    validate(scope: Scope, phoneRequired = false): boolean {
      const errors = formErrors(state(), scope, phoneRequired);
      set({ errors: showErrors(errors) });
      return !Object.keys(errors).length;
    },

    paymentReady(method: string): void {
      emitOnce('checkout.payment-added', { method: paymentCode(method) });
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
        ctx.fail('countries', err);
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
      country ??= listed('US') ?? countries[0]?.code;
      if (country && country !== state().fields.country) set({ fields: { ...state().fields, country } });
      if (country) await loadCountry(country);
    },

    async placeOrder(input: PlaceOrder): Promise<Order | undefined> {
      if (state().status !== 'idle') return undefined;
      const method = input.method ? paymentCode(input.method) : state().paymentMethod;
      const express = EXPRESS_METHODS.includes(method);
      set({ status: 'placing' });
      cart.freeze(true);
      const stop = (errors: Record<string, CheckoutError>) => {
        set({ status: 'idle', errors });
        cart.freeze(false);
        return undefined;
      };

      const invalid = formErrors(state(), express ? 'express' : 'all', input.phoneRequired);
      if (Object.keys(invalid).length) return stop(showErrors(invalid));
      if (!cart.lines().length) return stop({ form: { code: 'empty_cart' } });
      await cart.settled();
      if (!express && !state().phoneE164) await verify('phone_number', 2000);
      if (method !== 'card_token') emitOnce('checkout.payment-added', { method });

      let token: string | undefined;
      if (method === 'card_token') {
        try {
          if (!input.tokenize) throw new Error('no card form');
          token = await input.tokenize();
        } catch (err) {
          return stop({ form: { code: 'card', message: err instanceof Error ? err.message : undefined } });
        }
      }

      try {
        const order = await ctx.api.createOrder(
          orderBody(ctx.getState(), {
            method,
            token,
            lines: cart.lines(),
            vouchers: cart.vouchers(),
            attribution: ctx.attribution(),
            urls: input,
          }),
        );
        ctx.emit('order.placed', { order });
        if (order.payment_complete_url) set({ status: 'placed' });
        else {
          cart.clearAfterOrder();
          set({ ...emptyCheckout(), status: 'placed' }, { silent: true });
        }
        return order;
      } catch (err) {
        ctx.fail('order', err);
        return stop({ form: orderError(err) });
      }
    },
  };
}

export type CheckoutActions = ReturnType<typeof createCheckout>;
