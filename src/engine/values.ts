import type { Engine } from './engine';
import { mergeLines } from './cart';
import { cardLines } from './selectors';
import type { CartLine, CartSummary, Discount, Package, Selector, SelectorCard, State, SummaryLine } from './types';

export type ValueType = 'money' | 'percent' | 'int' | 'text' | 'bool' | 'url';

export interface Value {
  type: ValueType;
  value: string | number | boolean | undefined;
}

export interface CardRef {
  selectorId: string;
  cardId: string;
}

export interface Context {
  packageId?: number;
  card?: CardRef;
}

export const cents = (amount: string | number | undefined): number => Math.round(Number(amount ?? 0) * 100);
export const money = (c: number | undefined): Value => ({
  type: 'money',
  value: c === undefined ? undefined : c / 100,
});
const pct = (part: number, whole: number): Value => ({ type: 'percent', value: whole > 0 ? (part / whole) * 100 : 0 });
export const bool = (value: boolean): Value => ({ type: 'bool', value });
const notLoaded = (v: Value | undefined): Value | undefined =>
  v && (v.type === 'bool' ? v : { type: v.type, value: undefined });

const NO_PACKAGE: Package = {
  ref_id: 0,
  external_id: 0,
  name: '',
  price: '0',
  price_total: '0',
  qty: 0,
  image: '',
  is_recurring: false,
};

function packageValue(pkg: Package | undefined, prop: string): Value | undefined {
  if (!pkg) return notLoaded(packageValue(NO_PACKAGE, prop));
  const total = cents(pkg.price_total);
  const retail = pkg.price_retail_total ? cents(pkg.price_retail_total) : total;
  switch (prop) {
    case 'name':
      return { type: 'text', value: pkg.name };
    case 'image':
      return { type: 'url', value: pkg.image };
    case 'qty':
    case 'quantity':
      return { type: 'int', value: pkg.qty };
    case 'price':
    case 'unitPrice':
      return money(cents(pkg.price));
    case 'price_total':
    case 'priceTotal':
    case 'total':
      return money(total);
    case 'price_retail':
    case 'priceRetail':
      return money(pkg.price_retail ? cents(pkg.price_retail) : undefined);
    case 'price_retail_total':
    case 'priceRetailTotal':
    case 'compareTotal':
      return money(retail);
    case 'savingsAmount':
    case 'totalSavings':
      return money(Math.max(0, retail - total));
    case 'savingsPercentage':
    case 'totalSavingsPercentage':
      return pct(Math.max(0, retail - total), retail);
    case 'hasSavings':
    case 'hasTotalSavings':
      return bool(retail > total);
    case 'hasRetailPrice':
      return bool(!!pkg.price_retail);
    case 'isRecurring':
      return bool(pkg.is_recurring);
    default:
      return undefined;
  }
}

function linesValue(
  engine: Engine,
  lines: CartLine[],
  prop: string,
  selected: boolean,
  quote?: CartSummary,
): Value | undefined {
  if (lines.some((l) => !engine.getPackage(l.packageId))) return notLoaded(linesValue(engine, [], prop, selected));
  let total = 0;
  let retail = 0;
  let units = 0;
  for (const line of lines) {
    const pkg = engine.getPackage(line.packageId)!;
    total += cents(pkg.price_total) * line.quantity;
    retail += cents(pkg.price_retail_total ?? pkg.price_total) * line.quantity;
    units += pkg.qty * line.quantity;
  }
  if (quote) {
    total = quote.lines.reduce((n, l) => n + cents(l.total), 0);
    retail = quote.lines.reduce((n, l) => n + cents(l.subtotal), 0);
  }
  const first = lines[0] ? engine.getPackage(lines[0].packageId) : undefined;
  switch (prop) {
    case 'name':
      return { type: 'text', value: first?.name };
    case 'image':
      return { type: 'url', value: first?.image };
    case 'price':
    case 'total':
      return money(total);
    case 'originalPrice':
    case 'compare':
      return money(retail);
    case 'discountAmount':
    case 'savings':
      return money(Math.max(0, retail - total));
    case 'discountPercentage':
    case 'savingsPercentage':
    case 'savingsOfferPercentage':
      return pct(Math.max(0, retail - total), retail);
    case 'hasDiscount':
    case 'hasSavings':
      return bool(retail > total);
    case 'unitPrice':
      return money(units ? Math.round(total / units) : 0);
    case 'originalUnitPrice':
      return money(units ? Math.round(retail / units) : 0);
    case 'quantity':
      return { type: 'int', value: units };
    case 'isSelected':
      return bool(selected);
    default:
      return undefined;
  }
}

function cartValue(state: State, engine: Engine, prop: string): Value | undefined {
  const { cart } = state;
  const summary = cart.summary;
  const lines = engine.cart.lines();
  const units = lines.reduce((n, l) => n + (engine.getPackage(l.package_id)?.qty ?? 1) * l.quantity, 0);
  const subtotal = summary ? cents(summary.subtotal) : undefined;
  const discount = summary ? cents(summary.total_discount) : 0;
  const shipping = summary?.shipping_method ? cents(summary.shipping_method.price) : undefined;
  const compare = lines.reduce((n, l) => {
    const pkg = engine.getPackage(l.package_id);
    return n + (pkg ? cents(pkg.price_retail_total ?? pkg.price_total) * l.quantity : 0);
  }, 0);
  const paid = subtotal === undefined ? undefined : subtotal - discount;
  const savings = paid === undefined ? 0 : Math.max(0, compare - paid);
  switch (prop) {
    case 'total':
      return money(summary ? cents(summary.total) : undefined);
    case 'subtotal':
      return money(subtotal);
    case 'shipping':
      return money(shipping);
    case 'totalDiscount':
    case 'discountAmount':
      return money(discount);
    case 'totalDiscountPercentage':
    case 'discountPercentage':
      return pct(discount, subtotal ?? 0);
    case 'compareTotal':
    case 'originalPrice':
      return money(compare);
    case 'totalSavingsAmount':
    case 'savingsAmount':
      return money(savings);
    case 'totalSavingsPercentage':
    case 'savingsPercentage':
      return pct(savings, compare);
    case 'currency':
      return { type: 'text', value: summary?.currency ?? state.campaign?.currency };
    case 'quantity':
    case 'totalQuantity':
      return { type: 'int', value: units };
    case 'itemCount':
    case 'count':
      return { type: 'int', value: lines.length };
    case 'discountCode':
      return { type: 'text', value: cart.coupons[0] };
    case 'hasItems':
      return bool(lines.length > 0);
    case 'isEmpty':
      return bool(lines.length === 0);
    case 'hasSavings':
      return bool(savings > 0);
    case 'hasDiscounts':
      return bool(discount > 0);
    case 'hasCoupon':
      return bool(cart.coupons.length > 0);
    case 'hasFreeShipping':
    case 'isFreeShipping':
      return bool(!!summary && shipping === 0);
    case 'isCalculating':
      return bool(cart.calculating);
    default:
      return undefined;
  }
}

function shippingValue(state: State, prop: string): Value | undefined {
  const method = state.cart.summary?.shipping_method;
  switch (prop) {
    case 'cost':
    case 'price':
      return money(method ? cents(method.price) : undefined);
    case 'name':
      return { type: 'text', value: method?.name };
    case 'code':
      return { type: 'text', value: method?.code };
    case 'isFree':
      return bool(!!method && cents(method.price) === 0);
    default:
      return undefined;
  }
}

export const toggleGroup = (packageId: number) => `toggle:${packageId}`;

function findCard(state: State, id: string): CardRef | undefined {
  const picked = state.selectors[id]?.picked;
  if (picked) return { selectorId: id, cardId: picked };
  for (const [selectorId, selector] of Object.entries(state.selectors)) {
    if (selector.cards.some((c) => c.id === id)) return { selectorId, cardId: id };
  }
  return undefined;
}

const lineKey = (pairs: Array<{ package_id: number; quantity: number }>) =>
  pairs
    .map((l) => `${l.package_id}x${l.quantity}`)
    .sort()
    .join();

export function cardQuote(selector: Selector, card: SelectorCard): CartSummary | undefined {
  const quoted = selector.quotes?.[card.id];
  const current = mergeLines({ card: { lines: cardLines(selector, card), vouchers: [] } });
  return quoted && lineKey(quoted.lines) === lineKey(current) ? quoted : undefined;
}

export function resolveCard(engine: Engine, ref: CardRef, prop: string): Value | undefined {
  const selector = engine.getState().selectors[ref.selectorId];
  const card = selector?.cards.find((c) => c.id === ref.cardId);
  if (!selector || !card) return notLoaded(linesValue(engine, [], prop, false));
  const lines = cardLines(selector, card);
  const quote = cardQuote(selector, card);
  const v = linesValue(engine, lines, prop, selector.picked === card.id, quote);
  return selector.mode === 'offer' && !quote && selector.quoting ? notLoaded(v) : v;
}

type Resolver = (state: State, path: string) => Value | undefined;
const LAZY_ROOTS = ['order'];
const roots = new Map<string, Resolver>();

export const registerValues = (root: string, resolver: Resolver) => void roots.set(root, resolver);

export function resolve(engine: Engine, path: string, ctx: Context = {}): Value | undefined {
  const state = engine.getState();
  const parts = path.split('.');
  const [root = '', second = '', ...rest] = parts;
  const lazy = roots.get(root);
  if (lazy) return lazy(state, parts.slice(1).join('.'));
  if (LAZY_ROOTS.includes(root)) return { type: 'text', value: undefined };
  switch (root) {
    case 'cart':
      return cartValue(state, engine, second);
    case 'shipping':
      return shippingValue(state, second);
    case 'campaign':
      return { type: 'text', value: state.campaign?.[second as 'name' | 'currency' | 'language'] };
    case 'param':
      return { type: 'text', value: state.visit.params[parts.slice(1).join('.')] };
    case 'package': {
      const explicit = /^\d+$/.test(second);
      const id = explicit ? Number(second) : ctx.packageId;
      const prop = explicit ? rest.join('.') : parts.slice(1).join('.');
      return id === undefined ? { type: 'text', value: undefined } : packageValue(engine.getPackage(id), prop);
    }
    case 'bundle': {
      const ref = findCard(state, second);
      return ref ? resolveCard(engine, ref, rest.join('.')) : { type: 'text', value: undefined };
    }
    case 'toggle': {
      const id = Number(second);
      const line = state.cart.groups[toggleGroup(id)]?.lines[0];
      return linesValue(engine, [{ packageId: id, quantity: line?.quantity ?? 1 }], rest.join('.'), !!line);
    }
    default:
      if (parts.length === 1 && ctx.card) return resolveCard(engine, ctx.card, root);
      if (parts.length === 1 && ctx.packageId !== undefined)
        return packageValue(engine.getPackage(ctx.packageId), root);
      if (parts.length === 1) return cartValue(state, engine, root);
      return undefined;
  }
}

export function resolveLines(engine: Engine, lines: CartLine[], prop: string, selected: boolean): Value | undefined {
  return linesValue(engine, lines, prop, selected);
}

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(locale: string | undefined, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let f = formatters.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat(locale, options);
    } catch {
      f = new Intl.NumberFormat(undefined, options);
    }
    formatters.set(key, f);
  }
  return f;
}

export function format(v: Value, currency: string | undefined, locale?: string, override?: string | null): string {
  if (v.value === undefined || v.value === null) return '';
  const type = override === 'currency' ? 'money' : override === 'percentage' ? 'percent' : v.type;
  const n = Number(v.value);
  switch (type) {
    case 'money':
      return currency
        ? formatter(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).format(n)
        : n.toFixed(2);
    case 'percent':
      return formatter(locale, { style: 'percent', maximumFractionDigits: 0 }).format(n / 100);
    case 'int':
      return formatter(locale, { maximumFractionDigits: 0 }).format(n);
    case 'bool':
      return v.value ? 'true' : 'false';
    default:
      return String(v.value);
  }
}

export function truthy(v: Value | undefined): boolean {
  if (!v || v.value === undefined || v.value === null) return false;
  if (typeof v.value === 'boolean') return v.value;
  if (typeof v.value === 'number') return v.value !== 0;
  return v.value !== '' && v.value !== 'false' && v.value !== '0';
}

export type Tokens = Record<string, string>;

export function cartTokens(engine: Engine): Tokens {
  const { cart, campaign } = engine.getState();
  const s = cart.summary;
  const currency = s?.currency ?? campaign?.currency;
  const locale = campaign?.language;
  const m = (amount: string | undefined) => (s ? format(money(cents(amount)), currency, locale) : '');
  const shipping = s?.shipping_method;
  const free = !!shipping && cents(shipping.price) === 0;
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

export function lineTokens(engine: Engine, line: SummaryLine, currency: string | undefined): Tokens {
  const pkg = engine.getPackage(line.package_id);
  const locale = engine.getState().campaign?.language;
  const m = (amount: string) => format(money(cents(amount)), currency, locale);
  const unit = cents(line.unit_price);
  const original = cents(line.original_unit_price);
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
  };
  return Object.fromEntries(
    Object.entries(tokens).flatMap(([k, v]) => [
      [`item.${k}`, v],
      [`line.${k}`, v],
    ]),
  );
}

export function discountTokens(discount: Discount, currency: string | undefined, locale?: string): Tokens {
  return {
    'discount.name': discount.name ?? '',
    'discount.description': discount.description ?? '',
    'discount.amount': format(money(cents(discount.amount)), currency, locale),
    'discount.percentage': discount.percentage
      ? format({ type: 'percent', value: Number(discount.percentage) }, currency, locale)
      : '',
  };
}
