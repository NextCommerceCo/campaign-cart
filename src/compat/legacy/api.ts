import type { Engine } from '../../engine/engine';
import { normalizeCode } from '../../engine/cart/lines';
import type { CartLine } from '../../engine/cart/types';
import type { Campaign, Package, ShippingOption } from '../../engine/types';
import type { ExitIntentOptions } from '../exit-intent';

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
  /** @deprecated Use `next.actions.applyCoupon(code)`. A code entered on an empty cart answers `true` at once, as in 0.4.x. */
  applyCoupon(code: string): Promise<boolean>;
  /** @deprecated A package's product, variant and image come on every event's `CartItem`; `next.getState()` has the campaign for debugging. */
  getPackage(id: number): Package | undefined;
  /** @deprecated Use `next.snapshot().campaign`. */
  getCampaignData(): Campaign | undefined;
  /** @deprecated Use `next.snapshot().cart`. Returns the 0.4.x shape. */
  getCartData(): LegacyCartData;
  /** @deprecated Exit intent will move to the page kit. */
  exitIntent(options: ExitIntentOptions): Promise<() => void>;
  /** @deprecated The chosen method is `next.snapshot().cart.shipping_method`; `next.getState()` has the campaign's list for debugging. */
  getShippingMethods(): ShippingOption[];
  /** @deprecated Use `next.actions.setShipping(id)`. */
  setShippingMethod(id: number): Promise<void>;
  /** @deprecated Use `next.snapshot().cart.shipping_method`. */
  getSelectedShippingMethod(): ShippingOption | undefined;
}

export function legacyApi(engine: Engine): LegacyApi {
  return {
    addItem: ({ packageId, quantity = 1 }) => engine.cart.addItem(packageId, quantity),
    clearCart: () => engine.cart.setGroups({}),
    swapCart: (lines) => engine.cart.setGroups({ items: { lines, vouchers: [] } }),
    applyCoupon: (code) => {
      const held = () => engine.getState().cart.held.includes(normalizeCode(code));
      const wasHeld = held();
      const applied = engine.cart.applyCoupon(code);
      return !wasHeld && held() ? Promise.resolve(true) : applied;
    },
    getPackage: (id) => engine.getPackage(id),
    getCampaignData: () => engine.getState().campaign,
    getCartData: () => {
      const { cart, campaign } = engine.getState();
      const s = 'total' in engine.cart.current() ? cart.summary : undefined;
      const lines = engine.cart.lines().map((l) => {
        const pkg = engine.getPackage(l.package_id);
        const line = s?.lines.find((p) => p.package_id === l.package_id);
        return {
          packageId: l.package_id,
          quantity: l.quantity,
          name: pkg?.name,
          image: pkg?.image,
          price: pkg?.price_total,
          total: line?.total,
        };
      });
      return {
        cartLines: lines,
        items: lines,
        cartTotals: { subtotal: s?.subtotal, total: s?.total, discount: s?.total_discount, currency: s?.currency },
        campaignData: campaign,
        appliedCoupons: [...cart.coupons, ...cart.held],
      };
    },
    exitIntent: (options) => import('../exit-intent').then((m) => m.exitIntent(engine, options)),
    getShippingMethods: () => engine.getState().campaign?.shipping_methods ?? [],
    setShippingMethod: (id) => engine.cart.setShipping(id),
    getSelectedShippingMethod: () => {
      const { campaign, cart } = engine.getState();
      return campaign?.shipping_methods.find((m) => m.ref_id === cart.shippingId);
    },
  };
}

/** @deprecated Use `window.nextReady`, `next.on('ready', fn)` and `html[data-next-ready]`. */
export function announceLegacyReady(next: { version: string }): void {
  document.documentElement.classList.add('next-display-ready');
  document.dispatchEvent(new CustomEvent('next:initialized', { bubbles: true, detail: { version: next.version } }));
}
