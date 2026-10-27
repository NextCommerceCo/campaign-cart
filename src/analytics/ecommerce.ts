import type { Engine } from '../engine/engine';
import type { Order, OrderLine, SummaryLine } from '../engine/types';

export type Line = { package_id: number; quantity: number };

export const cents = (n: number) => Math.round(n * 100) / 100;

export const currency = (engine: Engine) =>
  engine.getState().cart.summary?.currency ?? engine.getState().campaign?.currency ?? 'USD';

const ids = (product?: number, variant?: number) => ({
  ...(product != null && { item_product_id: String(product) }),
  ...(variant != null && { item_variant_id: String(variant) }),
});

const item = (engine: Engine, packageId: number, count: number, index: number, line?: SummaryLine) => {
  const pkg = engine.getPackage(packageId);
  if (!pkg) return undefined;
  const price = Number(line?.unit_price ?? pkg.price);
  const before = Number(line?.original_unit_price) || Number(pkg.price_retail) || 0;
  return {
    item_id: pkg.product_sku || String(pkg.external_id),
    item_name: pkg.product_name || pkg.name,
    item_category: engine.getState().campaign?.name,
    ...(pkg.product_variant_name && { item_variant: pkg.product_variant_name }),
    ...ids(pkg.product_id, pkg.product_variant_id),
    ...(pkg.product_sku && { item_sku: pkg.product_sku }),
    item_image: pkg.image,
    price,
    ...(before > price && { discount: cents(before - price) }),
    quantity: pkg.qty * count,
    currency: currency(engine),
    index,
  };
};

export const ecommerce = (engine: Engine, lines: Line[]) => {
  const summary = engine.getState().cart.summary;
  const items = lines
    .map((l, i) =>
      item(
        engine,
        l.package_id,
        l.quantity,
        i,
        summary?.lines.find((s) => s.package_id === l.package_id),
      ),
    )
    .filter((i): i is NonNullable<typeof i> => !!i);
  return { currency: currency(engine), value: cents(items.reduce((n, i) => n + i.price * i.quantity, 0)), items };
};

export const legacyCart = (engine: Engine) => {
  const summary = engine.getState().cart.summary;
  const items = engine.cart.lines().map((l) => {
    const line = summary?.lines.find((s) => s.package_id === l.package_id);
    const price = Number(line?.package_price ?? engine.getPackage(l.package_id)?.price_total ?? 0);
    return { package_id: l.package_id, quantity: l.quantity, price };
  });
  return {
    currency: currency(engine),
    items,
    total_items: items.reduce((n, i) => n + i.quantity, 0),
    total_value: cents(items.reduce((n, i) => n + i.price * i.quantity, 0)),
  };
};

export const cartEcommerce = (engine: Engine) => {
  const [coupon] = engine.cart.vouchers();
  const method = engine.getState().cart.summary?.shipping_method;
  return {
    ...ecommerce(engine, engine.cart.lines()),
    ...(coupon && { coupon }),
    ...(method && { shipping: Number(method.price) }),
  };
};

export const taxIncluded = (engine: Engine, order: Order) => {
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

export const orderItem = (engine: Engine, order: Order, line: OrderLine, index: number, incl: boolean) => {
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
    price: cents(paid),
    ...(listed > paid && { discount: cents(listed - paid) }),
    quantity: line.quantity,
    currency: order.currency ?? currency(engine),
    index,
  };
};
