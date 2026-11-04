import type { Logger } from './log';
import { newId } from './id';
import type { Line } from './cart/types';
import type { Campaign, CheckoutError, Order, OrderLine } from './types';

export interface PromotionDetail {
  /** Which promotion: `exit_intent` is the exit-intent popup, the only one so far. */
  source: 'exit_intent';
  /** The popup's image, when it shows one. */
  image_url?: string;
  /** The `template[data-template]` the popup shows, when it uses one. */
  template?: string;
}

export type AddressType = 'shipping' | 'billing';

/** The shopper, as the store's `user` on the Open Cart and the order. */
export interface User {
  /** As typed, trimmed; none when `data-trigger-on` created the user without one. */
  email?: string;
  first_name: string;
  last_name: string;
  /** In E.164 once the address service read it, else the digits typed. */
  phone?: string;
  /** The marketing checkbox, as sent with the Open Cart and the order. */
  accepts_marketing: boolean;
  /** The language the store keeps for the shopper, such as `en`. */
  language: string;
  /** The shopper's IP address, as the store recorded it with the Open Cart. */
  ip?: string;
  /** As the store recorded it with the Open Cart, else the browser's. */
  user_agent: string;
}

/** A postal address as the shopper entered it, once every field its country requires is valid. */
export interface Address {
  first_name: string;
  last_name: string;
  line1: string;
  line2?: string;
  /** None in a country whose addresses have no city, such as Singapore. */
  city?: string;
  /** The state or province code, in a country that has them. */
  state?: string;
  postcode?: string;
  /** ISO 3166-1 alpha-2. */
  country: string;
  /** In E.164 once the address service read it, else the digits typed. */
  phone?: string;
}

export type SelectorType = 'bundle' | 'offer' | 'toggle';

export type ErrorAction =
  | 'campaign.load'
  | 'cart.calculate'
  | 'selector.calculate'
  | 'coupon.check'
  | 'user.save'
  | 'address.rules'
  | 'address.autocomplete'
  | 'order.create'
  | 'order.load'
  | 'upsell.add'
  | 'storage.write';

export type ErrorCode =
  'network' | 'timeout' | 'server' | 'rejected' | 'declined' | 'auth' | 'too_many_requests' | 'unavailable';

/** A discount on the cart's products or on its shipping. Amounts are in the cart's currency. */
export interface Discount {
  /** The offer's name. */
  name: string;
  /** The amount taken off. */
  amount: number;
  /** `coupon` for a code the shopper entered (it is in `coupons`); `offer` for an automatic offer or a bundle card's own code. */
  source: 'offer' | 'coupon';
  /** The code, for a coupon. */
  code?: string;
  /** The offer that gave it. */
  offer_id: number;
}

/** The chosen way to pay. */
export interface Payment {
  /** The API's code: `card_token`, `paypal`, `apple_pay`, `google_pay`, `klarna`, … */
  method: string;
}

/** A package billed again every interval. */
export interface Subscription {
  /** The unit of the renewal interval. */
  interval: 'day' | 'month';
  /** How many `interval`s between renewals. */
  interval_count: number;
  /** What each renewal charges, after discounts. @priced */
  price?: number;
  /** What each renewal charges before discounts. @priced */
  original_price?: number;
}

/** A line of the cart. Its prices are there once the server priced the cart. */
export interface CartItem extends Line {
  /** The product in the store. @campaign */
  product_id?: number;
  /** The product's name as customers see it, as on an order line. @campaign */
  product_title?: string;
  /** The product variant, for a product with variants. @campaign */
  variant_id?: number;
  /** The variant's name, such as `Black / M`, for a product with variants. @campaign */
  variant_title?: string;
  /** The package's image URL. @campaign */
  image?: string;
  /** What one package costs after discounts. @priced */
  price?: number;
  /** What one package costs before discounts; equal to `price` when nothing is taken off. @priced */
  original_price?: number;
  /** The discount on the line. @priced */
  total_discount?: number;
  /** `price × quantity`. @priced */
  total?: number;
  /** The discounts on the line. @priced */
  discounts?: Discount[];
  /** For a package billed again every interval. @campaign */
  subscription?: Subscription;
}

/** The selected shipping method, and what shipping costs. */
export interface ShippingMethod {
  /** The method's `ref_id`. */
  id: number;
  /** Such as `standard`. @campaign */
  code?: string;
  /** The method's name. @priced */
  name?: string;
  /** What shipping costs after discounts; `0` is free shipping. @priced */
  price?: number;
  /** What shipping costs before discounts. @priced */
  original_price?: number;
  /** The discounts on shipping, such as a free-shipping offer. @priced */
  discounts?: Discount[];
}

/**
 * The cart every `cart.*` event carries. Prices are numbers in `currency`, there once the server
 * priced these lines: `total = subtotal − total_discount + shipping_method.price`.
 */
export interface Cart {
  /** Every line in the cart, the same package's lines merged. */
  lines: CartItem[];
  /** The codes the shopper applied, uppercase. A bundle card's own codes are not listed. */
  coupons: string[];
  /** ISO 4217, such as `USD`. @campaign */
  currency?: string;
  /** The selected shipping method, and what shipping costs. */
  shipping_method?: ShippingMethod;
  /** The products before discounts, without shipping. @priced */
  subtotal?: number;
  /** The discounts on the products, without shipping's: the sum of `discounts`. @priced */
  total_discount?: number;
  /** What the shopper pays. @priced */
  total?: number;
  /** The discounts on the products, one per offer. @priced */
  discounts?: Discount[];
}

/** The cart and what the shopper has entered so far, the same on every checkout event. */
export interface Checkout {
  /** The same cart `cart.*` events carry. */
  cart: Cart;
  /** The shopper, from `user.created` on. */
  user?: User;
  /** From `address.entered` for the shipping address on. */
  shipping_address?: Address;
  /** On a checkout page: `false` once the shopper asks for a separate billing address. */
  billing_same_as_shipping?: boolean;
  /** When `billing_same_as_shipping` is `false`, from `address.entered` for it on. */
  billing_address?: Address;
  /** The API's code for the chosen payment method, on a checkout page: `card_token`, `paypal`, `apple_pay`, … */
  payment_method?: string;
}

/** A package added to or removed from the cart. */
export interface CartChange {
  /** The package's `ref_id` in the campaign. */
  package_id: number;
  /** The product in the store. @campaign */
  product_id?: number;
  /** The product variant. @campaign */
  variant_id?: number;
  /** How many packages were added or removed. */
  quantity: number;
  /** What one package cost, as the server priced it; the campaign's package price when it could not. */
  price: number;
}

/** A selector and the option picked in it, the same on every `selector.*` event. */
export interface Selector {
  /** `data-next-selector-id`, or `toggle:<package_id>` for a toggle. */
  selector_id: string;
  type: SelectorType;
  /** The picked option's `data-next-bundle-id`; none for a toggle. */
  option_id?: string;
  /**
   * The lines the picked option puts in the cart, at its quantity; a toggle's line while it is on.
   * Priced once the option has a price.
   */
  lines: CartItem[];
}

/** The campaign the page runs, on every event once it has loaded. */
export interface EventCampaign {
  /** The campaign's `id` in the Campaigns API and the dashboard. */
  id: number;
  name: string;
  /** The currency the page shows: the campaign's, or the one `?currency=` asked for. */
  currency: string;
  /** The campaign's language code, like `en`. */
  language: string;
}

export type AnalyticsName =
  | 'page_view'
  | 'view_item'
  | 'view_item_list'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'update_cart'
  | 'begin_checkout'
  | 'add_shipping_info'
  | 'add_payment_info'
  | 'purchase'
  | 'upsell_purchase'
  | 'view_upsell'
  | 'skip_upsell'
  | 'generate_lead'
  | 'view_promotion'
  | 'select_promotion';

/** Where the shopper came from, as sent with the Open Cart and the order. Only fields with a value are present. */
export interface EventAttribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  /** `affid` or `aff`. */
  affiliate?: string;
  subaffiliate1?: string;
  subaffiliate2?: string;
  subaffiliate3?: string;
  subaffiliate4?: string;
  subaffiliate5?: string;
  gclid?: string;
  /** `data-funnel`, else the campaign's name. */
  funnel?: string;
  everflow_transaction_id?: string;
  /** The first page of the visit, without its query string. */
  landing_page?: string;
  fbclid?: string;
  /** The `_fbp` cookie. */
  fbp?: string;
  /** The `_fbc` cookie. */
  fbc?: string;
  /** An affiliate network's click id. */
  clickid?: string;
}

/** The browser, read when the event is sent. */
export interface Browser {
  user_agent: string;
  /** The browser's language, such as `th-TH`. */
  language: string;
  /** `mobile` when the main pointer is coarse (a finger). */
  device_type: 'mobile' | 'desktop';
}

/** Where, for which campaign and in which browser an event happened. */
export interface EventContext {
  /** Origin and path, without the query string. */
  page_location: string;
  /** Without the query string. */
  page_referrer: string;
  /** Once the campaign has loaded. */
  campaign?: EventCampaign;
  /** The campaign session, as in the event envelope. */
  session_id: string;
  attribution: EventAttribution;
  browser: Browser;
}

export interface AnalyticsEvent {
  name: AnalyticsName;
  id: string;
  time: string;
  params: Record<string, unknown>;
  context: EventContext;
}

export interface AnalyticsTrace {
  trace: 'analytics';
  trigger: EventName;
  name: string;
  sent: boolean;
  reason: string;
  id?: string;
}

export interface EventMap {
  /**
   * Once a page, when the campaign is in: at once from a copy saved in the last 10 minutes, else
   * when the API answers. `ready` is the same event, and it reaches listeners added after it fired.
   * @group SDK
   */
  'sdk.ready': {
    /** The cart's lines at that moment. */
    lines: Line[];
  };
  /**
   * A step failed. The SDK lifecycle lists each `action`, what the SDK does next, and the event
   * sent with it.
   * @group SDK
   */
  'sdk.error': {
    /** The step that failed, named like the events. */
    action: ErrorAction;
    /** Why: `network` (no answer), `timeout`, `server` (5xx), `rejected` (4xx), `declined` (the payment gateway), `auth` (401, 403), `too_many_requests` (429), or `unavailable` (storage blocked or full). */
    code: ErrorCode;
    /** The HTTP status, when the API answered. */
    status?: number;
    /** For developers and logs, never for shoppers. */
    message: string;
  };
  /** @internal */
  'campaign.loaded': { campaign: Campaign; fromCache: boolean };
  /**
   * An option is picked, its quantity or a slot changed, or a toggle is switched on.
   * @group Selectors
   */
  'selector.selected': Selector;
  /**
   * A toggle is switched off.
   * @group Selectors
   */
  'selector.deselected': Selector;
  /**
   * Pricing the options that have no price yet starts.
   * @group Selectors
   */
  'selector.calculating': Selector;
  /**
   * Every option's price is on the page. Prices are kept 10 minutes, so a later page may get this
   * at once.
   * @group Selectors
   */
  'selector.calculated': Selector;
  /**
   * Lines, coupons or shipping changed, at once, before the server prices them.
   * @group Carts
   */
  'cart.updated': Cart;
  /**
   * Pricing starts; once for a burst of changes.
   * @group Carts
   */
  'cart.calculating': Cart;
  /**
   * Server totals arrived.
   * @group Carts
   */
  'cart.calculated': Cart;
  /**
   * Packages the page added since the last price, net, just before `cart.calculated`, or after
   * `sdk.error` when pricing fails. A `+ + −` within one price run sends one event for the net
   * change; `+` then `−` sends none.
   * @group Carts
   */
  'cart.added': Cart & {
    /** What was added, at the price the server charged. */
    changes: CartChange[];
  };
  /**
   * Packages the page removed since the last price, at the price they had.
   * @group Carts
   */
  'cart.removed': Cart & {
    /** What was removed, at the price it had. */
    changes: CartChange[];
  };
  /**
   * A code was added to the cart.
   * @group Coupons
   */
  'coupon.applied': { code: string };
  /**
   * A code was removed.
   * @group Coupons
   */
  'coupon.removed': { code: string };
  /**
   * The server gives no discount for a code; it is not kept.
   * @group Coupons
   */
  'coupon.denied': { code: string };
  /**
   * Once a page, when the checkout form is bound with a cart: each step, a reload, a return from
   * a payment gateway. None when the cart is empty then.
   * @group Checkout
   */
  'checkout.started': Checkout;
  /**
   * Once per tab until an order is paid, when the store saves the shopper with a new Open Cart:
   * what `data-next-lead` asks for is in (by default a first and last name and a valid email),
   * checked when a field changes. The store keeps the user for marketing, as `accepts_marketing`
   * allows, and the cart for `cart.abandoned`.
   * @group Checkout
   */
  'user.created': User;
  /**
   * The shopper's details changed after `user.created` and are still valid. The Open Cart keeps
   * the first ones.
   * @group Checkout
   */
  'user.updated': User;
  /**
   * Once per `type` per tab until an order is paid, when that address is valid: every field its
   * country requires is filled and valid, and so is each optional one filled. Checked when a field
   * changes.
   * @group Checkout
   */
  'address.entered': Address & {
    /** Which address: `billing` only when it is separate from the shipping one. */
    type: AddressType;
  };
  /**
   * The address changed after `address.entered` and is still valid.
   * @group Checkout
   */
  'address.updated': Address & { type: AddressType };
  /**
   * A shipping method was picked. A bundle card can set it on the landing page too.
   * @group Checkout
   */
  'shipping.selected': ShippingMethod;
  /**
   * The payment method changed.
   * @group Checkout
   */
  'payment.selected': Payment;
  /**
   * Each submit, once its checks ran: the fields, then the card tokenized. A valid submit is
   * followed by `order.created` or `order.failed`.
   * @group Checkout
   */
  'checkout.submitted': Checkout & {
    /** `true` when the order is being sent. */
    valid: boolean;
    /** What stopped it, by field name; empty when valid. */
    errors: Record<string, CheckoutError>;
  };
  /**
   * The order was created. For a payment at a gateway the order has only `ref_id` and
   * `payment_complete_url`; its details come with `order.loaded` once it is paid.
   * @group Orders
   */
  'order.created': { order: Order };
  /**
   * The server refused the order, or the shopper came back from a payment gateway that failed.
   * @group Orders
   */
  'order.failed': {
    /** `order`: the server refused it. `payment`: the gateway failed. */
    stage: 'order' | 'payment';
    /** `declined`, `payment_failed`, `rejected`, … */
    code: string;
    message?: string;
    /** The gateway's decline code, for a declined card. */
    decline?: string;
    /** The order the failed payment was for. */
    ref_id?: string;
  };
  /**
   * The order loaded on a post-purchase page.
   * @group Orders
   */
  'order.loaded': {
    order: Order;
    /** Accepted upsells not reported yet. */
    upsells?: Array<{ id: string; number: number; line: OrderLine }>;
  };
  /**
   * The order is paid: once per order, after `order.loaded` on the first page that loads it
   * paid, the page after the checkout or after the payment gateway.
   * @group Orders
   */
  'order.paid': {
    order: Order;
    /** The coupon code applied at checkout. */
    coupon?: string;
  };
  /**
   * An offer was shown.
   * @group Upsells
   */
  'upsell.viewed': {
    /** The order the offer is for. */
    ref_id: string;
    /** The upsell page's path. */
    page: string;
  };
  /**
   * The offer was added to the order.
   * @group Upsells
   */
  'upsell.accepted': {
    ref_id: string;
    lines: Line[];
    /** The order with the offer added. */
    order: Order;
  };
  /**
   * The shopper went on without the offer.
   * @group Upsells
   */
  'upsell.skipped': { ref_id: string; package_id?: number };
  /**
   * Adding the offer failed, such as a decline.
   * @group Upsells
   */
  'upsell.failed': { ref_id: string; code: string; message?: string };
  /**
   * The promotion opened.
   * @group Promotions
   */
  'promotion.viewed': PromotionDetail;
  /**
   * The image was clicked, or a template action ran.
   * @group Promotions
   */
  'promotion.clicked': PromotionDetail & {
    /** The template button's `data-exit-intent-action`, such as `apply-coupon`. */
    action?: string;
    /** The button's `data-coupon-code`. */
    coupon_code?: string;
  };
  /**
   * The promotion closed without a click.
   * @group Promotions
   */
  'promotion.closed': PromotionDetail & {
    /** `dismissed`: Esc or the overlay. `closed`: the close button. */
    reason: 'dismissed' | 'closed';
  };
  /** One tracking event under its GA4 name. See `next.analytics.on`. */
  analytics: AnalyticsEvent;
}

export type EventName = keyof EventMap;

export interface EngineEvent<K extends EventName = EventName> {
  id: string;
  name: K;
  data: EventMap[K];
  at: number;
}

type Listener = (event: EngineEvent) => void;

const BUFFER_SIZE = 100;

/** @internal */
export class Events {
  private listeners = new Map<string, Set<Listener>>();
  private buffer: EngineEvent[] = [];
  private queue: EngineEvent[] = [];
  private emitting = false;

  constructor(private log: Logger) {}

  emit<K extends EventName>(name: K, data: EventMap[K]): void {
    const event: EngineEvent = { id: newId(), name, data, at: Date.now() };
    this.buffer.push(event);
    if (this.buffer.length > BUFFER_SIZE)
      this.buffer.splice(
        this.buffer.findIndex((e) => e.name !== 'sdk.ready'),
        1,
      );
    this.queue.push(event);
    if (this.emitting) return;
    this.emitting = true;
    try {
      for (let next = this.queue.shift(); next; next = this.queue.shift()) {
        const current = next;
        for (const key of [current.name, '*'])
          [...(this.listeners.get(key) ?? [])].forEach((fn) => this.deliver(fn, current));
      }
    } finally {
      this.emitting = false;
    }
  }

  on<K extends EventName>(
    name: K | '*',
    fn: (event: EngineEvent<K>) => void,
    options: { replay?: boolean } = {},
  ): () => void {
    const listener = fn as Listener;
    let set = this.listeners.get(name);
    if (!set) this.listeners.set(name, (set = new Set()));
    set.add(listener);
    if (options.replay)
      this.buffer.filter((e) => name === '*' || e.name === name).forEach((e) => this.deliver(listener, e));
    return () => set.delete(listener);
  }

  private deliver(fn: Listener, event: EngineEvent): void {
    try {
      fn(event);
    } catch (err) {
      this.log.error(`subscriber failed on ${event.name}`, err);
    }
  }
}
