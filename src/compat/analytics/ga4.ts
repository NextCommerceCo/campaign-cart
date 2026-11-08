import type { Engine } from '../../engine/engine';
import type { Cart, CartItem } from '../../engine/events/carts';
import { dollars } from '../../engine/format';
import type { ApiOrder, ApiOrderLine } from '../../engine/types';

export const currency = (engine: Engine) =>
  engine.getState().cart.summary?.currency ?? engine.getState().campaign?.currency ?? 'USD';

const ids = (product?: number, variant?: number) => ({
  ...(product != null && { item_product_id: String(product) }),
  ...(variant != null && { item_variant_id: String(variant) }),
});

export const valueOf = (items: Array<{ price: number; quantity: number }>) =>
  dollars(items.reduce((n, i) => n + i.price * i.quantity, 0));

/** A GA4 item from a cart line: unit prices, `quantity` in units. */
const item = (engine: Engine, line: CartItem, index: number) => {
  const pkg = engine.getPackage(line.package_id);
  if (!pkg) return undefined;
  const units = pkg.qty || 1;
  const price = line.price === undefined ? Number(pkg.price) : dollars(line.price / units);
  const before =
    (line.original_price === undefined ? 0 : dollars(line.original_price / units)) || Number(pkg.price_retail) || 0;
  return {
    item_id: pkg.product_sku || String(pkg.external_id),
    item_name: pkg.product_name || pkg.name,
    item_category: engine.getState().campaign?.name,
    ...(pkg.product_variant_name && { item_variant: pkg.product_variant_name }),
    ...ids(pkg.product_id, pkg.product_variant_id),
    ...(pkg.product_sku && { item_sku: pkg.product_sku }),
    item_image: pkg.image,
    price,
    ...(before > price && { discount: dollars(before - price) }),
    quantity: units * line.quantity,
    currency: currency(engine),
    index,
  };
};

export const ecommerce = (engine: Engine, lines: CartItem[]) => {
  const items = lines.map((l, i) => item(engine, l, i)).filter((i): i is NonNullable<typeof i> => !!i);
  return { currency: currency(engine), value: valueOf(items), items };
};

export const cartEcommerce = (engine: Engine, cart: Cart) => {
  const [coupon] = cart.coupons;
  const shipping = cart.shipping_method?.price;
  return {
    ...ecommerce(engine, cart.lines),
    ...(coupon && { coupon }),
    ...(shipping !== undefined && { shipping }),
  };
};

/**
 * @deprecated 0.4.x tax basis of the `dl_*` prices: tax included when a line's price before
 * discounts with tax is nearer its package's price than the one without. The `order.*` events
 * carry `tax` on each line and shipping instead.
 */
export const taxIncluded = (engine: Engine, order: ApiOrder) => {
  for (const line of order.lines ?? []) {
    const catalog = Number(engine.getPackage(line.package ?? 0)?.price);
    const qty = line.quantity || 1;
    const incl = Number(line.price_incl_tax_excl_discounts) / qty;
    const excl = Number(line.price_excl_tax_excl_discounts) / qty;
    if (!(catalog > 0) || !Number.isFinite(incl) || !Number.isFinite(excl) || Math.abs(incl - excl) <= 0.02) continue;
    return Math.abs(incl - catalog) < Math.abs(excl - catalog);
  }
  return false;
};

export const orderItem = (engine: Engine, order: ApiOrder, line: ApiOrderLine, index: number, incl: boolean) => {
  const qty = line.quantity || 1;
  const paid = Number(incl ? line.price_incl_tax : line.price_excl_tax) / qty;
  const listed = Number(incl ? line.price_incl_tax_excl_discounts : line.price_excl_tax_excl_discounts) / qty;
  const pkg = line.package ? engine.getPackage(line.package) : undefined;
  const campaign = engine.getState().campaign?.name;
  const sku = line.product_sku || pkg?.product_sku;
  const variant = line.variant_title || pkg?.product_variant_name;
  const image = line.image || pkg?.image;
  return {
    item_id: sku || `SKU-${line.product_id || line.id}`,
    item_name: line.product_title,
    item_brand: pkg?.product_name || campaign,
    item_category: campaign,
    ...(variant && { item_variant: variant }),
    ...ids(line.product_id ?? pkg?.product_id, line.variant_id ?? pkg?.product_variant_id),
    ...(sku && { item_sku: sku }),
    ...(image && { item_image: image }),
    price: dollars(paid),
    ...(listed > paid && { discount: dollars(listed - paid) }),
    quantity: line.quantity,
    currency: order.currency ?? currency(engine),
    index,
  };
};

/** GA4's `purchase` params from the order as the Campaigns API returned it, without its upsell lines. */
export const purchase = (engine: Engine, order: ApiOrder, transaction: string, coupon?: string) => {
  const incl = taxIncluded(engine, order);
  const items = (order.lines ?? []).filter((l) => !l.is_upsell).map((l, i) => orderItem(engine, order, l, i, incl));
  const discount = Number(order.total_discounts ?? 0);
  return {
    currency: order.currency ?? currency(engine),
    transaction_id: transaction,
    value: valueOf(items),
    tax: Number(order.total_tax ?? 0),
    shipping: Number((incl ? order.shipping_incl_tax : order.shipping_excl_tax) ?? 0),
    affiliation: 'Online Store' as const,
    items,
    ...(coupon && { coupon }),
    ...(discount > 0 && { discount }),
  };
};

/** GA4's `purchase` params for one accepted upsell line of the order. */
export const upsellPurchase = (engine: Engine, order: ApiOrder, line: ApiOrderLine, transaction: string) => {
  const item = orderItem(engine, order, line, 0, taxIncluded(engine, order));
  return {
    currency: item.currency,
    transaction_id: transaction,
    value: valueOf([item]),
    tax: 0,
    shipping: 0,
    affiliation: 'Upsell' as const,
    items: [item],
  };
};
