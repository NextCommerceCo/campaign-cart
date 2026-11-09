import type { CartItem } from './carts';
import type { Failure } from './sdk';

/** An upsell offer on a post-purchase page, the same on every `upsell.*` event. */
export interface Upsell {
  /** The order the offer is for. */
  ref_id: string;
  /** The upsell page's path. */
  page: string;
  /** The offer's selector, when it has one. */
  selector_id?: string;
  /** The picked option, for an offer with a selector. */
  option_id?: string;
  /** What the offer adds, at its quantity. Priced once the offer has a price. */
  lines: CartItem[];
  /** ISO 4217, such as `USD`. */
  currency?: string;
  /** What the offer costs after discounts. @priced */
  total?: number;
}

export interface UpsellEvents {
  /**
   * Once per offer, when half of it is on screen.
   * @group Upsells
   */
  'upsell.viewed': Upsell;
  /**
   * The offer was added to the order.
   * @group Upsells
   */
  'upsell.accepted': Upsell;
  /**
   * The shopper went on without the offer.
   * @group Upsells
   */
  'upsell.skipped': Upsell;
  /**
   * Adding the offer failed: refused, or the order does not have it. A decline is `payment.failed`.
   * @group Upsells
   */
  'upsell.failed': Upsell & { error: Failure };
  /** @internal */
  'upsell.shown': Upsell;
  /** @internal */
  'upsell.declined': Upsell & { error: Failure; message: string };
}
