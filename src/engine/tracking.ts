import type { DestinationTrace, TrackingEvent, TrackingLine } from './events/analytics';
import type { Checkout } from './events/checkout';
import type { Promotion } from './events/promotions';
import type { Engine } from './engine';
import { addDollars, dollars } from './format';
import type { ApiOrder, ApiOrderLine, Package } from './types';

/** Where a destination looks up a cart line's package. */
export type Packages = Pick<Engine, 'getPackage'>;

/**
 * Lines counted in units of product, as order lines already are: a cart line of a package of `qty` units is
 * `quantity × qty` units at `price ÷ qty`.
 */
export const perUnit = <L extends TrackingLine>(lines: L[], packages?: Packages): L[] =>
  lines.map((l) => {
    const units = ('package_id' in l && packages?.getPackage(l.package_id)?.qty) || 1;
    if (units === 1) return l;
    return {
      ...l,
      quantity: l.quantity * units,
      ...(l.price !== undefined && { price: dollars(l.price / units) }),
      ...(l.original_price !== undefined && { original_price: dollars(l.original_price / units) }),
    };
  });

/** `Σ price × quantity` of the priced lines; none when no line is priced. */
export const trackingValue = (lines: Array<{ price?: number; quantity: number }>): number | undefined => {
  const priced = lines.filter((l) => l.price !== undefined);
  return priced.length ? addDollars(priced.map((l) => l.price! * l.quantity)) : undefined;
};

export const trackingCurrency = (e: TrackingEvent): string | undefined => {
  const data = e.data as { currency?: string; cart?: { currency?: string } };
  return data.currency ?? data.cart?.currency ?? e.context.campaign?.currency;
};

/** A line's SKU, else its package id (a cart line) or product id, else its order line id. */
export const trackingLineId = (l: TrackingLine): string =>
  l.sku || String('package_id' in l ? l.package_id : (l.product_id ?? l.id));

/** The object without its `undefined` fields, as vendor payloads are sent. */
export const defined = <T extends object>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

/** The list a page's products are viewed in. */
export const PRODUCT_LIST = { id: 'product_list', name: 'Product List' } as const;

export const promotionFields = ({ id, name, creative }: Promotion) => ({
  promotion_id: id,
  ...(name && { promotion_name: name }),
  creative_name: creative,
});

/** The shipping method's name, `Standard` before one is picked. */
export const shippingTier = (checkout: Checkout): string => checkout.cart.shipping_method?.name ?? 'Standard';

/** The package an upsell event is about: the page for a shown offer, else the skipped package. */
export const upsellPackage = (packages: Packages, e: TrackingEvent<'upsell_viewed' | 'upsell_skipped'>) => {
  if (e.event_type === 'upsell_viewed') return { id: 'page_view', name: 'Upsell Page View' };
  const id = e.data.lines[0]?.package_id;
  if (!id) return { id: 'unknown', name: 'Unknown Package' };
  return { id: String(id), name: packages.getPackage(id)?.name ?? `Package ${id}` };
};

/** The order as the Campaigns API returned it, for the prices before tax the public Order leaves out. */
export const apiOrder = (engine: Pick<Engine, 'getState'>, refId: string): ApiOrder | undefined => {
  const { paidOrder, order } = engine.getState().order ?? {};
  return [paidOrder, order].find((o) => o?.ref_id === refId);
};

/**
 * @deprecated 0.4.x tax basis of the `dl_*` and RudderStack order prices: tax included when a line's
 * price before discounts with tax is nearer its package's price than the one without. The `order.*`
 * events carry `tax` on each line and shipping instead.
 */
export const taxIncluded = (packages: Packages, order: ApiOrder): boolean => {
  for (const line of order.lines ?? []) {
    const catalog = Number(packages.getPackage(line.package ?? 0)?.price);
    const qty = line.quantity || 1;
    const incl = Number(line.price_incl_tax_excl_discounts) / qty;
    const excl = Number(line.price_excl_tax_excl_discounts) / qty;
    if (!(catalog > 0) || !Number.isFinite(incl) || !Number.isFinite(excl) || Math.abs(incl - excl) <= 0.02) continue;
    return Math.abs(incl - catalog) < Math.abs(excl - catalog);
  }
  return false;
};

/** What one unit of an API order line cost after discounts, with tax or without. */
export const paidUnit = (line: ApiOrderLine, incl: boolean): number =>
  Number(incl ? line.price_incl_tax : line.price_excl_tax) / (line.quantity || 1);

/** An order line's product, its package filling in what the line lacks; `SKU-<product id>` as the id without a SKU. */
export const orderLineProduct = (
  line: { id: string | number; product_id?: number | null; variant_title?: string; image?: string },
  sku: string | undefined,
  pkg: Package | undefined,
  campaign: string | undefined,
) => {
  const code = sku || pkg?.product_sku;
  return {
    sku: code,
    id: code || `SKU-${line.product_id || line.id}`,
    product_id: line.product_id ?? pkg?.product_id,
    brand: pkg?.product_name || campaign,
    variant: line.variant_title || pkg?.product_variant_name,
    image: line.image || pkg?.image,
  };
};

/** How one destination turns tracking events into calls on a vendor's page script. */
export interface Destination<V, C> {
  destination: DestinationTrace['destination'];
  /** The vendor's page script, when the page has one that can take calls. */
  vendor: () => V | undefined;
  /** Logged once while `vendor` returns nothing. */
  missing: string;
  /** Logged with the error of a call that throws. */
  failed: string;
  /** The vendor calls a tracking event becomes; none skips it. */
  calls: (e: TrackingEvent) => C[];
  send: (vendor: V, call: C) => void;
  /** What a sent call logs: `destination <destination> <label ?? name> sent`. */
  trace: (call: C) => { name: string; label?: string; payload: unknown };
  /** Runs `flush` now or once the vendor's script is ready; the default runs it now. */
  ready?: (vendor: V, flush: (vendor: V) => void) => void;
}

/** Sends every tracking event of this page, and each later one, through a destination. */
export function startDestination<V, C>(engine: Engine, d: Destination<V, C>): void {
  let warned = false;
  engine.on(
    'analytics',
    ({ data: e }) => {
      const calls = d.calls(e);
      if (!calls.length) return;
      const vendor = d.vendor();
      if (vendor === undefined) {
        if (!warned) engine.log.warn(d.missing);
        warned = true;
        return;
      }
      const flush = (v: V) => {
        for (const call of calls) {
          try {
            d.send(v, call);
            const { name, label = name, payload } = d.trace(call);
            engine.log.debug(`destination ${d.destination} ${label} sent`, {
              trace: 'destination',
              destination: d.destination,
              name,
              tracking: e.event_type,
              event_id: e.event_id,
              payload,
            } satisfies DestinationTrace);
          } catch (err) {
            engine.log.error(d.failed, err);
          }
        }
      };
      if (d.ready) d.ready(vendor, flush);
      else flush(vendor);
    },
    { replay: true },
  );
}
