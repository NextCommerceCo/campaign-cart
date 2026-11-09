import { formatAddress, ORDER_LAYOUT } from '../engine/order/address-line';
import { appliedCodes, paymentMethodCode } from '../engine/order/order';
import { paymentLabel } from '../engine/order/payment';
import { bool, cents, money, type Value } from '../engine/display/format';
import type { ApiOrder, ApiOrderAddress, State } from '../engine/types';

type Field<T> = (source: T, rest: string) => Value | undefined;

/** A path's fields, each under its names: the first, then 0.4.x camelCase or the API's snake_case ones. */
type Fields<T> = Record<string, Field<T>>;

const fieldOf = <T>(fields: Fields<T>, name: string): Field<T> | undefined =>
  Object.entries(fields).find(([names]) => names.split(' ').includes(name))?.[1];

export const pathsOf = (root: string, fields: Fields<never>): string[] =>
  Object.keys(fields).flatMap((names) => names.split(' ').map((name) => `${root}.${name}`));

const filled = (value?: string): Value => ({ type: 'text', value: value ?? '' });

const ADDRESS: Fields<ApiOrderAddress> = {
  first_name: (a) => filled(a.first_name),
  last_name: (a) => filled(a.last_name),
  name: (a) => filled([a.first_name, a.last_name].filter(Boolean).join(' ')),
  full: (a) => filled(formatAddress(a, ORDER_LAYOUT)),
  line1: (a) => filled(a.line1),
  line2: (a) => filled(a.line2),
  state: (a) => filled(a.state),
  country: (a) => filled(a.country),
  city: (a) => filled(a.line4),
  'postcode zip': (a) => filled(a.postcode),
  phone: (a) => filled(a.phone_number),
};

const CUSTOMER: Fields<NonNullable<ApiOrder['user']>> = {
  name: (u) => filled([u.first_name, u.last_name].filter(Boolean).join(' ')),
  email: (u) => filled(u.email),
  'firstName first_name': (u) => filled(u.first_name),
  'lastName last_name': (u) => filled(u.last_name),
  phone: (u) => filled(u.phone_number),
};

const amount = (value: string | undefined) => money(cents(value));
const linesOf = (order: ApiOrder) => order.lines ?? [];

const SHIPPING: Fields<ApiOrder> = {
  name: (o) => filled(o.shipping_method),
  price: (o) => amount(o.shipping_incl_tax),
  tax: (o) => money(cents(o.shipping_incl_tax) - cents(o.shipping_excl_tax)),
};

/** The order and the codes the shopper applied to it: what the public `Order` is made from. */
type OrderSource = ApiOrder & { coupons: string[] };

export const ORDER_VALUES: Fields<OrderSource> = {
  number: (o) => ({ type: 'text', value: o.number === undefined ? '' : String(o.number) }),
  'refId ref_id': (o) => ({ type: 'text', value: o.ref_id }),
  currency: (o) => ({ type: 'text', value: o.currency }),
  test: (o) => bool(!!o.is_test),
  paid: (o) => bool(!o.payment_complete_url),
  coupons: (o) => filled(o.coupons.join(', ')),
  total: (o) => amount(o.total_incl_tax),
  'totalExclTax total_excl_tax': (o) => amount(o.total_excl_tax),
  tax: (o) => amount(o.total_tax),
  shipping: (o) => amount(o.shipping_incl_tax),
  shippingExclTax: (o) => amount(o.shipping_excl_tax),
  'discounts total_discount': (o) => amount(o.total_discounts),
  subtotal: (o) =>
    money(
      linesOf(o).length
        ? linesOf(o).reduce((n, l) => n + cents(l.price_excl_tax), 0)
        : cents(o.total_excl_tax) - cents(o.shipping_excl_tax),
    ),
  hasTax: (o) => bool(cents(o.total_tax) > 0),
  hasShipping: (o) => bool(cents(o.shipping_incl_tax) > 0),
  hasDiscounts: (o) => bool(cents(o.total_discounts) > 0),
  hasItems: (o) => bool(linesOf(o).length > 0),
  isEmpty: (o) => bool(linesOf(o).length === 0),
  hasUpsells: (o) => bool(linesOf(o).some((l) => l.is_upsell)),
  'supportsUpsells supports_upsells': (o) => bool(!!o.supports_post_purchase_upsells),
  'itemCount lines': (o) => ({ type: 'int', value: linesOf(o).length }),
  shippingMethod: (o) => filled(o.shipping_method),
  shipping_method: (o, prop) => fieldOf(SHIPPING, prop || 'name')?.(o, ''),
  paymentMethod: (o) => ({ type: 'text', value: paymentLabel(paymentMethodCode(o.payment_method)) }),
  payment_method: (o) => filled(paymentMethodCode(o.payment_method)),
  status_url: (o) => filled(o.order_status_url),
  'customer user': (o, prop) => fieldOf(CUSTOMER, prop)?.(o.user ?? {}, ''),
  'shippingAddress shipping_address': (o, prop) => fieldOf(ADDRESS, prop || 'full')?.(o.shipping_address ?? {}, ''),
  'billingAddress billing_address': (o, prop) => fieldOf(ADDRESS, prop || 'full')?.(o.billing_address ?? {}, ''),
};

export function orderValue(state: State, path: string): Value | undefined {
  const order = state.order?.order;
  if (!order) return path.startsWith('has') || path.startsWith('is') ? bool(false) : { type: 'text', value: undefined };
  const [head = '', prop = ''] = path.split('.');
  return fieldOf(ORDER_VALUES, head)?.({ ...order, coupons: appliedCodes(order, state.order?.coupon) }, prop);
}
