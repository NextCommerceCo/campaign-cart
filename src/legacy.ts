import type { Engine } from './engine/engine';
import type { Campaign, CartLine, CartState, EventName, Package } from './engine/types';

/** @deprecated Use `data-next-selector-id`. */
export function legacySelectorId(el: Element): string | null {
  return el.getAttribute('data-next-id');
}

/** @deprecated Old `next.on` names. Use `selection.changed`, `cart.updated`, `shipping.changed`. */
export const LEGACY_EVENTS: Record<string, EventName> = {
  'bundle:selection-changed': 'selection.changed',
  'cart:updated': 'cart.updated',
  'shipping:method-changed': 'shipping.changed',
};

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
  /** @deprecated Use `next.getState().cart`. */
  getCartData(): CartState;
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
    getCartData: () => engine.getState().cart,
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

/** @deprecated Removes the old SDK's plain-text personal-data cookie and stored profile. */
export function removeLegacyPersonalData(): void {
  document.cookie = 'next_user_data=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  try {
    localStorage.removeItem('nextDataLayer_userProperties');
  } catch {}
}

