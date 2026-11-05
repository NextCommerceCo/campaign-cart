import { mergeLines, normalizeCode } from '../../engine/cart/lines';
import type { CartSummary, Line, SummaryLine } from '../../engine/cart/types';
import type { Package, State } from '../../engine/types';

/** @deprecated Use `data-next-selector-id`. */
export interface LegacyDecimal {
  toNumber(): number;
  toFixed(digits?: number): string;
  toString(): string;
  toJSON(): string;
  valueOf(): number;
}

export const decimal = (value: number | string | undefined): LegacyDecimal => {
  const n = Number(value ?? 0);
  const text = () => String(n);
  return {
    toNumber: () => n,
    toFixed: (digits) => (digits === undefined ? text() : n.toFixed(digits)),
    toString: text,
    toJSON: text,
    valueOf: () => n,
  };
};

export const percent = (part: number, whole: number) => decimal(whole > 0 ? (part / whole) * 100 : 0);

export const pick = <T extends object>(from: T | undefined, keys: Array<keyof T>) =>
  Object.fromEntries(keys.map((k) => [k, from?.[k]]));

export const packageOf = ({ campaign }: State, id: number) => campaign?.packages.find((p) => p.ref_id === id);

export const legacyItem = (line: Line, p: Package | undefined, priced: SummaryLine | undefined) => ({
  id: line.package_id,
  packageId: line.package_id,
  quantity: line.quantity,
  price: Number(p?.price_total ?? 0),
  title: p?.name ?? '',
  sku: p?.product_sku ?? undefined,
  is_upsell: !!line.is_upsell,
  price_per_unit: p?.price,
  ...pick(p, [
    'image',
    'qty',
    'price_total',
    'price_retail',
    'price_retail_total',
    'price_recurring',
    'is_recurring',
    'interval',
    'interval_count',
  ]),
  productId: p?.product_id,
  productName: p?.product_name,
  variantId: p?.product_variant_id,
  variantName: p?.product_variant_name,
  variantAttributes: p?.product_variant_attribute_values,
  variantSku: p?.product_sku ?? undefined,
  ...(line.properties && { properties: line.properties }),
  ...(priced &&
    pick(priced, [
      'unit_price',
      'original_unit_price',
      'package_price',
      'original_package_price',
      'total',
      'total_discount',
      'discounts',
    ])),
});

export function legacyShipping(s: NonNullable<CartSummary['shipping_method']>) {
  const price = Number(s.price);
  const original = Number(s.original_price);
  const off = Math.max(0, Math.round((original - price) * 100) / 100);
  return {
    ...pick(s, ['id', 'name', 'code', 'discounts']),
    originalPrice: decimal(original),
    price: decimal(price),
    discountAmount: decimal(off),
    discountPercentage: percent(off, original),
    hasDiscounts: off > 0,
  };
}

/** 0.4.x `CartState`, as `cart:updated` carried it. */
export function legacyCart(state: State) {
  const { cart, campaign } = state;
  const { summary } = cart;
  const lines = mergeLines(cart.groups);
  const subtotal = Number(summary?.subtotal ?? 0);
  const totalDiscount = Number(summary?.total_discount ?? 0);
  return {
    items: lines.map((line, i) =>
      legacyItem(
        line,
        packageOf(state, line.package_id),
        summary?.lines[i]?.package_id === line.package_id ? summary.lines[i] : undefined,
      ),
    ),
    totalQuantity: lines.reduce((n, l) => n + l.quantity, 0),
    isEmpty: !lines.length,
    vouchers: [
      ...new Set([
        ...cart.coupons,
        ...cart.held,
        ...Object.values(cart.groups).flatMap((g) => g.vouchers.map(normalizeCode)),
      ]),
    ],
    currency: summary?.currency ?? campaign?.currency,
    offerDiscounts: summary?.offer_discounts ?? [],
    voucherDiscounts: summary?.voucher_discounts ?? [],
    subtotal: decimal(subtotal),
    ...(summary?.shipping_method && { shippingMethod: legacyShipping(summary.shipping_method) }),
    hasDiscounts: totalDiscount > 0,
    totalDiscount: decimal(totalDiscount),
    totalDiscountPercentage: percent(totalDiscount, subtotal),
    total: decimal(summary?.total),
    ...(summary && {
      summary: {
        ...summary,
        lines: summary.lines.map((l) => {
          const { ref_id: _, external_id: __, ...shown } = packageOf(state, l.package_id) ?? ({} as Partial<Package>);
          return { ...l, ...shown };
        }),
      },
    }),
    isCalculating: cart.calculating,
  };
}

/** 0.4.43 sent one item event per cart action; none for a swap-mode selector's pick, emptying or replacing the cart. */
export const shippingOption = (state: State, id?: number) =>
  state.campaign?.shipping_methods.find((m) => m.ref_id === id);
