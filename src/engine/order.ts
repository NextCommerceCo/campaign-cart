import type { Context } from './engine';
import type { Address } from './events/checkout';
import type { Order, OrderItem } from './events/orders';
import { dollars as amount } from './format';
import type { ApiOrder, ApiOrderAddress, ApiOrderLine } from './types';

/** The public Address of an API address (`line4` is the city); none without a country. */
export function addressOf(raw?: ApiOrderAddress): Address | undefined {
  if (!raw?.country) return undefined;
  return {
    first_name: raw.first_name ?? '',
    last_name: raw.last_name ?? '',
    line1: raw.line1 ?? '',
    ...(raw.line2 && { line2: raw.line2 }),
    ...(raw.line4 && { city: raw.line4 }),
    ...(raw.state && { state: raw.state }),
    ...(raw.postcode && { postcode: raw.postcode }),
    country: raw.country,
    ...(raw.phone_number && { phone: raw.phone_number }),
  };
}

function item(raw: ApiOrderLine): OrderItem {
  const units = raw.quantity || 1;
  const total = amount(raw.price_incl_tax);
  const before = raw.price_incl_tax_excl_discounts ? amount(raw.price_incl_tax_excl_discounts) : total;
  return {
    id: String(raw.id),
    ...(raw.product_id != null && { product_id: raw.product_id }),
    product_title: raw.product_title,
    ...(raw.variant_id != null && { variant_id: raw.variant_id }),
    ...(raw.variant_title && { variant_title: raw.variant_title }),
    ...(raw.product_sku && { sku: raw.product_sku }),
    ...(raw.image && { image: raw.image }),
    quantity: raw.quantity,
    price: amount(total / units),
    original_price: amount(before / units),
    total,
    tax: amount(total - amount(raw.price_excl_tax)),
    upsell: !!raw.is_upsell,
  };
}

type Priced = { price?: number; original_price?: number; total?: number; tax?: number };

/** A line's unit prices before tax, for analytics: each `× (total − tax) ÷ total`. A cart line has no tax. */
export function untaxed<L extends Priced>(line: L): L {
  if (!line.tax || !line.total) return line;
  const net = (line.total - line.tax) / line.total;
  return {
    ...line,
    ...(line.price !== undefined && { price: amount(line.price * net) }),
    ...(line.original_price !== undefined && { original_price: amount(line.original_price * net) }),
  };
}

export const REPORTED = 'reported';
const REPORTED_KEEP = 50;

/** The browser's ledger of what was reported once: paid orders (`purchaseId`), upsell lines (`upsellId`), `failed:<ref_id>`. */
export function createLedger(ctx: Pick<Context, 'local'>) {
  const reported = () => ctx.local.get<string[]>(REPORTED) ?? [];
  return {
    has: (id: string) => reported().includes(id),
    mark(ids: string[]): void {
      ctx.local.set(REPORTED, [...new Set([...reported(), ...ids])].slice(-REPORTED_KEEP));
    },
  };
}

export type Ledger = ReturnType<typeof createLedger>;

/** The API's payment method code, such as `card_token`; an order sends it as a string or `{ code }`. */
export const paymentMethodCode = (method: ApiOrder['payment_method']): string =>
  typeof method === 'string' ? method : (method?.code ?? '');

/** The ledger key of a paid order: `order.paid` and `purchase` come once per key. */
export const purchaseId = (order: ApiOrder) => String(order.number ?? order.ref_id);

/** The ledger key of an upsell line, reported once per browser. */
export const upsellId = (order: ApiOrder, line: ApiOrderLine) => `${order.ref_id}:${line.id}`;

/** The codes the shopper applied at this tab's checkout of the order, kept in order state as `coupon`. */
export const appliedCodes = (raw: ApiOrder, coupon?: { refId: string; codes: string[] }) =>
  coupon?.refId === raw.ref_id ? coupon.codes : [];

/** The Order every `order.*` event carries, from the Campaigns API's order. */
export function publicOrder(raw: ApiOrder, coupons: string[] = []): Order {
  const method = paymentMethodCode(raw.payment_method);
  const user = raw.user && {
    ...(raw.user.email && { email: raw.user.email }),
    first_name: raw.user.first_name ?? '',
    last_name: raw.user.last_name ?? '',
    ...(raw.user.phone_number && { phone: raw.user.phone_number }),
  };
  const shipping = addressOf(raw.shipping_address);
  const billing = addressOf(raw.billing_address);
  return {
    ref_id: raw.ref_id,
    ...(raw.number !== undefined && { number: String(raw.number) }),
    ...(raw.currency && { currency: raw.currency }),
    test: !!raw.is_test,
    paid: !raw.payment_complete_url,
    lines: (raw.lines ?? []).map(item),
    coupons,
    total_discount: amount(raw.total_discounts),
    ...((raw.shipping_method || raw.shipping_incl_tax !== undefined) && {
      shipping_method: {
        ...(raw.shipping_method && { name: raw.shipping_method }),
        ...(raw.shipping_incl_tax !== undefined && { price: amount(raw.shipping_incl_tax) }),
        ...(raw.shipping_incl_tax !== undefined &&
          raw.shipping_excl_tax !== undefined && {
            tax: amount(amount(raw.shipping_incl_tax) - amount(raw.shipping_excl_tax)),
          }),
      },
    }),
    tax: amount(raw.total_tax),
    total: amount(raw.total_incl_tax),
    ...(user && { user }),
    ...(shipping && { shipping_address: shipping }),
    ...(billing && { billing_address: billing }),
    ...(method && { payment_method: method }),
    supports_upsells: !!raw.supports_post_purchase_upsells,
    ...(raw.order_status_url && { status_url: raw.order_status_url }),
  };
}
