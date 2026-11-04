import type { Logger } from './log';
import { newId } from './id';
import type { Line } from './cart/types';
import type { Campaign, CheckoutError } from './types';

/** A promotion the page shows: the exit-intent popup, or an element marked `data-next-promotion`. */
export interface Promotion {
  /** `exitIntent({ id })` or `data-next-promotion`; `exit_intent` for the exit-intent popup by default. */
  id: string;
  /** `exit_intent` for the exit-intent popup, `banner` for a marked element. */
  type: 'exit_intent' | 'banner';
  /** `exitIntent({ name })` or `data-next-promotion-name`, when set. */
  name?: string;
  /** The popup's template name or image URL, or `data-next-promotion-creative`. */
  creative?: string;
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
  | 'address.load_rules'
  | 'address.suggest'
  | 'order.create'
  | 'order.load'
  | 'upsell.add'
  | 'storage.write';

export type ErrorCode =
  | 'network'
  | 'timeout'
  | 'server'
  | 'rejected'
  | 'declined'
  | 'payment_failed'
  | 'auth'
  | 'too_many_requests'
  | 'unavailable';

/** Why something failed: the same shape on `sdk.error` and on every `*.failed` event. */
export interface Failure {
  /** `network` (no answer), `timeout`, `server` (5xx), `rejected` (4xx), `declined` (the card or the gateway), `payment_failed` (the gateway sent the shopper back unpaid), `auth` (401, 403), `too_many_requests` (429), or `unavailable` (storage blocked or full). */
  code: ErrorCode;
  /** For developers and logs, never for shoppers. */
  message?: string;
  /** The HTTP status, when the API answered. */
  status?: number;
  /** The gateway's decline code, for a declined card. */
  decline_code?: string;
}

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
  /** One checkout in this tab, the same across its steps, reloads and a return from a payment gateway; a new one after an order is paid. Empty until `checkout.started`. */
  id: string;
  /** The step of a multi-step checkout (`data-next-checkout-step`), from 1; none on a one-page checkout. */
  step?: number;
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

/** A package added to or removed from the cart by one change. */
export interface CartChange {
  /** The package's `ref_id` in the campaign. */
  package_id: number;
  /** The product in the store. @campaign */
  product_id?: number;
  /** The product variant. @campaign */
  variant_id?: number;
  /** How many packages were added or removed. */
  quantity: number;
  /** The package's quantity in the cart before the change. */
  from: number;
  /** The package's quantity in the cart after the change. */
  to: number;
  /** What one package costs, when the server has already priced it. @priced */
  price?: number;
}

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

/** One line of an order. Prices are numbers in the order's currency, as the shopper paid them. */
export interface OrderItem {
  /** The order line's id. */
  id: string;
  /** The product in the store. */
  product_id?: number;
  /** The product's name as customers see it. */
  product_title: string;
  /** The product variant. */
  variant_id?: number;
  /** The variant's name, such as `Black / M`. */
  variant_title?: string;
  /** The product's Stock Keeping Unit. */
  sku?: string;
  image?: string;
  quantity: number;
  /** What one unit cost after discounts. */
  price: number;
  /** What one unit cost before discounts. */
  original_price: number;
  /** `price × quantity`. */
  total: number;
  /** `true` for a line an upsell added. */
  upsell: boolean;
}

/** An order the store created, the same on every `order.*` event. Prices are numbers in `currency`. */
export interface Order {
  /** The order's reference: `ref_id` in post-purchase page URLs. */
  ref_id: string;
  /** The order number customers see. */
  number?: string;
  /** ISO 4217, such as `USD`. */
  currency?: string;
  /** `true` for a test order. */
  test: boolean;
  lines: OrderItem[];
  /** The codes the shopper applied at checkout in this tab, uppercase. */
  coupons: string[];
  /** The discounts on the order. */
  total_discount: number;
  /** The shipping method's name and price. */
  shipping_method?: Pick<ShippingMethod, 'name' | 'price'>;
  /** The tax in the order. */
  tax: number;
  /** What the shopper paid. */
  total: number;
  user?: Pick<User, 'email' | 'first_name' | 'last_name' | 'phone'>;
  shipping_address?: Address;
  billing_address?: Address;
  /** The API's code for the payment method, such as `card_token` or `paypal`. */
  payment_method?: string;
  /** `true` when upsells can be added to the order. */
  supports_upsells: boolean;
  /** The order's status page on the store. */
  status_url?: string;
}

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

/** What the page shows now: the same objects the events carry. */
export interface Snapshot {
  /** Once the campaign has loaded. */
  campaign?: EventCampaign;
  cart: Cart;
  /** On a checkout page, once the form is bound. */
  checkout?: Checkout;
  /** On a page that loaded an order. */
  order?: Order;
  /** Every bundle and offer selector on the page; toggles are in the cart. */
  selectors: Selector[];
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
   * when the API answers. `ready` is the same event. Carries what the page shows then.
   * @group SDK
   */
  'sdk.ready': Snapshot;
  /**
   * A step failed. The SDK lifecycle lists each `action`, what the SDK does next, and the event
   * sent with it.
   * @group SDK
   */
  'sdk.error': Failure & {
    /** The step that failed, named like the events. */
    action: ErrorAction;
    /** For developers and logs, never for shoppers. */
    message: string;
  };
  /** @internal */
  'campaign.loaded': { campaign: Campaign; fromCache: boolean };
  /**
   * A selector is on the page, with the option it picked: from `?forceBundleId`, the cart,
   * `data-next-selected`, else its first option. Not for toggles.
   * @group Selectors
   */
  'selector.viewed': Selector;
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
   * Pricing the options that have no price yet starts. Not for toggles.
   * @group Selectors
   */
  'selector.calculating': Selector;
  /**
   * Every option has a price. Prices are kept 10 minutes and checked again once a page, so a later
   * page may get this at once and again when fresh prices arrive. Not for toggles.
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
   * Packages one change added, after its `cart.updated`.
   * @group Carts
   */
  'cart.added': Cart & {
    /** What the change added. */
    changes: CartChange[];
  };
  /**
   * Packages one change removed, after its `cart.updated`.
   * @group Carts
   */
  'cart.removed': Cart & {
    /** What the change removed. */
    changes: CartChange[];
  };
  /**
   * The shipping method changed, once the cart is priced with it; without prices when the cart
   * cannot be priced (empty, before the campaign loads, or pricing failed). A bundle card can set
   * it on the landing page too.
   * @group Carts
   */
  'shipping.selected': ShippingMethod;
  /**
   * A code takes money off and is on the cart. A code entered while the cart is empty waits for the
   * cart's first price.
   * @group Coupons
   */
  'coupon.applied': {
    code: string;
    /** What the code takes off, once the cart is priced. */
    amount?: number;
    /** The cart's discounts that carry this code. */
    discounts?: Discount[];
  };
  /**
   * A code was taken off the cart.
   * @group Coupons
   */
  'coupon.removed': {
    code: string;
    /** `shopper`: removed with `removeCoupon` or the page. `cleared`: the cart was cleared. */
    reason: 'shopper' | 'cleared';
  };
  /**
   * A code is not applied.
   * @group Coupons
   */
  'coupon.denied': {
    code: string;
    /** `no_discount`: it takes nothing off this cart. `duplicate`: it is already on the cart. `check_failed`: it could not be checked. */
    reason: 'no_discount' | 'duplicate' | 'check_failed';
    /** For developers and logs, never for shoppers. */
    message?: string;
  };
  /**
   * Once per checkout, when its form is bound and the cart has lines, or when the cart first gets
   * lines after that; the steps of a multi-step checkout, a reload and a return from a payment
   * gateway keep the same checkout.
   * @group Checkout
   */
  'checkout.started': Checkout;
  /**
   * Once per tab until an order is paid, when the store saves the shopper with a new Open Cart:
   * what `data-next-lead` asks for is in (by default a first and last name and a valid email),
   * checked when the shopper leaves a field they changed. The store keeps the user for marketing,
   * as `accepts_marketing` allows, and the cart for `cart.abandoned`.
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
   * country requires is filled and valid, and so is each optional one filled. Checked when the
   * shopper leaves a field they changed, once the checkout has started.
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
   * The payment method changed.
   * @group Checkout
   */
  'payment.selected': Payment;
  /**
   * A step of a multi-step checkout passed its checks; the next step's page opens.
   * @group Checkout
   */
  'checkout.continued': Checkout;
  /**
   * Each submit that places the order, once its checks ran: the fields, then the card tokenized.
   * A valid submit is followed by `order.created`, `payment.redirected` or `checkout.failed`.
   * @group Checkout
   */
  'checkout.submitted': Checkout & {
    /** `true` when the order is being sent. */
    valid: boolean;
    /** What stopped it, by field name; empty when valid. */
    errors: Record<string, CheckoutError>;
  };
  /**
   * The order could not be placed: refused, declined, or the request failed. The shopper stays
   * on the checkout.
   * @group Checkout
   */
  'checkout.failed': Checkout & { error: Failure };
  /**
   * The shopper is about to leave for the payment gateway (PayPal, 3-D Secure, …) to pay the order
   * `ref_id`.
   * @group Payments
   */
  'payment.redirected': Payment & {
    /** The order being paid. */
    ref_id: string;
    /** The gateway page. */
    url: string;
  };
  /**
   * The shopper came back from the payment gateway unpaid; the cart is kept. Once per order.
   * @group Payments
   */
  'payment.failed': Payment & {
    /** The order the payment was for. */
    ref_id: string;
    error: Failure;
  };
  /**
   * The store created the order, paid. A payment at a gateway sends `payment.redirected` instead,
   * and the order comes with `order.loaded` once it is paid.
   * @group Orders
   */
  'order.created': Order;
  /**
   * A page after the checkout loaded the order; on every such page.
   * @group Orders
   */
  'order.loaded': Order;
  /**
   * The order is paid: once per order in this browser, after `order.loaded` on the first page that
   * loads it, the page after the checkout or after the payment gateway.
   * @group Orders
   */
  'order.paid': Order;
  /**
   * An upsell was added to the order, right after `upsell.accepted`.
   * @group Orders
   */
  'order.updated': Order;
  /**
   * An offer is on the page; once per offer.
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
   * Adding the offer failed, such as a decline.
   * @group Upsells
   */
  'upsell.failed': Upsell & { error: Failure };
  /**
   * The promotion is on screen: the popup opened, or half of a marked element is visible.
   * @group Promotions
   */
  'promotion.viewed': Promotion;
  /**
   * The promotion was clicked, before its action runs: an `apply-coupon` button then applies its code.
   * @group Promotions
   */
  'promotion.clicked': Promotion & {
    /** The template button's `data-exit-intent-action`, such as `apply-coupon`. */
    action?: string;
    /** The button's `data-coupon-code`. */
    coupon_code?: string;
  };
  /**
   * The popup closed; once for each `promotion.viewed` of a popup.
   * @group Promotions
   */
  'promotion.closed': Promotion & {
    /** `clicked`: after `promotion.clicked`. `dismissed`: Esc, the overlay, or the page removed the popup. `close_button`: the × button. */
    reason: 'clicked' | 'dismissed' | 'close_button';
  };
  /** @internal One tracking event under its GA4 name, for `next.analytics.on`. */
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
const STATE_SYNC: ReadonlySet<EventName> = new Set<EventName>([
  'cart.updated',
  'cart.calculating',
  'cart.calculated',
  'selector.calculating',
  'selector.calculated',
  'selector.updated',
]);

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
    if (this.buffer.length > BUFFER_SIZE) this.buffer.splice(this.oldestDroppable(), 1);
    this.queue.push(event);
    if (this.emitting) return;
    this.emitting = true;
    try {
      for (let next = this.queue.shift(); next; next = this.queue.shift()) {
        const current = next;
        [current.name, '*']
          .flatMap((key) => [...(this.listeners.get(key) ?? [])])
          .forEach((fn) => this.deliver(fn, current));
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
      this.buffer
        .filter((e) => (name === '*' || e.name === name) && !this.queue.includes(e))
        .forEach((e) => this.deliver(listener, e));
    return () => set.delete(listener);
  }

  private oldestDroppable(): number {
    const sync = this.buffer.findIndex((e) => STATE_SYNC.has(e.name));
    const other = this.buffer.findIndex((e) => e.name !== 'sdk.ready');
    return sync >= 0 ? sync : Math.max(0, other);
  }

  private deliver(fn: Listener, event: EngineEvent): void {
    try {
      fn(event);
    } catch (err) {
      this.log.error(`subscriber failed on ${event.name}`, err);
    }
  }
}
