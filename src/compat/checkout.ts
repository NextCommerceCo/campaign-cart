import type { Engine } from '../engine/engine';
import type { EventMap } from '../engine/events/bus';
import type { Checkout } from '../engine/events/checkout';
import type { State } from '../engine/types';
import type { Scope } from '../checkout/state/rules';
import type { CheckoutHooks } from '../checkout/hooks';
import { PAGE_FIELDS, pageFieldName, pageName } from '../checkout/form/names';
import { addLegacyEvents, type From, legacyEvent, legacyFire } from './legacy/registry';
import { nextConfig as config } from './legacy/globals';
import { paymentCode } from '../engine/payment';

/** @deprecated `nextConfig.addressConfig.countries`. The campaign's shipping countries are used. */
const legacyCountries = () => (config().addressConfig?.countries ?? []).map((c) => c.code);

/** @deprecated `nextConfig.addressConfig.dontShowStates`. */
const legacyHiddenStates = () => config().addressConfig?.dontShowStates ?? [];

/** @deprecated `nextConfig.addressConfig.enableAutocomplete`, the NextCommerce address lookup. */
const legacyAutocomplete = () => config().addressConfig?.enableAutocomplete === true;

/** @deprecated `nextConfig.paymentConfig.expressCheckout.methodOrder`. The campaign's order is used. */
const legacyExpressOrder = () => config().paymentConfig?.expressCheckout?.methodOrder?.map(paymentCode);

/**
 * @deprecated `nextConfig.paymentConfig.expressCheckout.requireValidation` and `requiredFields`, for PayPal, Apple
 * Pay or Google Pay picked in the form (an express button never checks the form, as in 0.4.x): `true` checks the
 * listed fields (page or API names), or the whole form when none are listed; `false` checks nothing.
 */
function legacyWalletChecks(): Scope | null | undefined {
  const express = config().paymentConfig?.expressCheckout;
  if (!express?.requireValidation) return express?.requireValidation === false ? null : undefined;
  return express.requiredFields?.map((name) => PAGE_FIELDS[name] ?? name) ?? 'all';
}

/**
 * @deprecated 0.4.x `checkout:started` came on every checkout page load with a cart; `checkout.started` comes once
 * per checkout. `bindCheckout(engine, form, { legacyCheckoutStarted })` calls it with the Checkout once a page, when
 * the page opens the checkout: right after `checkout.started` on the page that starts it, and on each later page of
 * the same checkout. `checkout:started` maps to this, not to `checkout.started`, or the first page gets it twice.
 */
type LegacyCheckoutStarted = (checkout: Checkout) => void;

/** @deprecated See {@link LegacyCheckoutStarted}. A listener that throws is logged and leaves the checkout bound. */
const legacyStartedEachPage =
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
function writeStepGuard(engine: Engine): void {
  const { checkout, cart } = engine.getState();
  if (!checkout) return;
  const formData = Object.fromEntries(Object.entries(checkout.fields).map(([n, v]) => [pageName(n), v]));
  const state = { step: checkout.step, formData, shippingMethod: cart.shippingId && { id: cart.shippingId } };
  try {
    sessionStorage.setItem(GUARD_KEY, JSON.stringify({ state, version: 0 }));
  } catch {}
}

/** @deprecated See {@link writeStepGuard}. */
function clearStepGuard(): void {
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
function legacyLead(engine: Engine, form: HTMLFormElement) {
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
function announceProspect(engine: Engine, form: HTMLFormElement): void {
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

const express = ({ checkout }: State) => !!checkout?.express;
type Placed = From<'payment.redirected' | 'order.created'>;
const placedWith = (e: Placed) => (e.name === 'payment.redirected' ? e.data.method : e.data.payment_method);
const expressPlaced = (data: (e: Placed) => unknown) =>
  legacyEvent<Placed['name']>({
    from: ['payment.redirected', 'order.created'],
    when: (e, state) => express(state) && (e.name === 'payment.redirected' || e.data.paid),
    data,
  });
type Failed = From<'checkout.failed' | 'payment.failed'>;
/** A declined card on the checkout is `payment.failed` without a `ref_id`; 0.4.x reported it with the other order failures. */
const orderFailed = (e: Failed) => e.name === 'checkout.failed' || (!e.data.ref_id && e.data.error.code === 'declined');
const expressFailed = legacyEvent<Failed['name']>({
  from: ['checkout.failed', 'payment.failed'],
  when: (e, state) => orderFailed(e) && express(state),
  data: (e) => ({
    method: e.name === 'payment.failed' ? e.data.method : e.data.payment_method,
    error: e.data.error.message ?? e.data.error.code,
  }),
});
const formError = (e: EventMap['checkout.invalid']) => e.errors.form?.code;

const ORDER_FAILED = 'Failed to process order. Please try again.';
const CARD_FAILED = 'Please check your card details and try again.';

/** 0.4.x `payment:tokenized` carried the card token and its details; they stay out of events, which the page is told once. */
const tokenized = (engine: Engine) => {
  let told = false;
  return legacyEvent({
    from: ['checkout.submitted'],
    when: (e) => e.data.payment_method === 'card_token',
    data: () => {
      if (!told) engine.log.warn('next.on: "payment:tokenized" no longer sends token and pmData');
      told = true;
      return { paymentMethod: 'credit-card' };
    },
  });
};

const CHECKOUT_EVENTS = {
  'payment:error': legacyEvent({
    from: ['checkout.failed', 'payment.failed', 'checkout.invalid'],
    when: (e) => (e.name === 'checkout.invalid' ? formError(e.data) === 'card' : orderFailed(e)),
    data: (e) => {
      if (e.name === 'checkout.invalid') return { message: e.data.errors.form?.message || CARD_FAILED };
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
    when: (_, state) => express(state),
    data: ({ data }) => ({ method: data.payment_method, itemCount: data.cart.lines.length }),
  }),
  'express-checkout:error': legacyEvent({
    from: ['checkout.invalid'],
    when: ({ data }, state) => formError(data) === 'empty_cart' && express(state),
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

/** 0.4.x `CheckoutData`: the form under 0.4.x field names. */
const checkoutData = (checkout: Checkout, state: State) => ({
  formData: Object.fromEntries(Object.entries(state.checkout?.fields ?? {}).map(([n, v]) => [pageFieldName(n), v])),
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

/**
 * @deprecated The checkout's 0.4.x `next.on` names: payment and wallet events, and the page moments 0.4.x sent:
 * `checkout:form-initialized`, `express-checkout:initialized`, `checkout:payment-ready` once the card fields load,
 * `checkout:location-fields-shown` when the address reveals them, and `address:fields-rendered` per address block.
 */
export function legacyCheckoutEvents(engine: Engine, form: HTMLFormElement): void {
  addLegacyEvents(
    engine,
    { ...CHECKOUT_EVENTS, 'payment:tokenized': tokenized(engine) },
    { 'checkout:started': checkoutData },
  );
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

/** @deprecated The checkout's 0.4.x options, attributes and events, as the hooks `bindCheckout` calls. */
export const legacyCheckout = (
  engine: Engine,
  form: HTMLFormElement,
  started?: LegacyCheckoutStarted,
): CheckoutHooks => ({
  lead: () => legacyLead(engine, form),
  countries: legacyCountries,
  hiddenStates: legacyHiddenStates,
  autocomplete: legacyAutocomplete,
  addressFilled: (type, components) => legacyFire(engine, 'address:autocomplete-filled', { type, components }),
  expressOrder: legacyExpressOrder,
  walletChecks: legacyWalletChecks,
  opened: started && legacyStartedEachPage(engine, started),
  bound: () => {
    legacyCheckoutEvents(engine, form);
    announceProspect(engine, form);
  },
  advanced: () => writeStepGuard(engine),
  placed: clearStepGuard,
});
