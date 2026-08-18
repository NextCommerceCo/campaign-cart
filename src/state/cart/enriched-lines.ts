/**
 * Maps stored cart items to the display-ready {@link EnrichedCartLine} shape the
 * public snapshot exposes as `cartLines` (`next.getCartData()`).
 *
 * Derived at read time from `items` rather than kept in the store: `items` is
 * written synchronously by every cart operation, while `summary` only lands once
 * the calculate API answers. A stored copy would lag a calculate behind — empty
 * right after the first add, and still listing a line that was just removed.
 */

import type { CartItem, EnrichedCartLine } from '@/types/global';
import { formatCurrency } from '@/core/currency-formatter';

const num = (value: string | undefined): number => {
  const parsed = parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value: number): { value: number; formatted: string } => ({
  value,
  formatted: formatCurrency(value),
});

function toEnrichedCartLine(
  item: CartItem,
  siblingLineIds: number[]
): EnrichedCartLine {
  const quantity = item.quantity;

  // final = API line total, else (offer-discounted package price || package price) × quantity
  const final =
    num(item.total) || (num(item.package_price) || item.price) * quantity;

  // original = the highest "before discounts" figure the item carries, so
  // savings = original − final is never negative
  const original = Math.max(
    num(item.price_retail_total) * quantity,
    (num(item.original_package_price) || num(item.price_total) || item.price) *
      quantity,
    final
  );

  return {
    id: item.id,
    packageId: item.packageId,
    quantity,
    price: {
      // The cart calculate API returns no tax breakdown, so both carry the line total.
      excl_tax: money(final),
      incl_tax: money(final),
      original: money(original),
      savings: money(original - final),
    },
    product: {
      title: item.title,
      sku: item.sku ?? item.variantSku ?? '',
      image: item.image ?? '',
    },
    is_upsell: item.is_upsell ?? false,
    is_recurring: item.is_recurring ?? false,
    interval:
      item.interval === 'day' || item.interval === 'month'
        ? item.interval
        : undefined,
    is_bundle: siblingLineIds.length > 0,
    ...(siblingLineIds.length > 0 && { bundleComponents: siblingLineIds }),
  };
}

/** One {@link EnrichedCartLine} per cart item, in cart order. */
export function toEnrichedCartLines(items: CartItem[]): EnrichedCartLine[] {
  // A bundle line is one of several lines that one selector put in the cart: a
  // bundle selector writes its whole slot set under a single `selectorId`, while
  // a package selector writes exactly one line under its own.
  const lineIdsBySelector = new Map<string, number[]>();
  for (const item of items) {
    if (!item.selectorId) continue;
    const ids = lineIdsBySelector.get(item.selectorId);
    if (ids) ids.push(item.id);
    else lineIdsBySelector.set(item.selectorId, [item.id]);
  }

  return items.map(item => {
    const lineIds = item.selectorId
      ? (lineIdsBySelector.get(item.selectorId) ?? [])
      : [];
    return toEnrichedCartLine(
      item,
      lineIds.filter(id => id !== item.id)
    );
  });
}
