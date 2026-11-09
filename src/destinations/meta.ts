import type { Engine } from '../engine/engine';
import {
  defined,
  trackingCurrency,
  trackingLineId,
  trackingLines,
  trackingValue,
  type Packages,
  perUnit,
  startDestination,
  type TrackingEvent,
  type TrackingLine,
  type TrackingName,
} from '../engine/events/analytics';

/** One product of a Meta event's `contents`. */
export interface MetaContent {
  /** The line's SKU, else its package id. */
  id: string;
  quantity: number;
  /** What one unit costs, when the line is priced. */
  item_price?: number;
}

/**
 * The parameters Meta's ecommerce standard events share.
 * @see https://developers.facebook.com/docs/meta-pixel/reference#object-properties
 */
export interface MetaContents {
  /** The lines' SKUs, else their package ids. */
  content_ids: string[];
  contents: MetaContent[];
  content_type: 'product';
  /** The product name, when the event is about one product. */
  content_name?: string;
  /** What the lines cost. */
  value?: number;
  /** ISO 4217, such as `USD`. */
  currency?: string;
}

/**
 * Meta Pixel standard events the Meta destination sends, as `fbq('track', name, params, { eventID })`
 * takes them.
 * @see https://developers.facebook.com/docs/meta-pixel/reference#standard-events
 */
export interface MetaEventMap {
  /**
   * A product the shopper sees.
   * @see https://developers.facebook.com/docs/meta-pixel/reference#standard-events
   */
  ViewContent: MetaContents;
  /**
   * A product added to the cart.
   * @see https://developers.facebook.com/docs/meta-pixel/reference#standard-events
   */
  AddToCart: MetaContents;
  /**
   * The checkout started.
   * @see https://developers.facebook.com/docs/meta-pixel/reference#standard-events
   */
  InitiateCheckout: MetaContents & {
    /** How many units the cart holds. */
    num_items: number;
  };
  /**
   * The shopper left their contact details.
   * @see https://developers.facebook.com/docs/meta-pixel/reference#standard-events
   */
  Lead: { value?: number; currency?: string };
  /**
   * The payment details were submitted.
   * @see https://developers.facebook.com/docs/meta-pixel/reference#standard-events
   */
  AddPaymentInfo: MetaContents;
  /**
   * An order was paid: the order, or one accepted upsell.
   * @see https://developers.facebook.com/docs/meta-pixel/reference#standard-events
   */
  Purchase: MetaContents & { value: number };
}

export type MetaName = keyof MetaEventMap;

/**
 * One Meta call. `event_id` is the tracking event's, sent as `eventID` so a Conversions API event
 * with the same id is counted once.
 * @see https://developers.facebook.com/docs/marketing-api/conversions-api/deduplicate-pixel-and-server-events
 */
export type MetaEvent<K extends MetaName = MetaName> = {
  [N in K]: { name: N; params: MetaEventMap[N]; event_id: string };
}[K];

/** The Meta event each tracking event is sent as; the others are not sent. */
export const META: Partial<Record<TrackingName, MetaName>> = {
  product_viewed: 'ViewContent',
  product_added_to_cart: 'AddToCart',
  checkout_started: 'InitiateCheckout',
  checkout_contact_info_submitted: 'Lead',
  checkout_payment_info_submitted: 'AddPaymentInfo',
  checkout_completed: 'Purchase',
  upsell_completed: 'Purchase',
};

export interface MetaOptions {
  /** With a store name, `Purchase` of an order is sent with `eventID: '<storeName>-<order number>'`, the id the store's server-side events use. */
  storeName?: string;
}

type Win = Window & { fbq?: (...args: unknown[]) => void };

const contents = (e: TrackingEvent, lines: TrackingLine[], units: TrackingLine[]): MetaContents =>
  defined({
    content_ids: lines.map(trackingLineId),
    contents: units.map((l) => defined({ id: trackingLineId(l), quantity: l.quantity, item_price: l.price })),
    content_type: 'product' as const,
    content_name: lines.length === 1 ? lines[0]!.product_title : undefined,
    value: trackingValue(lines),
    currency: trackingCurrency(e),
  });

/** The Meta call a tracking event becomes, if any; `contents` count units of product, looked up in `packages`. */
export function metaEvent(e: TrackingEvent, options: MetaOptions = {}, packages?: Packages): MetaEvent | undefined {
  const name = META[e.event_type];
  if (!name) return undefined;
  const lines = trackingLines(e);
  const units = perUnit(lines, packages);
  const event_id = e.event_id;
  if (name === 'Lead')
    return { name, params: defined({ value: trackingValue(lines), currency: trackingCurrency(e) }), event_id };
  if (name === 'InitiateCheckout') {
    const num_items = units.reduce((n, l) => n + l.quantity, 0);
    return { name, params: { ...contents(e, lines, units), num_items }, event_id };
  }
  if (e.event_type === 'checkout_completed' || e.event_type === 'upsell_completed') {
    const order = e.event_type === 'checkout_completed';
    const params = { ...contents(e, lines, units), value: trackingValue(lines) ?? 0 };
    const id = order && options.storeName ? `${options.storeName}-${e.data.number ?? e.data.ref_id}` : event_id;
    return { name: 'Purchase', params, event_id: id };
  }
  return { name: name as 'ViewContent' | 'AddToCart' | 'AddPaymentInfo', params: contents(e, lines, units), event_id };
}

/** Sends every tracking event of this page, and each later one, to the page's `fbq`. */
export function startMeta(engine: Engine, options: MetaOptions = {}): void {
  startDestination(engine, {
    destination: 'meta',
    vendor: () => {
      const fbq = (window as Win).fbq;
      return typeof fbq === 'function' ? fbq : undefined;
    },
    missing:
      "Meta destination is on but the page has no Meta Pixel (fbq); add the pixel's base code. Events before it loads are not sent",
    failed: 'Meta destination failed',
    calls: (e) => {
      const meta = metaEvent(e, options, engine);
      return meta ? [meta] : [];
    },
    send: (fbq, meta) => fbq('track', meta.name, meta.params, { eventID: meta.event_id }),
    trace: (meta) => ({ name: meta.name, payload: { params: meta.params, eventID: meta.event_id } }),
  });
}
