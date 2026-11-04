import type { Engine } from '../engine/engine';
import type { Checkout, EventMap } from '../engine/events';
import type { State } from '../engine/types';
import type { Scope } from '../checkout/state/rules';
import type { AddressSuggestion } from '../checkout/state/types';
import { addLegacyEvents, type From, legacyEvent, legacyFire } from './legacy';

/** @deprecated Page field names. Use the API names: `first_name`, `last_name`, `line1`, `line2`, `state`, `postcode`, `phone_number`. */
export const LEGACY_FIELDS: Record<string, string> = {
  fname: 'first_name',
  lname: 'last_name',
  address1: 'line1',
  address2: 'line2',
  province: 'state',
  postal: 'postcode',
  phone: 'phone_number',
};

const API_TO_LEGACY = Object.fromEntries(Object.entries(LEGACY_FIELDS).map(([page, api]) => [api, page]));

/** @deprecated The page name of an API field (`line1` → `address1`). Fields built by `data-next-address` keep 0.4.x names, which page CSS selects. */
export const pageFieldName = (name: string) => API_TO_LEGACY[name] ?? name;

/** @deprecated `os-checkout-field`. Use `data-next-checkout-field`. */
export const FIELD_ATTRS = ['data-next-checkout-field', 'os-checkout-field'];

/** @deprecated `os-checkout-submit`. Use `data-next-checkout-submit`. */
export const SUBMIT_ATTRS = ['data-next-checkout-submit', 'os-checkout-submit'];

/** @deprecated `<meta name="os-failure-url">`. Use `next-failure-url`. */
export const FAILURE_URL_META = ['next-failure-url', 'os-failure-url'];

/** @deprecated `<meta name="next-next-url">` / `os-next-page`. Use `next-success-url`. */
export const SUCCESS_URL_META = ['next-success-url', 'next-next-url', 'os-next-page'];

/** @deprecated `os-checkout-step`. Use `data-next-checkout-step`. */
export const stepUrlOf = (form: Element) =>
  form.getAttribute('data-next-checkout-step') ?? form.getAttribute('os-checkout-step');

/** @deprecated `os-checkout-element` / `os-checkout-component`. Use `data-next-component`. */
export const component = (name: string) =>
  `[data-next-component="${name}"], [os-checkout-element="${name}"], [os-checkout-component="${name}"]`;

interface LegacyConfig {
  addressConfig?: { countries?: Array<{ code: string }>; dontShowStates?: string[]; enableAutocomplete?: boolean };
  paymentConfig?: {
    expressCheckout?: { methodOrder?: string[]; requireValidation?: boolean; requiredFields?: string[] };
  };
}

const config = () => (window as unknown as { nextConfig?: LegacyConfig }).nextConfig ?? {};

/** @deprecated `nextConfig.addressConfig.countries`. The campaign's shipping countries are used. */
export const legacyCountries = () => (config().addressConfig?.countries ?? []).map((c) => c.code);

/** @deprecated `nextConfig.addressConfig.dontShowStates`. */
export const legacyHiddenStates = () => config().addressConfig?.dontShowStates ?? [];

/** @deprecated `nextConfig.addressConfig.enableAutocomplete`, the NextCommerce address lookup. */
export const legacyAutocomplete = () => config().addressConfig?.enableAutocomplete === true;

/** @deprecated `nextConfig.paymentConfig.expressCheckout.methodOrder`. The campaign's order is used. */
export const legacyExpressOrder = () =>
  config().paymentConfig?.expressCheckout?.methodOrder?.map((m) => m.toLowerCase().replace(/-/g, '_'));

/**
 * @deprecated `nextConfig.paymentConfig.expressCheckout.requireValidation` and `requiredFields`: with
 * `requireValidation`, an express button checks the listed fields (page or API names) first, or the whole form
 * when none are listed. Without it, the wallet's details are enough.
 */
export function legacyExpressChecks(): Scope | undefined {
  const express = config().paymentConfig?.expressCheckout;
  if (!express?.requireValidation) return undefined;
  return express.requiredFields?.map((name) => LEGACY_FIELDS[name] ?? name) ?? 'all';
}

/**
 * @deprecated 0.4.x `checkout:started` came on every checkout page load with a cart; `checkout.started` comes once
 * per checkout. `bindCheckout(engine, form, { legacyCheckoutStarted })` calls it with the Checkout once a page, when
 * the page opens the checkout: right after `checkout.started` on the page that starts it, and on each later page of
 * the same checkout. `checkout:started` maps to this, not to `checkout.started`, or the first page gets it twice.
 */
export type LegacyCheckoutStarted = (checkout: Checkout) => void;

/** @deprecated See {@link LegacyCheckoutStarted}. A listener that throws is logged and leaves the checkout bound. */
export const legacyStartedEachPage =
  (engine: Engine, fn: LegacyCheckoutStarted) =>
  (checkout: Checkout): void => {
    try {
      fn(checkout);
    } catch (err) {
      engine.log.error('a checkout:started listener failed', err);
    }
  };

const GUARD_KEY = 'next-checkout-store';

/** @deprecated The shop-three-step page guard reads `sessionStorage['next-checkout-store']` in the 0.4.x shape. */
export function writeStepGuard(engine: Engine): void {
  const { checkout, cart } = engine.getState();
  if (!checkout) return;
  const formData = Object.fromEntries(
    Object.entries(checkout.fields).map(([name, value]) => [API_TO_LEGACY[name] ?? name, value]),
  );
  const state = { step: checkout.step, formData, shippingMethod: cart.shippingId && { id: cart.shippingId } };
  try {
    sessionStorage.setItem(GUARD_KEY, JSON.stringify({ state, version: 0 }));
  } catch {}
}

/** @deprecated See {@link writeStepGuard}. */
export function clearStepGuard(): void {
  try {
    sessionStorage.removeItem(GUARD_KEY);
  } catch {}
}

const UNREAD: Record<string, string> = {
  'data-prospect-config': 'set data-next-lead instead',
  'data-min-phone-digits': 'the address service checks the phone number',
  'data-email-field': 'mark the input with data-next-checkout-field',
  'data-phone-field': 'mark the input with data-next-checkout-field',
};

const TRIGGERS: Record<string, 'email' | 'phone' | 'email+phone' | 'off' | 'formStart'> = {
  emailEntry: 'email',
  phoneEntry: 'phone',
  emailAndPhone: 'email+phone',
  manual: 'off',
  formStart: 'formStart',
};

/**
 * @deprecated 0.4.x lead options on the checkout form. `data-trigger-on` and
 * `data-auto-create="false"` become `data-next-lead`; the rest are no longer read, and say so.
 */
export function legacyLead(engine: Engine, form: HTMLFormElement) {
  for (const [name, instead] of Object.entries(UNREAD)) {
    if (form.hasAttribute(name)) engine.log.warn(`${name} on the checkout form is no longer read; ${instead}`);
  }
  const trigger = form.getAttribute('data-trigger-on');
  if (trigger !== null) {
    const lead = TRIGGERS[trigger];
    if (!lead) engine.log.warn(`data-trigger-on="${trigger}" is not one of ${Object.keys(TRIGGERS).join(', ')}`);
    else engine.log.info(`data-trigger-on="${trigger}" is deprecated: use data-next-lead`);
    if (lead) return lead;
  }
  if (form.getAttribute('data-auto-create') === 'false') {
    engine.log.info('data-auto-create="false" is deprecated: use data-next-lead="off"');
    return 'off';
  }
  return undefined;
}

/** @deprecated `next:prospect-cart-created` on the form. Use `next.on('user.created')`. */
export function announceProspect(engine: Engine, form: HTMLFormElement): void {
  engine.on('user.created', ({ data }) => {
    const cart = (engine.getState().checkout?.openCart ?? {}) as Record<string, unknown>;
    const prospectCart = {
      id: cart.id,
      prospect_id: cart.checkout_url,
      created_at: cart.created_at,
      expires_at: cart.expires_at,
      email: data.email,
      ...(data.phone && { phone: data.phone }),
    };
    form.dispatchEvent(
      new CustomEvent('next:prospect-cart-created', { bubbles: true, detail: { cart, prospectCart } }),
    );
  });
}

const EXPRESS = ['paypal', 'apple_pay', 'google_pay', 'shop_pay', 'link'];
/** A wallet button, not the method picked on the form. */
const express = (method: string | undefined, { checkout }: State) =>
  !!method && EXPRESS.includes(method) && method !== checkout?.paymentMethod;
type Placed = From<'payment.redirected' | 'order.created'>;
const placedWith = (e: Placed) => (e.name === 'payment.redirected' ? e.data.method : e.data.payment_method);
const expressPlaced = (data: (e: Placed) => unknown) =>
  legacyEvent<Placed['name']>({
    from: ['payment.redirected', 'order.created'],
    when: (e, state) => express(placedWith(e), state),
    data,
  });
const expressFailed = legacyEvent({
  from: ['checkout.failed'],
  when: ({ data }, state) => express(data.payment_method, state),
  data: ({ data }) => ({ method: data.payment_method, error: data.error.message ?? data.error.code }),
});
const formError = (e: EventMap['checkout.submitted']) => e.errors.form?.code;

const ORDER_FAILED = 'Failed to process order. Please try again.';
const CARD_FAILED = 'Please check your card details and try again.';

const CHECKOUT_EVENTS = {
  'payment:tokenized': legacyEvent({
    from: ['checkout.submitted'],
    when: (e) => e.data.valid && e.data.payment_method === 'card_token',
    data: () => ({ paymentMethod: 'credit-card' }),
  }),
  'payment:error': legacyEvent({
    from: ['checkout.failed', 'checkout.submitted'],
    when: (e) => e.name === 'checkout.failed' || formError(e.data) === 'card',
    data: (e) => {
      if (e.name === 'checkout.submitted') return { message: e.data.errors.form?.message || CARD_FAILED };
      const { error } = e.data;
      const shown = (error.code === 'declined' || error.code === 'rejected') && error.message;
      return {
        message: shown || ORDER_FAILED,
        ...(error.decline_code && { code: error.decline_code }),
        details: error,
      };
    },
  }),
  'express-checkout:started': legacyEvent({
    from: ['checkout.submitted'],
    when: ({ data }, state) => data.valid && express(data.payment_method, state),
    data: ({ data }) => ({ method: data.payment_method, itemCount: data.cart.lines.length }),
  }),
  'express-checkout:error': legacyEvent({
    from: ['checkout.submitted'],
    when: ({ data }, state) => formError(data) === 'empty_cart' && express(data.payment_method, state),
    data: ({ data }) => ({ method: data.payment_method, error: 'Cart is empty' }),
  }),
  'checkout:express-completed': expressPlaced((e) => ({ method: placedWith(e), success: true })),
  'express-checkout:completed': expressPlaced((e) => ({
    method: placedWith(e),
    order: e.name === 'payment.redirected' ? { ref_id: e.data.ref_id, payment_complete_url: e.data.url } : e.data,
  })),
  'checkout:express-failed': expressFailed,
  'express-checkout:failed': expressFailed,
};

const formFieldName = (name: string) =>
  name.startsWith('billing_') ? `billing_${pageFieldName(name.slice(8))}` : pageFieldName(name);

/** 0.4.x `CheckoutData`: the form under 0.4.x field names. */
const checkoutData = (checkout: Checkout, state: State) => ({
  formData: Object.fromEntries(Object.entries(state.checkout?.fields ?? {}).map(([n, v]) => [formFieldName(n), v])),
  paymentMethod:
    !checkout.payment_method || checkout.payment_method === 'card_token' ? 'credit-card' : checkout.payment_method,
  isProcessing: false,
  step: checkout.step ?? 1,
});

/** Calls `fn` once `el`'s `attribute` changes and `done` says so. */
function whenChanged(el: Element, attribute: string, done: () => boolean, fn: () => void): void {
  const observer = new MutationObserver(() => {
    if (!done()) return;
    observer.disconnect();
    fn();
  });
  observer.observe(el, { attributeFilter: [attribute] });
}

const LOCATIONS = [
  ['[data-next-component="location"], [data-next-component-location="location"]', 'checkout:location-fields-shown'],
  ['[data-next-component="billing-location"]', 'checkout:billing-location-fields-shown'],
] as const;

const engines = new WeakMap<HTMLFormElement, Engine>();

/** @deprecated 0.4.x `address:autocomplete-filled`, once a suggestion filled the address. */
export function legacyAddressFilled(input: HTMLElement, type: 'shipping' | 'billing', components: AddressSuggestion) {
  const form = input.closest('form');
  const engine = form && engines.get(form);
  if (engine) legacyFire(engine, 'address:autocomplete-filled', { type, components });
}

/**
 * @deprecated The checkout's 0.4.x `next.on` names: payment and wallet events, and the page moments 0.4.x sent:
 * `checkout:form-initialized`, `express-checkout:initialized`, `checkout:payment-ready` once the card fields load,
 * `checkout:location-fields-shown` when the address reveals them, and `address:fields-rendered` per address block.
 */
export function legacyCheckoutEvents(engine: Engine, form: HTMLFormElement): void {
  addLegacyEvents(CHECKOUT_EVENTS, { 'checkout:started': checkoutData });
  engines.set(form, engine);
  const fire = (name: string, data: object, keep?: boolean) => legacyFire(engine, name, data, keep);
  fire('checkout:form-initialized', { form });
  for (const button of document.querySelectorAll<HTMLElement>('button[data-next-express-checkout]'))
    fire('express-checkout:initialized', {
      method: button.getAttribute('data-next-express-checkout'),
      element: button,
    });

  const loading = 'next-loading-spreedly';
  if (form.classList.contains(loading))
    whenChanged(
      form,
      'class',
      () => !form.classList.contains(loading),
      () => {
        if (!('NextPayment' in window)) return;
        fire('checkout:payment-ready', {}, true);
        fire('checkout:spreedly-ready', {}, true);
      },
    );

  for (const [selector, name] of LOCATIONS) {
    let shown = false;
    for (const box of form.querySelectorAll(selector))
      whenChanged(
        box,
        'class',
        () => !box.classList.contains('next-location-hidden'),
        () => {
          if (shown) return;
          shown = true;
          fire(name, {});
          form.dispatchEvent(new CustomEvent(name));
        },
      );
  }

  for (const block of form.querySelectorAll<HTMLElement>('[data-next-address]')) {
    const billing = block.getAttribute('data-next-address') === 'billing';
    new MutationObserver(() => {
      if (block.getAttribute('data-next-address-state') !== 'ready') return;
      const fields = engine.getState().checkout?.fields ?? {};
      fire('address:fields-rendered', {
        form: billing ? 'billing' : 'shipping',
        country: (billing && fields.billing_country) || fields.country,
        fields: [...block.querySelectorAll('[data-next-address-field]')].map((f) =>
          f.getAttribute('data-next-address-field'),
        ),
      });
    }).observe(block, { attributeFilter: ['data-next-address-state'] });
  }
}
