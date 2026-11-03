import type { Engine } from './engine';
import { mergeLines } from './cart/cart';
import { cardLines } from './cart/selectors';
import { toggleGroup } from './cart/toggles';
import { bool, cents, money, pct, type Value } from './format';
import type { CartLine, CartSummary, Package, Selector, SelectorCard, State, SummaryLine } from './types';

export interface CardRef {
  selectorId: string;
  cardId: string;
}

export interface ValueScope {
  packageId?: number;
  card?: CardRef;
}

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
  quoted?: SummaryLine[],
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
  if (quoted) {
    total = quoted.reduce((n, l) => n + cents(l.total), 0);
    retail = quoted.reduce((n, l) => n + cents(l.subtotal), 0);
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
  const shipping = summary ? cents(summary.shipping_method?.price ?? '0') : undefined;
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

function findCard(state: State, id: string): CardRef | undefined {
  for (const [selectorId, selector] of Object.entries(state.selectors)) {
    if (selector.cards.some((c) => c.id === id)) return { selectorId, cardId: id };
  }
  const picked = state.selectors[id]?.picked;
  return picked ? { selectorId: id, cardId: picked } : undefined;
}

const quantitiesKey = (pairs: Array<{ package_id: number; quantity: number }>) =>
  pairs
    .map((l) => `${l.package_id}x${l.quantity}`)
    .sort()
    .join();

export function cardQuote(selector: Selector, card: SelectorCard): CartSummary | undefined {
  const quoted = selector.quotes?.[card.id];
  const current = mergeLines({ card: { lines: cardLines(selector, card), vouchers: [] } });
  return quoted && quantitiesKey(quoted.lines) === quantitiesKey(current) ? quoted : undefined;
}

export function resolveCard(engine: Engine, ref: CardRef, prop: string): Value | undefined {
  const selector = engine.getState().selectors[ref.selectorId];
  const card = selector?.cards.find((c) => c.id === ref.cardId);
  if (!selector || !card) return notLoaded(linesValue(engine, [], prop, false));
  const lines = cardLines(selector, card);
  const quote = cardQuote(selector, card);
  const v = linesValue(engine, lines, prop, selector.picked === card.id, quote?.lines);
  return selector.mode === 'offer' && !quote && selector.quoting ? notLoaded(v) : v;
}

type Resolver = (state: State, path: string) => Value | undefined;
const LAZY_ROOTS = ['order'];
const roots = new Map<string, Resolver>();

export const registerValues = (root: string, resolver: Resolver) => void roots.set(root, resolver);

export function resolve(engine: Engine, path: string, ctx: ValueScope = {}): Value | undefined {
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
    case 'toggle':
      return resolveToggle(engine, Number(second), rest.join('.'));
    default:
      if (parts.length === 1 && ctx.card) return resolveCard(engine, ctx.card, root);
      if (parts.length === 1 && ctx.packageId !== undefined)
        return packageValue(engine.getPackage(ctx.packageId), root);
      if (parts.length === 1) return cartValue(state, engine, root);
      return undefined;
  }
}

export function resolveToggle(engine: Engine, packageId: number, prop: string, quantity = 1): Value | undefined {
  const { cart, toggles } = engine.getState();
  const inCart = cart.groups[toggleGroup(packageId)]?.lines[0];
  const qty = inCart?.quantity ?? toggles[packageId]?.quantity ?? quantity;
  const quoted = inCart ? cart.summary?.lines.find((l) => l.package_id === packageId) : toggles[packageId]?.line;
  const line = quoted?.quantity === qty ? quoted : undefined;
  return linesValue(engine, [{ packageId, quantity: qty }], prop, !!inCart, line && [line]);
}
