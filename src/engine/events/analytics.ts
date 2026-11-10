import type { Envelope, EventName } from './bus';
import type { Cart, CartItem } from './carts';
import type { Checkout } from './checkout';
import type { EventContext } from './context';
import type { Order, OrderItem } from './orders';
import type { Promotion, PromotionEvents } from './promotions';
import type { Upsell } from './upsells';
import { untaxed } from '../order/order';

/**
 * Every tracking event the analytics chunk sends, and its `data`: the same objects the SDK's
 * events carry, at the moments that count for tracking. Each provider remaps them to its own format.
 */
export interface TrackingMap {
  /**
   * Every page load, when the SDK is ready.
   * @group Pages
   */
  page_viewed: Record<never, never>;
  /**
   * On ready, when the page shows exactly one package, at its catalog price.
   * @group Pages
   */
  product_viewed: CartItem;
  /**
   * On ready, when the page shows more than one package, at their catalog prices.
   * @group Pages
   */
  product_list_viewed: CartItem[];
  /**
   * One per line the cart gained since the last report, after its price; on ready for a cart filled before the page.
   * @group Carts
   */
  product_added_to_cart: CartItem & {
    /** No package was added in this tab before. */
    first_in_session: boolean;
  };
  /**
   * One per line the cart lost since the last report, at the price it was reported with.
   * @group Carts
   */
  product_removed_from_cart: CartItem;
  /**
   * After every price update.
   * @group Carts
   */
  cart_updated: Cart;
  /**
   * Once per checkout, when its form is ready.
   * @group Checkout
   */
  checkout_started: Checkout;
  /**
   * Once, when the contact details saved an Open Cart.
   * @group Checkout
   */
  checkout_contact_info_submitted: Checkout;
  /**
   * Once per checkout, when the shipping address is valid.
   * @group Checkout
   */
  checkout_shipping_address_submitted: Checkout;
  /**
   * Once per checkout, when the shipping address is valid and the cart is priced with a shipping
   * method: after `checkout_shipping_address_submitted`, never before `checkout_started`.
   * @group Checkout
   */
  checkout_shipping_method_submitted: Checkout;
  /**
   * Once per checkout, when a submit passes its checks.
   * @group Checkout
   */
  checkout_payment_info_submitted: Checkout;
  /**
   * Once per order, when it is paid; on a later page when the paying page was left before it was sent.
   * Its `lines` are the order's when it was paid, without the lines an upsell added later.
   * @group Orders
   */
  checkout_completed: Order;
  /**
   * Once per upsell accepted after the order was paid, when the order is loaded with it.
   * @group Upsells
   */
  upsell_completed: Order & {
    /** Which line this upsell added. */
    upsell: {
      /** 1 for the first upsell on the order. */
      number: number;
      line: OrderItem;
    };
  };
  /**
   * Once per upsell page, when an offer is shown.
   * @group Upsells
   */
  upsell_viewed: Upsell;
  /**
   * Every time an upsell is skipped.
   * @group Upsells
   */
  upsell_skipped: Upsell;
  /**
   * Every time a promotion is shown.
   * @group Promotions
   */
  promotion_viewed: Promotion;
  /**
   * Every time a promotion is clicked.
   * @group Promotions
   */
  promotion_selected: PromotionEvents['promotion.clicked'];
}

export type TrackingName = keyof TrackingMap;

/** The `object` of each tracking event's envelope: what its `data` is. */
export const OBJECTS = {
  page_viewed: 'page',
  product_viewed: 'product',
  product_list_viewed: 'products',
  product_added_to_cart: 'cart_line',
  product_removed_from_cart: 'cart_line',
  cart_updated: 'cart',
  checkout_started: 'checkout',
  checkout_contact_info_submitted: 'checkout',
  checkout_shipping_address_submitted: 'checkout',
  checkout_shipping_method_submitted: 'checkout',
  checkout_payment_info_submitted: 'checkout',
  checkout_completed: 'order',
  upsell_completed: 'order',
  upsell_viewed: 'upsell',
  upsell_skipped: 'upsell',
  promotion_viewed: 'promotion',
  promotion_selected: 'promotion',
} as const satisfies Record<TrackingName, string>;

/**
 * One tracking event, as `next.analytics.on` gets it: the SDK event envelope, `data` by
 * `event_type`, and the `context` it happened in. `event_id` is the transaction id on
 * `checkout_completed` and `upsell_completed`.
 */
export type TrackingEvent<K extends TrackingName = TrackingName> = {
  [N in K]: Envelope & {
    event_type: N;
    object: (typeof OBJECTS)[N];
    data: TrackingMap[N];
    context: EventContext;
  };
}[K];

export interface AnalyticsTrace {
  trace: 'analytics';
  trigger: EventName;
  name: string;
  sent: boolean;
  reason: string;
  id?: string;
}

export interface DestinationTrace {
  trace: 'destination';
  destination: 'NextDataLayer' | 'ga4' | 'meta' | 'rudderstack';
  name: string;
  /** None on a push no tracking event made (exit intent). */
  tracking?: TrackingName;
  event_id: string;
  /** What was sent; none when skipped. */
  payload?: unknown;
  /** Why it was not sent. */
  skipped?: string;
}

export interface AnalyticsEvents {
  /** @internal One tracking event, for `next.analytics.on`. */
  analytics: TrackingEvent;
}

/** A product line of a tracking event: a cart line, or an order line before tax. */
export type TrackingLine = CartItem | OrderItem;

/** The product lines a tracking event is about. */
export function trackingLines(e: TrackingEvent): TrackingLine[] {
  switch (e.event_type) {
    case 'product_viewed':
    case 'product_added_to_cart':
    case 'product_removed_from_cart':
      return [e.data];
    case 'product_list_viewed':
      return e.data;
    case 'cart_updated':
    case 'upsell_viewed':
    case 'upsell_skipped':
      return e.data.lines;
    case 'checkout_started':
    case 'checkout_contact_info_submitted':
    case 'checkout_shipping_address_submitted':
    case 'checkout_shipping_method_submitted':
    case 'checkout_payment_info_submitted':
      return e.data.cart.lines;
    case 'checkout_completed':
      return e.data.lines.map(untaxed);
    case 'upsell_completed':
      return [untaxed(e.data.upsell.line)];
    default:
      return [];
  }
}
