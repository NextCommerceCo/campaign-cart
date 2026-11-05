import type { Engine } from '../engine';
import { cents, format, money, pct } from '../format';
import type { Tokens } from '../tokens';
import type { SummaryLine } from './types';

export function cartTokens(engine: Engine): Tokens {
  const { cart, campaign } = engine.getState();
  const s = cart.summary;
  const currency = s?.currency ?? campaign?.currency;
  const locale = campaign?.language;
  const m = (amount: string | undefined) => (s ? format(money(cents(amount)), currency, locale) : '');
  const shipping = s?.shipping_method;
  const free = !shipping || cents(shipping.price) === 0;
  const discounted = !!shipping && cents(shipping.original_price) > cents(shipping.price);
  const lines = engine.cart.lines();
  return {
    subtotal: m(s?.subtotal),
    total: m(s?.total),
    shipping: free ? 'Free' : m(shipping?.price),
    shippingName: shipping?.name ?? '',
    shippingCode: shipping?.code ?? '',
    shippingOriginal: discounted ? m(shipping?.original_price) : '',
    totalDiscount: m(s?.total_discount),
    discounts: m(s?.total_discount),
    totalDiscountPercentage: s ? format(pct(cents(s.total_discount), cents(s.subtotal)), currency, locale) : '',
    currency: currency ?? '',
    isCalculating: String(cart.calculating),
    isEmpty: String(!lines.length),
    itemCount: String(lines.length),
    totalQuantity: String(lines.reduce((n, l) => n + l.quantity, 0)),
    isFreeShipping: String(free),
    hasShippingDiscount: String(discounted),
    hasDiscounts: String(!!s && cents(s.total_discount) > 0),
  };
}

function frequency(interval: string | null | undefined, count: number | null | undefined): string {
  const n = count ?? 1;
  if (interval === 'day') return n === 1 ? 'Daily' : `Every ${n} days`;
  if (interval === 'month') return n === 1 ? 'Monthly' : `Every ${n} months`;
  return '';
}

export function lineTokens(engine: Engine, line: SummaryLine, currency: string | undefined): Tokens {
  const pkg = engine.getPackage(line.package_id);
  const locale = engine.getState().campaign?.language;
  const m = (amount: string) => format(money(cents(amount)), currency, locale);
  const unit = cents(line.unit_price);
  const original = cents(line.original_unit_price);
  const interval = line.interval ?? pkg?.interval;
  const count = line.interval_count ?? pkg?.interval_count;
  const recurring = line.price_recurring ?? pkg?.price_recurring;
  const tokens: Tokens = {
    packageId: String(line.package_id),
    name: pkg?.name ?? '',
    image: pkg?.image ?? '',
    quantity: String(line.quantity),
    variantName: pkg?.product_variant_name ?? '',
    productName: pkg?.product_name ?? '',
    sku: pkg?.product_sku ?? '',
    price: m(line.total),
    originalPrice: m(line.subtotal),
    unitPrice: m(line.unit_price),
    originalUnitPrice: m(line.original_unit_price),
    discountAmount: m(line.total_discount),
    discountPercentage: format(pct(Math.max(0, original - unit), original), currency, locale),
    hasDiscount: cents(line.total_discount) > 0 ? 'show' : 'hide',
    currency: currency ?? '',
    isRecurring: String(!!(line.is_recurring ?? pkg?.is_recurring)),
    interval: interval ?? '',
    intervalCount: count != null ? String(count) : '',
    frequency: frequency(interval, count),
    recurringPrice: recurring != null ? m(recurring) : '',
    originalRecurringPrice: line.original_recurring_price != null ? m(line.original_recurring_price) : '',
  };
  return Object.fromEntries(
    Object.entries(tokens).flatMap(([k, v]) => [
      [`item.${k}`, v],
      [`line.${k}`, v],
    ]),
  );
}
