import type { CartActions } from '../../engine/cart/cart';
import type { Context } from '../../engine/engine';
import { newId } from '../../engine/runtime/id';
import { createContact, type Lead } from './contact';
import { createCountries } from './countries';
import { publicAddress } from './order-body';
import { paymentCode } from '../../engine/order/payment';
import { createPlaceOrder, type PlaceOrder } from './place-order';
import { asciiDigits, countryOf, createPhoneReads, PHONES, phoneChecked, phoneFieldOf, phoneKey } from './phone';
import { addressValid, fieldError, formErrors, postcodeChecked, type RulesApi, type Scope } from './rules';
import type { Address, AddressType, Checkout } from '../../engine/events/checkout';
import type { AddressSuggestion, ApiOrder, CheckoutError } from '../../engine/types';
import type { CheckoutState, FieldError } from './types';

export interface CheckoutActions {
  placeOrder(input: PlaceOrder): Promise<ApiOrder | undefined>;
  begin(): void;
  reported(name: string): boolean;
  markReported(name: string): void;
  setField(name: string, value: string): void;
  leave(name: string): Promise<void>;
  readPhone(name: string): Promise<void>;
  writePhone(name: string): void;
  setSameAsShipping(same: boolean): void;
  setPaymentMethod(word: string): void;
  setStep(step: number, page?: string): void;
  nextStep(phoneRequired?: boolean): boolean;
  problems(scope?: Scope): Record<string, FieldError>;
  validate(scope: Scope, phoneRequired?: boolean): boolean;
  autofill(type: AddressType, suggestion: AddressSuggestion): void;
  paymentReady(): void;
  suggestAddresses(query: string, country: string, signal?: AbortSignal): Promise<AddressSuggestion[]>;
  loadCountries(allowed?: string[]): Promise<void>;
}

declare module '../../engine/engine' {
  interface Engine {
    checkout?: CheckoutActions;
  }
}

/** The checkout fields a reload restores. */
const SAVED = [
  'fields',
  'phones',
  'sameAsShipping',
  'paymentMethod',
  'step',
  'steps',
  'prospectSaved',
  'user',
  'shippingAddress',
  'billingAddress',
  'pendingRef',
  'pendingMethod',
  'id',
  'reported',
] as const satisfies ReadonlyArray<keyof CheckoutState>;

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

const isCountry = (name: string) => name === 'country' || name === 'billing_country';

/** The checkout once `name` is `value`: a new country empties its state and forgets the phone read against the old one. */
function withField({ fields, phones, errors }: CheckoutState, name: string, value: string): Partial<CheckoutState> {
  const country = isCountry(name);
  const phone = country ? phoneFieldOf(name) : name;
  const forget =
    country || (PHONES.includes(name) && phoneKey(fields[name] ?? '') !== phoneKey(value)) ? phone : undefined;
  const { [name]: _, ...kept } = errors;
  if (country && kept[phone]?.warning) delete kept[phone];
  const { [forget ?? '']: __, ...read } = phones;
  return {
    fields: { ...fields, [name]: value, ...(country && !!fields[name] && { [name.replace('country', 'state')]: '' }) },
    errors: kept,
    phones: read,
  };
}

const asErrors = (errors: Record<string, string>) =>
  Object.fromEntries(Object.entries(errors).map(([name, code]) => [name, { code } as CheckoutError]));

export function createCheckout(
  ctx: Context,
  cart: CartActions,
  rulesApi: RulesApi,
  { lead = 'email', opened }: { lead?: Lead; opened?: (checkout: Checkout) => void } = {},
): CheckoutActions {
  const state = () => ctx.getState().checkout!;
  const set = (patch: Partial<CheckoutState>, options?: { silent?: boolean }) => ctx.update('checkout', patch, options);
  let bound = false;
  let open = false;

  ctx.persist('checkout', (checkout) => Object.fromEntries(SAVED.map((k) => [k, checkout[k]])));
  set({ ...emptyCheckout(), ...ctx.saved<Partial<CheckoutState>>('checkout'), status: 'idle', errors: {} });

  const saveContact = createContact(ctx, cart, lead, () => open);
  const { loadCountry, loadCountries } = createCountries(ctx, rulesApi);
  const readPhone = createPhoneReads(rulesApi);

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

  const checkPhone = async (name: string, warn = false): Promise<void> => {
    const country = countryOf(state().fields, name);
    const typed = asciiDigits(state().fields[name]?.trim() ?? '');
    if (!country || !typed) return;
    const patch = phoneChecked(state(), name, country, typed, await readPhone(country, typed), warn);
    if (patch) set(patch);
  };

  const validate = (scope: Scope, phoneRequired = false): boolean => {
    const errors = formErrors(state(), scope, phoneRequired);
    set({ errors: asErrors(errors) });
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

  return {
    placeOrder: createPlaceOrder(ctx, cart, {
      checkPhone,
      showErrors: asErrors,
      invalid,
      reset: () => set({ ...emptyCheckout(), status: 'placed' }, { silent: true }),
    }),
    begin() {
      bound = true;
      start();
    },
    reported: (name) => !!state().reported?.includes(name),
    markReported(name) {
      const reported = state().reported ?? [];
      if (!reported.includes(name)) set({ reported: [...reported, name] }, { silent: true });
    },
    setField(name, value) {
      if (state().status === 'placed' || state().fields[name] === value) return;
      set(withField(state(), name, value));
      if (isCountry(name))
        void loadCountry(value).then(() => checkPhone(phoneFieldOf(name), true).then(announceAddresses));
    },
    async leave(name) {
      const { fields, rules } = state();
      const code = fieldError(name, fields[name] ?? '', false, rules[countryOf(fields, name) ?? '']);
      if (code) set({ errors: { ...state().errors, [name]: { code } } });
      if (PHONES.includes(name)) await checkPhone(name, true);
      if (name === 'postcode' || name === 'state') await verifyPostcode();
      announceAddresses();
      await saveContact();
    },
    readPhone: (name) => checkPhone(name),
    writePhone(name) {
      const { fields, phones } = state();
      const read = phones[name];
      const written = read && (read.country === countryOf(fields, name) ? read.national : read.international);
      if (written && written !== fields[name]) set({ fields: { ...fields, [name]: written } });
    },
    setSameAsShipping(same) {
      if (same === state().sameAsShipping) return;
      set({ sameAsShipping: same });
      if (!same && !state().fields.billing_country && state().fields.country) {
        set({ fields: { ...state().fields, billing_country: state().fields.country! } });
      }
      announceAddresses();
    },
    setPaymentMethod(word) {
      const { form: _, ...errors } = state().errors;
      const method = paymentCode(word);
      const changed = method !== state().paymentMethod;
      set({ paymentMethod: method, errors });
      if (changed && open) ctx.emit('payment.selected', { method });
    },
    setStep(step, page) {
      set({ step, ...(page !== undefined && { steps: { ...state().steps, [page]: step } }) });
    },
    nextStep(phoneRequired = false) {
      if (!validate('shipping', phoneRequired)) {
        invalid(state().errors);
        return false;
      }
      ctx.emit('checkout.continued', cart.currentCheckout());
      set({ step: (state().step || 1) + 1 });
      return true;
    },
    problems: (scope = 'all') => formErrors(state(), scope),
    validate,
    autofill(type, { address }) {
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
    paymentReady() {
      if (!state().cardReady) set({ cardReady: true });
    },
    async suggestAddresses(query, country, signal) {
      try {
        return (await ctx.api.autocomplete(query, country, signal)).results ?? [];
      } catch (err) {
        if (!signal?.aborted) ctx.fail('address.suggest', err);
        return [];
      }
    },
    loadCountries,
  };
}
