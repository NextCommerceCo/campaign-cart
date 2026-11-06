import type { Engine } from '../engine/engine';
import type { DestinationTrace, TrackingEvent, TrackingName } from '../engine/events/analytics';
import type { CartItem } from '../engine/events/carts';
import type { OrderItem } from '../engine/events/orders';
import { addDollars } from '../engine/format';
import { untaxed } from '../engine/order';

/**
 * One product of a GA4 event's `items`.
 * @see https://developers.google.com/analytics/devguides/collection/ga4/reference/events?client_type=gtag#add_to_cart_item
 */
export interface Ga4Item {
  /** The line's SKU, else its package id. */
  item_id: string;
  item_name?: string;
  item_variant?: string;
  /** What one unit costs, after discounts. */
  price?: number;
  /** The discount on one unit. */
  discount?: number;
  quantity: number;
  /** Position in `items`, from 0. */
  index: number;
}

/**
 * The parameters GA4's ecommerce events share.
 * @see https://developers.google.com/analytics/devguides/collection/ga4/reference/events?client_type=gtag
 */
export interface Ga4Ecommerce {
  /** ISO 4217, such as `USD`. */
  currency?: string;
  /** Σ `price × quantity` of `items`. */
  value?: number;
  /** The first code the shopper applied. */
  coupon?: string;
  items: Ga4Item[];
}

/** An order or one accepted upsell, as GA4 counts revenue. */
export interface Ga4Purchase extends Ga4Ecommerce {
  /** The tracking event's `event_id`: the order number, or `<ref_id>-US<n>` for an upsell. */
  transaction_id: string;
  value: number;
  currency: string;
  shipping?: number;
  tax?: number;
}

/**
 * GA4 events the GA4 destination sends, as `gtag('event', name, params)` takes them. The last three
 * have no GA4 equivalent and arrive as custom events; an accepted upsell is a `purchase` of its own.
 * @see https://developers.google.com/analytics/devguides/collection/ga4/reference/events?client_type=gtag
 */
export interface Ga4EventMap {
  /**
   * A product the shopper sees.
   * @see https://developers.google.com/analytics/devguides/collection/ga4/reference/events?client_type=gtag#view_item
   */
  view_item: Ga4Ecommerce;
  /**
   * The products a page shows.
   * @see https://developers.google.com/analytics/devguides/collection/ga4/reference/events?client_type=gtag#view_item_list
   */
  view_item_list: Ga4Ecommerce & { item_list_id?: string; item_list_name?: string };
  /**
   * A product added to the cart.
   * @see https://developers.google.com/analytics/devguides/collection/ga4/reference/events?client_type=gtag#add_to_cart
   */
  add_to_cart: Ga4Ecommerce;
  /**
   * A product removed from the cart.
   * @see https://developers.google.com/analytics/devguides/collection/ga4/reference/events?client_type=gtag#remove_from_cart
   */
  remove_from_cart: Ga4Ecommerce;
  /**
   * The checkout started.
   * @see https://developers.google.com/analytics/devguides/collection/ga4/reference/events?client_type=gtag#begin_checkout
   */
  begin_checkout: Ga4Ecommerce;
  /**
   * The shopper left their contact details.
   * @see https://developers.google.com/analytics/devguides/collection/ga4/reference/events?client_type=gtag#generate_lead
   */
  generate_lead: { currency?: string; value?: number; lead_source: 'checkout' };
  /**
   * The shipping address or method was given.
   * @see https://developers.google.com/analytics/devguides/collection/ga4/reference/events?client_type=gtag#add_shipping_info
   */
  add_shipping_info: Ga4Ecommerce & { shipping_tier?: string };
  /**
   * The payment details were submitted.
   * @see https://developers.google.com/analytics/devguides/collection/ga4/reference/events?client_type=gtag#add_payment_info
   */
  add_payment_info: Ga4Ecommerce & { payment_type?: string };
  /**
   * An order was paid: the order, or one accepted upsell with its own `transaction_id`.
   * @see https://developers.google.com/analytics/devguides/collection/ga4/reference/events?client_type=gtag#purchase
   */
  purchase: Ga4Purchase;
  /**
   * A promotion was shown.
   * @see https://developers.google.com/analytics/devguides/collection/ga4/reference/events?client_type=gtag#view_promotion
   */
  view_promotion: { promotion_id: string; promotion_name?: string; creative_name?: string };
  /**
   * A promotion was clicked.
   * @see https://developers.google.com/analytics/devguides/collection/ga4/reference/events?client_type=gtag#select_promotion
   */
  select_promotion: { promotion_id: string; promotion_name?: string; creative_name?: string };
  /** Custom: the cart after a price update. */
  update_cart: Ga4Ecommerce;
  /** Custom: an upsell offer was shown. */
  view_upsell: { order_id: string; currency?: string; value?: number; items: Ga4Item[] };
  /** Custom: an upsell offer was skipped. */
  skip_upsell: { order_id: string; currency?: string; value?: number; items: Ga4Item[] };
}

export type Ga4Name = keyof Ga4EventMap;

export type Ga4Event<K extends Ga4Name = Ga4Name> = {
  [N in K]: { name: N; params: Ga4EventMap[N] };
}[K];

/** The GA4 event each tracking event is sent as. `page_viewed` is not: `gtag('config')` sends GA4's own. */
export const GA4: Partial<Record<TrackingName, Ga4Name>> = {
  product_viewed: 'view_item',
  product_list_viewed: 'view_item_list',
  product_added_to_cart: 'add_to_cart',
  product_removed_from_cart: 'remove_from_cart',
  cart_updated: 'update_cart',
  checkout_started: 'begin_checkout',
  checkout_contact_info_submitted: 'generate_lead',
  checkout_shipping_address_submitted: 'add_shipping_info',
  checkout_shipping_method_submitted: 'add_shipping_info',
  checkout_payment_info_submitted: 'add_payment_info',
  checkout_completed: 'purchase',
  upsell_completed: 'purchase',
  upsell_viewed: 'view_upsell',
  upsell_skipped: 'skip_upsell',
  promotion_viewed: 'view_promotion',
  promotion_selected: 'select_promotion',
};

type Line = CartItem | OrderItem;
type Win = Window & { gtag?: (...args: unknown[]) => void };

const linesOf = (e: TrackingEvent): Line[] => {
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
      return e.data.lines.filter((l) => !l.upsell).map(untaxed);
    case 'upsell_completed':
      return [untaxed(e.data.upsell.line)];
    default:
      return [];
  }
};

const defined = <T extends object>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

const item = (l: Line, index: number): Ga4Item => {
  const discount = l.price !== undefined && l.original_price !== undefined ? l.original_price - l.price : 0;
  return defined({
    item_id: l.sku || String('package_id' in l ? l.package_id : (l.product_id ?? l.id)),
    item_name: l.product_title,
    item_variant: l.variant_title,
    price: l.price,
    discount: discount > 0 ? addDollars([discount]) : undefined,
    quantity: l.quantity,
    index,
  });
};

const valueOf = (lines: Line[]) => {
  const priced = lines.filter((l) => l.price !== undefined);
  return priced.length ? addDollars(priced.map((l) => l.price! * l.quantity)) : undefined;
};

const currencyOf = (e: TrackingEvent) => {
  const data = e.data as { currency?: string; cart?: { currency?: string } };
  return data.currency ?? data.cart?.currency ?? e.context.campaign?.currency;
};

const ecommerce = (e: TrackingEvent, lines = linesOf(e)): Ga4Ecommerce => {
  const data = e.data as { coupons?: string[]; cart?: { coupons?: string[] } };
  return defined({
    currency: currencyOf(e),
    value: valueOf(lines),
    coupon: (data.coupons ?? data.cart?.coupons)?.[0],
    items: lines.map(item),
  });
};

/** The `gtag` call a tracking event becomes, if any. */
export function ga4Event(e: TrackingEvent): Ga4Event | undefined {
  switch (e.event_type) {
    case 'checkout_contact_info_submitted':
      return {
        name: 'generate_lead',
        params: defined({ currency: currencyOf(e), value: valueOf(linesOf(e)), lead_source: 'checkout' as const }),
      };
    case 'checkout_shipping_address_submitted':
    case 'checkout_shipping_method_submitted':
      return {
        name: 'add_shipping_info',
        params: defined({ ...ecommerce(e), shipping_tier: e.data.cart.shipping_method?.name }),
      };
    case 'checkout_payment_info_submitted': {
      const method = e.data.payment_method;
      const payment_type = method === 'card_token' ? 'Credit Card' : method;
      return { name: 'add_payment_info', params: defined({ ...ecommerce(e), payment_type }) };
    }
    case 'checkout_completed': {
      const base = ecommerce(e);
      const method = e.data.shipping_method;
      const params = defined({
        ...base,
        transaction_id: e.event_id,
        value: base.value ?? 0,
        currency: base.currency ?? 'USD',
        shipping: method?.price === undefined ? undefined : addDollars([method.price, -(method.tax ?? 0)]),
        tax: e.data.tax,
      });
      return { name: 'purchase', params };
    }
    case 'upsell_completed': {
      const { items, value = 0, currency = 'USD' } = ecommerce(e);
      return { name: 'purchase', params: { transaction_id: e.event_id, value, currency, items } };
    }
    case 'product_list_viewed':
      return {
        name: 'view_item_list',
        params: { ...ecommerce(e), item_list_id: 'product_list', item_list_name: 'Product List' },
      };
    case 'upsell_viewed':
    case 'upsell_skipped': {
      const { items, value, currency } = ecommerce(e);
      const name = e.event_type === 'upsell_viewed' ? 'view_upsell' : 'skip_upsell';
      return { name, params: defined({ order_id: e.data.ref_id, currency, value, items }) };
    }
    case 'promotion_viewed':
    case 'promotion_selected': {
      const { id, name, creative } = e.data;
      const params = defined({ promotion_id: id, promotion_name: name, creative_name: creative });
      return { name: e.event_type === 'promotion_viewed' ? 'view_promotion' : 'select_promotion', params };
    }
    case 'page_viewed':
      return undefined;
    default:
      return { name: GA4[e.event_type] as 'view_item', params: ecommerce(e) };
  }
}

/** Sends every tracking event of this page, and each later one, to the page's `gtag`. */
export function startGa4(engine: Engine): void {
  let warned = false;
  engine.on(
    'analytics',
    ({ data: e }) => {
      const ga4 = ga4Event(e);
      if (!ga4) return;
      const gtag = (window as Win).gtag;
      if (typeof gtag !== 'function') {
        if (!warned)
          engine.log.warn(
            "GA4 destination is on but the page has no Google tag (gtag); add the tag's base code. Events before it loads are not sent",
          );
        warned = true;
        return;
      }
      try {
        gtag('event', ga4.name, ga4.params);
        engine.log.debug(`destination ga4 ${ga4.name} sent`, {
          trace: 'destination',
          destination: 'ga4',
          name: ga4.name,
          tracking: e.event_type,
          event_id: e.event_id,
          payload: ga4.params,
        } satisfies DestinationTrace);
      } catch (err) {
        engine.log.error('GA4 destination failed', err);
      }
    },
    { replay: true },
  );
}
