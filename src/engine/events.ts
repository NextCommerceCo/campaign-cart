import type { Logger } from './log';
import type { Attribution } from './attribution';
import type { Line, CartSummary } from './cart/types';
import type { Campaign, CheckoutError, OpenCart, Order, OrderLine } from './types';

export interface PromotionDetail {
  /** Which promotion: `exit_intent` is the exit-intent popup, the only one so far. */
  source: 'exit_intent';
  /** The popup's image, when it shows one. */
  image_url?: string;
  /** The `template[data-template]` the popup shows, when it uses one. */
  template?: string;
}

export type AddressType = 'shipping' | 'billing';

export interface Contact {
  /** As typed, trimmed. */
  email: string;
  first_name: string;
  last_name: string;
  /** In E.164 once the address service read it, else the digits typed. */
  phone?: string;
}

export type SelectorType = 'bundle' | 'offer' | 'toggle';

/** A package added to or removed from the cart, and the price it was charged. */
export interface CartChangeLine {
  /** The package's `ref_id` in the campaign. */
  package_id: number;
  /** How many packages were added or removed. */
  quantity: number;
  /** Unit price after discounts, as the server priced it ({@link SummaryLine}'s `unit_price`). */
  unit_price: string;
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

export interface AnalyticsContext {
  page_location: string;
  page_title: string;
  page_referrer: string;
  campaign_name?: string;
  campaign_currency?: string;
  campaign_language?: string;
  attribution: Attribution;
}

export interface AnalyticsEvent {
  name: AnalyticsName;
  id: string;
  time: string;
  params: Record<string, unknown>;
  context: AnalyticsContext;
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
   * Once, when the campaign and the page's values are in. `ready` is the same event, and it
   * reaches listeners added after it fired.
   * @group SDK
   */
  'sdk.ready': {
    /** The cart's lines at that moment. */
    lines: Line[];
  };
  /**
   * An action failed.
   * @group SDK
   */
  'sdk.error': {
    /** `load`, `calculate`, `quote`, `coupon`, `order`, `upsell`, or `storage` (blocked or full). */
    action: string;
    message: string;
  };
  /** @internal */
  'campaign.loaded': { campaign: Campaign; fromCache: boolean };
  /**
   * A card is picked, its quantity or a slot changed, or a toggle is switched on.
   * @group Selectors
   */
  'selector.selected': {
    /** `data-next-selector-id`, or the toggle's group. */
    selector_id: string;
    type: SelectorType;
    /** The picked card's id; none for a toggle. */
    card_id?: string;
    /** The lines the selection puts in the cart, at the card's quantity. */
    lines: Line[];
  };
  /**
   * A toggle is switched off.
   * @group Selectors
   */
  'selector.deselected': { selector_id: string; type: SelectorType };
  /**
   * Pricing the cards that have no quote yet starts.
   * @group Selectors
   */
  'selector.calculating': { selector_id: string; type: SelectorType };
  /**
   * Every card has a price. Quotes are kept 10 minutes, so a later page may get this at once.
   * @group Selectors
   */
  'selector.calculated': {
    selector_id: string;
    type: SelectorType;
    /** Each card's server price, by card id. */
    quotes: Record<string, CartSummary>;
    /** `true` when every quote came from the 10-minute cache. */
    from_cache: boolean;
  };
  /**
   * Lines, coupons or shipping changed, at once, before the server prices them.
   * @group Carts
   */
  'cart.updated': {
    /** Every line in the cart, the same package's lines merged. */
    lines: Line[];
    /** The codes the shopper applied, uppercase. A bundle card's own codes are not listed. */
    coupons: string[];
    /** The picked shipping method's `ref_id`. */
    shipping_method_id?: number;
  };
  /**
   * Pricing starts; once for a burst of changes.
   * @group Carts
   */
  'cart.calculating': {
    /** The lines being priced. */
    lines: Line[];
  };
  /**
   * Server totals arrived.
   * @group Carts
   */
  'cart.calculated': {
    /** Lines, discounts, shipping and totals, as the server priced them. */
    summary: CartSummary;
  };
  /**
   * Packages the page added since the last price, net, just before `cart.calculated`. A `+ + −`
   * within one price run sends one event for the net change; `+` then `−` sends none.
   * @group Carts
   */
  'cart.added': {
    lines: CartChangeLine[];
    /** `false` when pricing failed: `unit_price` is then the package price. */
    priced: boolean;
  };
  /**
   * Packages the page removed since the last price, at the price they had.
   * @group Carts
   */
  'cart.removed': { lines: CartChangeLine[]; priced: boolean };
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
   * Once, when the checkout form is bound with a cart.
   * @group Checkout
   */
  'checkout.started': { lines: Line[] };
  /**
   * Once per tab, when the store creates the Cart: a valid email and a first and last name are
   * in, checked when the shopper leaves a field. It is the Cart in the dashboard's Open Carts,
   * and later `cart.abandoned`.
   * @group Checkout
   */
  'contact.entered': Contact & {
    /** The Cart the store created. */
    cart: OpenCart;
  };
  /**
   * The contact changed after `contact.entered` and is still valid. The Open Cart keeps the first
   * contact.
   * @group Checkout
   */
  'contact.updated': Contact;
  /**
   * Once per `type`, when that address is valid: every field its country requires is filled and
   * valid, and so is each optional one filled. Checked when the shopper leaves a field.
   * @group Checkout
   */
  'address.entered': {
    /** `billing` only when the billing address is separate from the shipping one. */
    type: AddressType;
    /** ISO 3166-1 alpha-2. */
    country: string;
  };
  /**
   * The address changed after `address.entered` and is still valid.
   * @group Checkout
   */
  'address.updated': { type: AddressType; country: string };
  /**
   * A shipping method was picked. A bundle card can set it on the landing page too.
   * @group Checkout
   */
  'shipping.selected': {
    /** The method's `ref_id`; none when it was cleared. */
    method_id: number | undefined;
    method?: { ref_id: number; code: string; price: string };
  };
  /**
   * The payment method changed.
   * @group Checkout
   */
  'payment.selected': {
    /** The API's code: `card_token`, `paypal`, `apple_pay`, `google_pay`, `klarna`, … */
    method: string;
  };
  /**
   * Each submit, once its checks ran: the fields, then the card tokenized. A valid submit is
   * followed by `order.created` or `order.failed`.
   * @group Checkout
   */
  'checkout.submitted': {
    payment_method: string;
    /** `true` when the order is being sent. */
    valid: boolean;
    /** What stopped it, by field name; empty when valid. */
    errors: Record<string, CheckoutError>;
  };
  /**
   * The order was created.
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
    /** The transaction id when this page reports the purchase: once, only when paid. */
    purchase?: string;
    coupon?: string;
    /** Accepted upsells not reported yet. */
    upsells?: Array<{ id: string; number: number; line: OrderLine }>;
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

let sequence = 0;
const eventId = () =>
  `evt_${Date.now().toString(36)}${(sequence++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

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
    const event: EngineEvent = { id: eventId(), name, data, at: Date.now() };
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
