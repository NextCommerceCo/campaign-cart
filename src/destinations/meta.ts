import type { Engine } from '../engine/engine';
import type { DestinationTrace, TrackingEvent, TrackingName } from '../engine/events/analytics';
import type { CartItem } from '../engine/events/carts';
import type { OrderItem } from '../engine/events/orders';
import { addDollars } from '../engine/format';

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
  Purchase: MetaContents & { value: number; currency: string };
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

type Line = CartItem | OrderItem;
type Win = Window & { fbq?: (...args: unknown[]) => void };

const linesOf = (e: TrackingEvent): Line[] => {
  switch (e.event_type) {
    case 'product_viewed':
    case 'product_added_to_cart':
      return [e.data];
    case 'checkout_started':
    case 'checkout_contact_info_submitted':
    case 'checkout_payment_info_submitted':
      return e.data.cart.lines;
    case 'checkout_completed':
      return e.data.lines.filter((l) => !l.upsell);
    case 'upsell_completed':
      return [e.data.upsell.line];
    default:
      return [];
  }
};

const idOf = (l: Line) => l.sku || String('package_id' in l ? l.package_id : (l.product_id ?? l.id));

const defined = <T extends object>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

const valueOf = (lines: Line[]) => {
  const priced = lines.filter((l) => l.price !== undefined);
  return priced.length ? addDollars(priced.map((l) => l.price! * l.quantity)) : undefined;
};

const currencyOf = (e: TrackingEvent) => {
  const data = e.data as { currency?: string; cart?: { currency?: string } };
  return data.currency ?? data.cart?.currency ?? e.context.campaign?.currency;
};

const contents = (e: TrackingEvent, lines: Line[]): MetaContents =>
  defined({
    content_ids: lines.map(idOf),
    contents: lines.map((l) => defined({ id: idOf(l), quantity: l.quantity, item_price: l.price })),
    content_type: 'product' as const,
    content_name: lines.length === 1 ? lines[0]!.product_title : undefined,
    value: valueOf(lines),
    currency: currencyOf(e),
  });

/** The Meta call a tracking event becomes, if any. */
export function metaEvent(e: TrackingEvent, options: MetaOptions = {}): MetaEvent | undefined {
  const name = META[e.event_type];
  if (!name) return undefined;
  const lines = linesOf(e);
  const event_id = e.event_id;
  if (name === 'Lead') return { name, params: defined({ value: valueOf(lines), currency: currencyOf(e) }), event_id };
  if (name === 'InitiateCheckout') {
    const num_items = lines.reduce((n, l) => n + l.quantity, 0);
    return { name, params: { ...contents(e, lines), num_items }, event_id };
  }
  if (e.event_type === 'checkout_completed' || e.event_type === 'upsell_completed') {
    const order = e.event_type === 'checkout_completed';
    const params = { ...contents(e, lines), value: valueOf(lines) ?? 0, currency: currencyOf(e) ?? 'USD' };
    const id = order && options.storeName ? `${options.storeName}-${e.data.number ?? e.data.ref_id}` : event_id;
    return { name: 'Purchase', params, event_id: id };
  }
  return { name: name as 'ViewContent' | 'AddToCart' | 'AddPaymentInfo', params: contents(e, lines), event_id };
}

/** Sends every tracking event of this page, and each later one, to the page's `fbq`. */
export function startMeta(engine: Engine, options: MetaOptions = {}): void {
  let warned = false;
  engine.on(
    'analytics',
    ({ data: e }) => {
      const meta = metaEvent(e, options);
      if (!meta) return;
      const fbq = (window as Win).fbq;
      if (typeof fbq !== 'function') {
        if (!warned)
          engine.log.warn(
            "Meta destination is on but the page has no Meta Pixel (fbq); add the pixel's base code. Events before it loads are not sent",
          );
        warned = true;
        return;
      }
      try {
        fbq('track', meta.name, meta.params, { eventID: meta.event_id });
        engine.log.debug(`destination meta ${meta.name} sent`, {
          trace: 'destination',
          destination: 'meta',
          name: meta.name,
          tracking: e.event_type,
          event_id: e.event_id,
          payload: { params: meta.params, eventID: meta.event_id },
        } satisfies DestinationTrace);
      } catch (err) {
        engine.log.error('Meta destination failed', err);
      }
    },
    { replay: true },
  );
}
