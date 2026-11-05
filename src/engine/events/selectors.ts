import type { CartItem } from './carts';

export type SelectorType = 'bundle' | 'offer' | 'toggle';

/** One option of a selector, at the quantity it would be added. */
export interface SelectorOption {
  /** The option's `data-next-bundle-id`. */
  option_id: string;
  /** The lines the option puts in the cart. Priced once the option has a price. */
  lines: CartItem[];
  /** What the option costs after discounts. @priced */
  total?: number;
  /** What the option costs before discounts. @priced */
  original_total?: number;
}

/** A selector and the option picked in it, the same on every `selector.*` event. */
export interface Selector {
  /** `data-next-selector-id`, or `toggle:<package_id>` for a toggle. */
  selector_id: string;
  type: SelectorType;
  /** The picked option's `data-next-bundle-id`; none for a toggle. */
  option_id?: string;
  /**
   * The lines the picked option puts in the cart, at its quantity; the toggle's line for a toggle.
   * Priced once the option has a price.
   */
  lines: CartItem[];
  /** ISO 4217, such as `USD`. @campaign */
  currency?: string;
  /** What the picked option costs after discounts. @priced */
  total?: number;
  /** Every option of a bundle or offer selector; none for a toggle. */
  options?: SelectorOption[];
}

export interface SelectorEvents {
  /**
   * Once a page, when half of the selector is on screen, with the option it picked: from
   * `?forceBundleId`, the cart, `data-next-selected`, else its first option.
   * @group Selectors
   */
  'selector.viewed': Selector;
  /** @internal A selector's first bind on this page, with the option it picked: the moment of 0.4.x selection events. */
  'selector.bound': Selector;
  /**
   * The shopper picked another option, or switched a toggle on.
   * @group Selectors
   */
  'selector.selected': Selector;
  /**
   * The picked option's quantity or one of its slots changed.
   * @group Selectors
   */
  'selector.updated': Selector;
  /**
   * A toggle is switched off, or its line left the cart.
   * @group Selectors
   */
  'selector.deselected': Selector;
  /**
   * Pricing the options that have no price yet starts; a toggle's line while it is off.
   * @group Selectors
   */
  'selector.calculating': Selector;
  /**
   * Every option has a price. Prices are kept 10 minutes and checked again once a page, so a later
   * page may get this at once and again when fresh prices arrive. A toggle is priced while it is off.
   * @group Selectors
   */
  'selector.calculated': Selector;
}
