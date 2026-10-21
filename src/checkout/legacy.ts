import type { Engine } from '../engine/engine';

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

/** @deprecated `os-checkout-field`. Use `data-next-checkout-field`. */
export const FIELD_ATTRS = ['data-next-checkout-field', 'os-checkout-field'];

/** @deprecated `os-checkout-step`. Use `data-next-checkout-step`. */
export const stepUrlOf = (form: Element) =>
  form.getAttribute('data-next-checkout-step') ?? form.getAttribute('os-checkout-step');

/** @deprecated `os-checkout-element` / `os-checkout-component`. Use `data-next-component`. */
export const component = (name: string) =>
  `[data-next-component="${name}"], [os-checkout-element="${name}"], [os-checkout-component="${name}"]`;

interface LegacyConfig {
  addressConfig?: { countries?: Array<{ code: string }>; dontShowStates?: string[]; enableAutocomplete?: boolean };
  paymentConfig?: { expressCheckout?: { methodOrder?: string[] } };
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

/** @deprecated `next:prospect-cart-created` on the form. Use `next.on('prospect.saved')`. */
export function announceProspect(engine: Engine, form: HTMLFormElement): void {
  engine.on('prospect.saved', ({ data }) => {
    const cart = (data.cart ?? {}) as Record<string, unknown>;
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
