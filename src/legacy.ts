import type { Engine } from './engine/engine';
import type { Campaign, CartState, Package } from './engine/types';

/** @deprecated Use `data-next-selector-id`. */
export function legacySelectorId(el: Element): string | null {
  return el.getAttribute('data-next-id');
}

export interface LegacyApi {
  /** @deprecated Use `next.actions.addItem(packageId, quantity)`. */
  addItem(o: { packageId: number; quantity?: number }): Promise<void>;
  /** @deprecated Use `next.actions.clear()`. */
  clearCart(): Promise<void>;
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
  return {
    addItem: ({ packageId, quantity = 1 }) => engine.addItem(packageId, quantity),
    clearCart: () => engine.clear(),
    applyCoupon: (code) => engine.applyCoupon(code),
    getPackage: (id) => engine.getPackage(id),
    getCampaignData: () => engine.getState().campaign,
    getCartData: () => engine.getState().cart,
  };
}

/** @deprecated Use `next.on('ready', fn)` and `html[data-next-ready]`. */
export function announceLegacyReady(next: object, version: string): void {
  document.documentElement.classList.add('next-display-ready');
  document.dispatchEvent(new CustomEvent('next:initialized', { detail: { version } }));
  const win = window as unknown as { nextReady?: unknown };
  const queue = win.nextReady;
  if (Array.isArray(queue)) queue.forEach((fn: (n: object) => void) => fn(next));
  win.nextReady = { push: (fn: (n: object) => void) => fn(next) };
}
