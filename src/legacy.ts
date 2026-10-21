import type { Engine } from './engine/engine';
import type { Campaign, CartLine, EventName, Package } from './engine/types';
import type { ExitIntentOptions } from './exit-intent';

/** @deprecated Use `data-next-selector-id`. */
export function legacySelectorId(el: Element): string | null {
  return el.getAttribute('data-next-id');
}

/** @deprecated Old `next.on` names. Use `selection.changed`, `cart.updated`, `shipping.changed`. */
export const LEGACY_EVENTS: Record<string, EventName> = {
  'bundle:selection-changed': 'selection.changed',
  'cart:updated': 'cart.updated',
  'shipping:method-changed': 'shipping.changed',
  'exit-intent:shown': 'exit-intent.shown',
  'exit-intent:clicked': 'exit-intent.clicked',
  'exit-intent:dismissed': 'exit-intent.dismissed',
  'exit-intent:closed': 'exit-intent.closed',
  'exit-intent:action': 'exit-intent.action',
};

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
  applyCoupon(code: string): Promise<void>;
  /** @deprecated Use `next.getState().campaign.packages`. */
  getPackage(id: number): Package | undefined;
  /** @deprecated Use `next.getState().campaign`. */
  getCampaignData(): Campaign | undefined;
  /** @deprecated Use `next.getState().cart`. Returns the 0.4.x shape. */
  getCartData(): LegacyCartData;
  /** @deprecated Exit intent will move to the page kit. */
  exitIntent(options: ExitIntentOptions): Promise<() => void>;
}

export function legacyApi(engine: Engine): LegacyApi {
  const products = (lines: CartLine[]) => ({ lines, vouchers: [] });
  return {
    addItem: ({ packageId, quantity = 1 }) => engine.addItem(packageId, quantity),
    clearCart: () => engine.setGroups({}),
    swapCart: (items) => engine.setGroups({ items: products(items) }),
    applyCoupon: (code) => engine.applyCoupon(code),
    getPackage: (id) => engine.getPackage(id),
    getCampaignData: () => engine.getState().campaign,
    getCartData: () => {
      const { cart, campaign } = engine.getState();
      const lines = engine.lines().map((l) => {
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
  };
}

/** @deprecated Use `next.on('ready', fn)` and `html[data-next-ready]`. */
export function announceLegacyReady(next: { version: string }): void {
  document.documentElement.classList.add('next-display-ready');
  document.dispatchEvent(new CustomEvent('next:initialized', { bubbles: true, detail: { version: next.version } }));
  const win = window as unknown as { nextReady?: unknown };
  const run = (fn: (n: object) => void) => {
    try {
      fn(next);
    } catch (err) {
      console.error('[next] nextReady callback failed', err);
    }
  };
  if (Array.isArray(win.nextReady)) win.nextReady.forEach(run);
  win.nextReady = { push: run };
}

interface LegacyAnalyticsConfig {
  enabled?: boolean;
  providers?: Record<string, { enabled?: boolean } | undefined>;
}

/** @deprecated `nextConfig.analytics`. GTM reads `dataLayer`; other vendors use GTM or the page's forwarder. */
export function legacyAnalytics(): { enabled: boolean; nextCampaign: boolean } {
  const config = (window as unknown as { nextConfig?: { analytics?: LegacyAnalyticsConfig } }).nextConfig?.analytics;
  const providers = config?.providers ?? {};
  for (const name of ['facebook', 'rudderstack', 'custom']) {
    if (providers[name]?.enabled)
      console.warn(`[next] analytics provider "${name}" is no longer built in; send it through GTM or a forwarder`);
  }
  return { enabled: config?.enabled !== false, nextCampaign: providers.nextCampaign?.enabled !== false };
}

/** @deprecated Removes the old SDK's plain-text personal-data cookie and stored profile. */
export function removeLegacyPersonalData(): void {
  document.cookie = 'next_user_data=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  try {
    localStorage.removeItem('nextDataLayer_userProperties');
  } catch {}
}
