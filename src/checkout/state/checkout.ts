import type { CartActions } from '../../engine/cart/cart';
import type { Context } from '../../engine/engine';
import { newId } from '../../engine/runtime/id';
import { createContact, type Lead } from './contact';
import { createCountries } from './countries';
import { announceAddresses, checkPhone, fieldActions } from './fields';
import { paymentCode } from '../../engine/order/payment';
import { createPlaceOrder, type PlaceOrder } from './place-order';
import { createPhoneReads } from './phone';
import { formErrors, type RulesApi, type Scope } from './rules';
import type { AddressType, Checkout } from '../../engine/events/checkout';
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

const asErrors = (errors: Record<string, string>) =>
  Object.fromEntries(Object.entries(errors).map(([name, code]) => [name, { code } as CheckoutError]));

const checkoutOf = (ctx: Context) => ctx.getState().checkout!;
const setCheckout = (ctx: Context, patch: Partial<CheckoutState>, options?: { silent?: boolean }) =>
  ctx.update('checkout', patch, options);

function validateForm(ctx: Context, scope: Scope, phoneRequired = false): boolean {
  const errors = formErrors(checkoutOf(ctx), scope, phoneRequired);
  setCheckout(ctx, { errors: asErrors(errors) });
  return !Object.keys(errors).length;
}

function choosePayment(ctx: Context, word: string, open: boolean): void {
  const { form: _, ...errors } = checkoutOf(ctx).errors;
  const method = paymentCode(word);
  const changed = method !== checkoutOf(ctx).paymentMethod;
  setCheckout(ctx, { paymentMethod: method, errors });
  if (changed && open) ctx.emit('payment.selected', { method });
}

async function addressSuggestions(
  ctx: Context,
  query: string,
  country: string,
  signal?: AbortSignal,
): Promise<AddressSuggestion[]> {
  try {
    return (await ctx.api.autocomplete(query, country, signal)).results ?? [];
  } catch (err) {
    if (!signal?.aborted) ctx.fail('address.suggest', err);
    return [];
  }
}

/** Sends `checkout.started` once per checkout id; a reload of a started checkout only calls `opened`. */
function startCheckout(ctx: Context, cart: CartActions, opened?: (checkout: Checkout) => void): void {
  if (checkoutOf(ctx).id) return opened?.(cart.currentCheckout());
  setCheckout(ctx, { id: newId() });
  const off = ctx.on('checkout.started', (e) => {
    off();
    opened?.(e.data);
  });
  ctx.emit('checkout.started', cart.currentCheckout());
}

export function createCheckout(
  ctx: Context,
  cart: CartActions,
  rulesApi: RulesApi,
  { lead = 'email', opened }: { lead?: Lead; opened?: (checkout: Checkout) => void } = {},
): CheckoutActions {
  const state = () => checkoutOf(ctx);
  const set = (patch: Partial<CheckoutState>, options?: { silent?: boolean }) => setCheckout(ctx, patch, options);
  let bound = false;
  let open = false;

  ctx.persist('checkout', (checkout) => Object.fromEntries(SAVED.map((k) => [k, checkout[k]])));
  set({ ...emptyCheckout(), ...ctx.saved<Partial<CheckoutState>>('checkout'), status: 'idle', errors: {} });

  const saveContact = createContact(ctx, cart, lead, () => open);
  const { loadCountry, loadCountries } = createCountries(ctx, rulesApi);
  const readPhone = createPhoneReads(rulesApi);
  const phone = (name: string, warn?: boolean) => checkPhone(ctx, readPhone, name, warn);
  const announce = () => {
    if (open) announceAddresses(ctx);
  };

  const start = () => {
    if (!bound || open || !cart.lines().length) return;
    open = true;
    startCheckout(ctx, cart, opened);
    announce();
    void saveContact();
  };
  ctx.on('cart.updated', start);

  const invalid = (errors: Record<string, CheckoutError>, method?: string) =>
    ctx.emit('checkout.invalid', { ...cart.currentCheckout(), ...(method && { payment_method: method }), errors });

  return {
    placeOrder: createPlaceOrder(ctx, cart, {
      checkPhone: phone,
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
    ...fieldActions(ctx, rulesApi, { isOpen: () => open, phone, announce, saveContact, loadCountry }),
    setPaymentMethod: (word) => choosePayment(ctx, word, open),
    setStep(step, page) {
      set({ step, ...(page !== undefined && { steps: { ...state().steps, [page]: step } }) });
    },
    nextStep(phoneRequired = false) {
      if (!validateForm(ctx, 'shipping', phoneRequired)) {
        invalid(state().errors);
        return false;
      }
      ctx.emit('checkout.continued', cart.currentCheckout());
      set({ step: (state().step || 1) + 1 });
      return true;
    },
    problems: (scope = 'all') => formErrors(state(), scope),
    validate: (scope, phoneRequired) => validateForm(ctx, scope, phoneRequired),
    paymentReady() {
      if (!state().cardReady) set({ cardReady: true });
    },
    suggestAddresses: (query, country, signal) => addressSuggestions(ctx, query, country, signal),
    loadCountries,
  };
}
