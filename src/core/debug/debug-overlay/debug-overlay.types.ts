import type { useCartStore } from '@/state/cart';
import type { DebugPanel } from '../debug-panels';

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

/**
 * What `createOverlay`/`updateOverlay` need to render the panel chrome and
 * re-wire the listeners and buttons that render replaces.
 */
export interface OverlayRenderDeps {
  panels: DebugPanel[];
  activePanel: string;
  activePanelTab: string | undefined;
  isExpanded: boolean;
  addEventListeners: () => void;
  updateButtonStates: () => void;
}

/**
 * What the 1-second auto-update poll needs. `getActivePanel`/`getActivePanelTab`
 * are read fresh on every tick rather than captured once, because the active
 * panel can change while the interval is running.
 */
export interface AutoUpdateDeps {
  getActivePanel: () => string;
  getActivePanelTab: () => string | undefined;
  updateQuickStats: () => void;
  updateContent: () => void;
}

/** What the click-delegation handlers need from the overlay instance. */
export interface ContainerClickDeps {
  panels: DebugPanel[];
  activePanel: string;
  handleDebugAction: (action: string) => void;
  handleTabSwitch: (target: HTMLElement) => boolean;
  updateOverlay: () => void;
}
