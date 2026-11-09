import type { Engine } from '../../engine/engine';
import type { Cart, CartItem } from '../../engine/events/carts';
import { dollars } from '../../engine/format';
import { orderLineProduct, paidUnit, perUnit, taxIncluded, trackingValue } from '../../engine/tracking';
import type { ApiOrder, ApiOrderLine } from '../../engine/types';

export const currency = (engine: Engine) =>
  engine.getState().cart.summary?.currency ?? engine.getState().campaign?.currency ?? 'USD';

const ids = (product?: number, variant?: number) => ({
  ...(product != null && { item_product_id: String(product) }),
  ...(variant != null && { item_variant_id: String(variant) }),
});

export const valueOf = (items: Array<{ price: number; quantity: number }>) => trackingValue(items) ?? 0;

/** A GA4 item from a cart line: unit prices, `quantity` in units. */
const item = (engine: Engine, line: CartItem, index: number) => {
  const pkg = engine.getPackage(line.package_id);
  if (!pkg) return undefined;
  const [unit] = perUnit([line], engine);
  const price = unit!.price ?? Number(pkg.price);
  const before = (unit!.original_price ?? 0) || Number(pkg.price_retail) || 0;
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
    quantity: unit!.quantity,
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

export const orderItem = (engine: Engine, order: ApiOrder, line: ApiOrderLine, index: number, incl: boolean) => {
  const paid = paidUnit(line, incl);
  const listed =
    Number(incl ? line.price_incl_tax_excl_discounts : line.price_excl_tax_excl_discounts) / (line.quantity || 1);
  const pkg = line.package ? engine.getPackage(line.package) : undefined;
  const campaign = engine.getState().campaign?.name;
  const product = orderLineProduct(line, line.product_sku, pkg, campaign);
  return {
    item_id: product.id,
    item_name: line.product_title,
    item_brand: product.brand,
    item_category: campaign,
    ...(product.variant && { item_variant: product.variant }),
    ...ids(product.product_id, line.variant_id ?? pkg?.product_variant_id),
    ...(product.sku && { item_sku: product.sku }),
    ...(product.image && { item_image: product.image }),
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
