import { addDollars, dollars, percentOf } from '../display/format';
import type { State } from '../types';
import type { Context } from '../engine';
import type { Cart, CartChange, CartItem } from '../events/carts';
import type { Checkout } from '../events/checkout';
import type { Discount } from '../events/coupons';
import type { OptionPrice, Selector } from '../events/selectors';
import { apiLines, mergeLines } from './lines';
import type { Line, CartGroup, CartSummary, SummaryDiscount, SummaryLine } from './types';

const discountOf = (d: SummaryDiscount, coupons: string[]): Discount => {
  const code = d.description?.toUpperCase();
  const coupon = !!code && coupons.includes(code);
  return {
    name: d.name ?? '',
    amount: dollars(d.amount),
    source: coupon ? 'coupon' : 'offer',
    ...(coupon && { code }),
    offer_id: d.offer_id ?? 0,
    ...(d.percentage !== undefined && { percentage: Number(d.percentage) }),
  };
};

const perPackage = (amount: number, quantity: number) =>
  quantity ? Math.round((amount / quantity) * 100) / 100 : amount;

export function optionPrice(subtotal: number, total: number, quantity: number): OptionPrice {
  const discount = addDollars([subtotal, -total]);
  return {
    price: perPackage(total, quantity),
    original_price: perPackage(subtotal, quantity),
    subtotal,
    total_discount: discount,
    discount_percentage: percentOf(discount, subtotal),
  };
}

export const unitsOf = (lines: Array<{ quantity: number }>) => lines.reduce((n, l) => n + l.quantity, 0);

export function cartItem(state: State, line: Line, priced?: SummaryLine): CartItem {
  const p = state.campaign?.packages.find((pk) => pk.ref_id === line.package_id);
  const interval = p?.is_recurring && p.interval ? p.interval : undefined;
  return {
    ...line,
    ...(p?.product_id !== undefined && { product_id: p.product_id }),
    ...(p && { product_title: p.product_name || p.name }),
    ...(p?.product_variant_id !== undefined && { variant_id: p.product_variant_id }),
    ...(p?.product_variant_name && { variant_title: p.product_variant_name }),
    ...(p?.product_sku && { sku: p.product_sku }),
    ...(p?.image && { image: p.image }),
    ...(priced && {
      price: dollars(priced.package_price),
      original_price: dollars(priced.original_package_price),
      total_discount: dollars(priced.total_discount),
      total: dollars(priced.total),
      subtotal: dollars(priced.subtotal),
      discount_percentage: percentOf(dollars(priced.total_discount), dollars(priced.subtotal)),
      discounts: priced.discounts.map((d) => discountOf(d, state.cart.coupons)),
    }),
    ...(interval && {
      subscription: {
        interval,
        interval_count: p!.interval_count ?? 1,
        ...(priced?.price_recurring && {
          price: dollars(priced.price_recurring),
          original_price: dollars(priced.original_recurring_price ?? priced.price_recurring),
        }),
      },
    }),
  };
}

const fresh = (lines: Line[], priced?: SummaryLine[]) =>
  priced?.length === lines.length &&
  lines.every((l, i) => priced[i]!.package_id === l.package_id && priced[i]!.quantity === l.quantity);

export function cartItems(state: State, lines: Line[], priced?: SummaryLine[]): CartItem[] {
  const quoted = fresh(lines, priced) ? priced : undefined;
  return lines.map((l, i) => cartItem(state, l, quoted?.[i]));
}

export function publicToggle(state: State, id: string, group?: CartGroup): Selector {
  const lines = apiLines(group?.lines ?? []);
  const quoted = lines.map((l) => state.toggles[l.package_id]?.line).filter((l) => !!l);
  const items = cartItems(state, lines, quoted);
  const currency = state.campaign?.currency;
  const priced = lines.length > 0 && fresh(lines, quoted);
  const quantity = unitsOf(lines);
  const total = priced ? addDollars(items.map((l) => l.total!)) : undefined;
  return {
    selector_id: id,
    type: 'toggle',
    lines: items,
    ...(currency && { currency }),
    ...(total !== undefined && {
      total,
      ...optionPrice(addDollars(items.map((l) => l.subtotal!)), total, quantity),
    }),
    quantity,
    in_cart: !!state.cart.groups[id],
  };
}

export function publicCart(state: State, priced?: CartSummary): Cart {
  const { coupons, shippingId } = state.cart;
  const campaign = state.campaign;
  const merged = mergeLines(state.cart.groups);
  const summary = fresh(merged, priced?.lines) ? priced : undefined;
  const lines = cartItems(state, merged, summary?.lines);
  const listed = campaign?.shipping_methods.find((m) => m.ref_id === shippingId);
  const method = summary?.shipping_method;
  const shipping_method = method
    ? {
        id: method.id,
        code: method.code,
        name: method.name,
        price: dollars(method.price),
        original_price: dollars(method.original_price),
        discounts: (method.discounts ?? []).map((d) => discountOf(d, coupons)),
      }
    : shippingId !== undefined
      ? { id: shippingId, ...(listed && { code: listed.code }) }
      : undefined;
  const byOffer = new Map<number, Discount>();
  for (const d of lines.flatMap((l) => l.discounts ?? [])) {
    const seen = byOffer.get(d.offer_id);
    byOffer.set(d.offer_id, seen ? { ...seen, amount: addDollars([seen.amount, d.amount]) } : d);
  }
  const subtotal = summary && dollars(summary.subtotal);
  const totalDiscount = summary && addDollars(lines.map((l) => l.total_discount ?? 0));
  const total = summary && dollars(summary.total);
  return {
    lines,
    coupons,
    quantity: unitsOf(lines),
    ...(campaign && { currency: campaign.currency }),
    ...(shipping_method && { shipping_method }),
    ...(summary && {
      subtotal,
      total_discount: totalDiscount,
      total,
      total_before_shipping: addDollars([total!, -dollars(method?.price ?? '0')]),
      discounts: [...byOffer.values()],
      discount_percentage: percentOf(totalDiscount!, subtotal!),
    }),
  };
}

export function publicCheckout(state: State, summary?: CartSummary): Checkout {
  const checkout = state.checkout;
  return {
    id: checkout?.id ?? '',
    ...(checkout && checkout.step > 0 && { step: checkout.step }),
    cart: publicCart(state, summary),
    ...(checkout?.user && { user: checkout.user }),
    ...(checkout?.shippingAddress && { shipping_address: checkout.shippingAddress }),
    ...(checkout && { billing_same_as_shipping: checkout.sameAsShipping }),
    ...(checkout?.billingAddress && !checkout.sameAsShipping && { billing_address: checkout.billingAddress }),
    ...(checkout && { payment_method: checkout.paymentMethod }),
  };
}

export const shippingMethodOf = (state: State) => state.cart.shippingId ?? state.campaign?.shipping_methods[0]?.ref_id;

/** What `cart.added` and `cart.removed` carry for a change from `before` to `after`, at the prices the cart had. */
export function changesOf(
  packageOf: Context['getPackage'],
  before: Map<number, number>,
  after: Map<number, number>,
  priced: SummaryLine[] = [],
) {
  const added: CartChange[] = [];
  const removed: CartChange[] = [];
  for (const id of new Set([...before.keys(), ...after.keys()])) {
    const from = before.get(id) ?? 0;
    const to = after.get(id) ?? 0;
    if (from === to) continue;
    const p = packageOf(id);
    const charged = priced.find((l) => l.package_id === id)?.package_price;
    (to > from ? added : removed).push({
      package_id: id,
      ...(p?.product_id !== undefined && { product_id: p.product_id }),
      ...(p?.product_variant_id !== undefined && { variant_id: p.product_variant_id }),
      quantity: Math.abs(to - from),
      from,
      to,
      ...(charged !== undefined && { price: dollars(charged) }),
    });
  }
  return { added, removed };
}
