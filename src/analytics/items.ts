import { cartItem } from '../engine/cart/public';
import type { Line, SummaryLine } from '../engine/cart/types';
import type { Engine } from '../engine/engine';
import type { CartItem } from '../engine/events/carts';
import { cents } from '../engine/display/format';
import type { Package } from '../engine/types';

const times = (amount: string | number, quantity: number) => String((cents(amount) * quantity) / 100);

/** A line priced as the catalog lists its package: `price_total` per package, `price_retail_total` before discounts. */
const listed = (pkg: Package, line: Line): SummaryLine => {
  const total = times(pkg.price_total, line.quantity);
  return {
    package_id: line.package_id,
    quantity: line.quantity,
    unit_price: pkg.price,
    original_unit_price: pkg.price_retail || pkg.price,
    package_price: pkg.price_total,
    original_package_price: pkg.price_retail_total || pkg.price_total,
    subtotal: total,
    total_discount: '0',
    total,
    discounts: [],
    ...(pkg.price_recurring && { price_recurring: pkg.price_recurring }),
  };
};

const scaled = (amount: string, from: number, to: number) => String(Math.round((cents(amount) * to) / from) / 100);

/** The priced line's totals for `quantity` packages: `total / quantity` stays what the server charged per package. */
const atQuantity = (priced: SummaryLine, quantity: number): SummaryLine =>
  priced.quantity === quantity
    ? priced
    : {
        ...priced,
        quantity,
        subtotal: scaled(priced.subtotal, priced.quantity, quantity),
        total_discount: scaled(priced.total_discount, priced.quantity, quantity),
        total: scaled(priced.total, priced.quantity, quantity),
      };

/** The line at the price the server gave its package, or the catalog's when the package is not in the priced cart. */
export function catalogItem(
  engine: Engine,
  line: Line,
  priced = engine.getState().cart.summary?.lines.find((l) => l.package_id === line.package_id),
): CartItem {
  const pkg = engine.getPackage(line.package_id);
  return cartItem(engine.getState(), line, priced ? atQuantity(priced, line.quantity) : pkg && listed(pkg, line));
}

/** The line at the unit price it was reported with, for a package the cart no longer has. */
export function reportedItem(engine: Engine, line: Line, unitPrice: number): CartItem {
  const pkg = engine.getPackage(line.package_id);
  const priced = pkg && listed({ ...pkg, price: String(unitPrice), price_total: times(unitPrice, pkg.qty) }, line);
  return cartItem(engine.getState(), line, priced);
}
