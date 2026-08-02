import type { useCartStore } from '@/state/cart';

/** The cart store's state, as the mini-cart reads it. */
export type CartStoreState = ReturnType<typeof useCartStore.getState>;

/** One line in the cart, as the mini-cart renders it. */
export type MiniCartItem = CartStoreState['items'][number];

/** A discount that applies to the cart as a whole rather than to one line. */
export interface CartLevelDiscount {
  type: 'offer' | 'voucher';
  label: string;
  amount: number;
}

/** What the mini-cart module needs from its host (the `DebugOverlay` instance). */
export interface MiniCartHost {
  shadowRoot: ShadowRoot | null;
}
