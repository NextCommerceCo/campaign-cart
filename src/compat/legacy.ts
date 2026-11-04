import type { Engine } from '../engine/engine';
import type { Logger } from '../engine/log';
import type { Line, CartLine } from '../engine/cart/types';
import type { EventName } from '../engine/events';
import type { Campaign, Package, ShippingOption, State } from '../engine/types';
import type { ExitIntentOptions } from './exit-intent';

/** @deprecated Use `data-next-selector-id`. */
export function legacySelectorId(el: Element): string | null {
  return el.getAttribute('data-next-id');
}

type Data = Record<string, unknown>;

export interface LegacyEvent {
  event: EventName;
  when?: (data: Data) => boolean;
  data?: (data: Data, state: State) => unknown;
}

const exitIntent = ({ image_url, template, action, coupon_code }: Data) => ({
  imageUrl: image_url,
  template,
  ...(action !== undefined && { action, couponCode: coupon_code }),
});
const cart: LegacyEvent = { event: 'cart.updated', data: (_, state) => state.cart };
const shipping: LegacyEvent = {
  event: 'shipping.selected',
  data: (d, state) => {
    const methodId = (d.shipping_method as { id: number } | undefined)?.id;
    const method = state.campaign?.shipping_methods.find((m) => m.ref_id === methodId);
    return { methodId, ...(method && { method: { ref_id: method.ref_id, code: method.code, price: method.price } }) };
  },
};
const exit = (event: EventName, when: (d: Data) => boolean = () => true): LegacyEvent => ({
  event,
  when: (d) => d.source === 'exit_intent' && when(d),
  data: exitIntent,
});
const submitted: LegacyEvent = { event: 'checkout.submitted', when: (d) => d.valid === true };
const selection = (toggle: boolean): LegacyEvent => ({
  event: 'selector.selected',
  when: (d) => (d.type === 'toggle') === toggle,
  data: (d) => ({
    selectorId: d.selector_id,
    cardId: d.option_id,
    items: (d.lines as Line[]).map((l) => ({ packageId: l.package_id, quantity: l.quantity })),
  }),
});

/** @deprecated 0.4.x `next.on` names. See the Campaign SDK event reference for the name each became. */
export const LEGACY_EVENTS: Record<string, LegacyEvent> = {
  'campaign:loaded': { event: 'campaign.loaded' },
  'sdk:url-parameters-processed': { event: 'sdk.ready' },
  'error:occurred': { event: 'sdk.error' },
  'action:failed': { event: 'sdk.error' },
  'cart:updated': cart,
  'cart:quantity-changed': cart,
  'cart:item-added': { event: 'cart.added' },
  'cart:item-removed': { event: 'cart.removed' },
  'coupon:applied': { event: 'coupon.applied' },
  'coupon:removed': { event: 'coupon.removed' },
  'coupon:validation-failed': { event: 'coupon.denied' },
  'bundle:selection-changed': selection(false),
  'selector:selection-changed': selection(false),
  'toggle:selection-changed': selection(true),
  'shipping:method-changed': shipping,
  'shipping:method-selected': shipping,
  'checkout:started': { event: 'checkout.started' },
  'checkout:payment-ready': submitted,
  'payment:tokenized': submitted,
  'order:completed': { event: 'order.created' },
  'checkout:express-completed': { event: 'order.created' },
  'express-checkout:completed': { event: 'order.created' },
  'payment:error': { event: 'order.failed' },
  'checkout:express-failed': { event: 'order.failed' },
  'express-checkout:failed': { event: 'order.failed' },
  'upsell:viewed': { event: 'upsell.viewed' },
  'upsell:accepted': { event: 'upsell.accepted' },
  'upsell:added': { event: 'upsell.accepted' },
  'upsell:skipped': { event: 'upsell.skipped' },
  'upsell:error': { event: 'upsell.failed' },
  'exit-intent:shown': exit('promotion.viewed'),
  'exit-intent:clicked': exit('promotion.clicked', (d) => !d.action),
  'exit-intent:action': exit('promotion.clicked', (d) => !!d.action),
  'exit-intent:dismissed': exit('promotion.closed', (d) => d.reason === 'dismissed'),
  'exit-intent:closed': exit('promotion.closed', (d) => d.reason === 'closed'),
};

/** @deprecated 0.4.x features the SDK no longer has. Starter templates still register empty listeners for them. */
export const RETIRED_EVENTS = ['fomo:', 'profile:'];

export interface LegacyCartLine {
  packageId: number;
  quantity: number;
  name?: string;
  image?: string;
  price?: string;
  total?: string;
}

export interface LegacyCartData {
  cartLines: LegacyCartLine[];
  items: LegacyCartLine[];
  cartTotals: { subtotal?: string; total?: string; discount?: string; currency?: string };
  campaignData?: Campaign;
  appliedCoupons: string[];
}

export interface LegacyApi {
  /** @deprecated Use `next.actions.addItem(packageId, quantity)`. */
  addItem(o: { packageId: number; quantity?: number }): Promise<void>;
  /** @deprecated Use `next.actions.clear()`. Keeps coupons, like the old SDK. */
  clearCart(): Promise<void>;
  /** @deprecated Use `next.actions.setGroup(id, { lines, vouchers })`. */
  swapCart(items: CartLine[]): Promise<void>;
  /** @deprecated Use `next.actions.applyCoupon(code)`. */
  applyCoupon(code: string): Promise<boolean>;
  /** @deprecated Use `next.getState().campaign.packages`. */
  getPackage(id: number): Package | undefined;
  /** @deprecated Use `next.getState().campaign`. */
  getCampaignData(): Campaign | undefined;
  /** @deprecated Use `next.getState().cart`. Returns the 0.4.x shape. */
  getCartData(): LegacyCartData;
  /** @deprecated Exit intent will move to the page kit. */
  exitIntent(options: ExitIntentOptions): Promise<() => void>;
  /** @deprecated Use `next.getState().campaign.shipping_methods`. */
  getShippingMethods(): ShippingOption[];
  /** @deprecated Use `next.actions.setShipping(id)`. */
  setShippingMethod(id: number): Promise<void>;
  /** @deprecated Use `next.getState().cart.shippingId`. */
  getSelectedShippingMethod(): ShippingOption | undefined;
}

export function legacyApi(engine: Engine): LegacyApi {
  const products = (lines: CartLine[]) => ({ lines, vouchers: [] });
  return {
    addItem: ({ packageId, quantity = 1 }) => engine.cart.addItem(packageId, quantity),
    clearCart: () => engine.cart.setGroups({}),
    swapCart: (items) => engine.cart.setGroups({ items: products(items) }),
    applyCoupon: (code) => engine.cart.applyCoupon(code),
    getPackage: (id) => engine.getPackage(id),
    getCampaignData: () => engine.getState().campaign,
    getCartData: () => {
      const { cart, campaign } = engine.getState();
      const lines = engine.cart.lines().map((l) => {
        const pkg = engine.getPackage(l.package_id);
        const line = cart.summary?.lines.find((s) => s.package_id === l.package_id);
        return {
          packageId: l.package_id,
          quantity: l.quantity,
          name: pkg?.name,
          image: pkg?.image,
          price: pkg?.price_total,
          total: line?.total,
        };
      });
      const s = cart.summary;
      return {
        cartLines: lines,
        items: lines,
        cartTotals: { subtotal: s?.subtotal, total: s?.total, discount: s?.total_discount, currency: s?.currency },
        campaignData: campaign,
        appliedCoupons: cart.coupons,
      };
    },
    exitIntent: (options) => import('./exit-intent').then((m) => m.exitIntent(engine, options)),
    getShippingMethods: () => engine.getState().campaign?.shipping_methods ?? [],
    setShippingMethod: (id) => engine.cart.setShipping(id),
    getSelectedShippingMethod: () => {
      const { campaign, cart } = engine.getState();
      return campaign?.shipping_methods.find((m) => m.ref_id === cart.shippingId);
    },
  };
}

/** @deprecated Use `next.on('ready', fn)` and `html[data-next-ready]`. */
export function announceLegacyReady(next: { version: string }, log: Logger): void {
  document.documentElement.classList.add('next-display-ready');
  document.dispatchEvent(new CustomEvent('next:initialized', { bubbles: true, detail: { version: next.version } }));
  const win = window as unknown as { nextReady?: unknown };
  const run = (fn: (n: object) => void) => {
    try {
      fn(next);
    } catch (err) {
      log.error('nextReady callback failed', err);
    }
  };
  if (Array.isArray(win.nextReady)) win.nextReady.forEach(run);
  win.nextReady = { push: run };
}

interface LegacyAnalyticsConfig {
  enabled?: boolean;
  providers?: Record<string, { enabled?: boolean } | undefined>;
}

export interface LegacyAnalytics {
  enabled: boolean;
  nextCampaign: boolean;
  dataLayer: boolean;
  unsupported: string[];
}

/** @deprecated `nextConfig.analytics`. GTM reads `dataLayer`; other vendors use GTM or the page's forwarder. */
export function readLegacyAnalytics(): LegacyAnalytics {
  const config = (window as unknown as { nextConfig?: { analytics?: LegacyAnalyticsConfig } }).nextConfig?.analytics;
  const providers = config?.providers ?? {};
  return {
    enabled: config?.enabled !== false,
    nextCampaign: providers.nextCampaign?.enabled !== false,
    dataLayer: providers.gtm?.enabled !== false,
    unsupported: ['facebook', 'rudderstack', 'custom'].filter((name) => providers[name]?.enabled),
  };
}

/** @deprecated {@link readLegacyAnalytics}, warning once for each provider that is no longer built in. */
export function legacyAnalytics(log: Logger): LegacyAnalytics {
  const analytics = readLegacyAnalytics();
  for (const name of analytics.unsupported)
    log.warn(`analytics provider "${name}" is no longer built in; send it through GTM or a forwarder`);
  return analytics;
}

/** @deprecated Removes the old SDK's plain-text personal-data cookie and stored profile. */
export function removeLegacyPersonalData(): void {
  document.cookie = 'next_user_data=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  try {
    localStorage.removeItem('nextDataLayer_userProperties');
  } catch {}
}
