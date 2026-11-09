import { latestWins } from '../runtime/flow';
import { knownOnly, mergeLines, quantities, toggleOn, vouchersOf, withItem, withQuantity } from './lines';
import { changesOf, publicCart, publicCheckout, publicToggle, shippingMethodOf } from './public';
import { createCoupons } from './coupons';
import { createQuotes, type Quotes } from './quotes';
import type { Context } from '../engine';
import type { Cart, CartChange } from '../events/carts';
import type { Checkout } from '../events/checkout';
import type { CartGroup, CartOperation, CartState, CartSummary, Line, ReportedLine } from './types';

/** The cart action behind the `changes` of each `cart.added` and `cart.removed`, for the 0.4.x item events. */
export const operations = new WeakMap<CartChange[], CartOperation | undefined>();

export interface CartActions {
  quotes: Quotes;
  lines(): Line[];
  /** The cart's first line of a package. */
  line(packageId: number): Line | undefined;
  vouchers(): string[];
  current(): Cart;
  currentCheckout(): Checkout;
  recalculate(): Promise<void>;
  settled(): Promise<void>;
  freeze(frozen: boolean): void;
  markReported(reported: ReportedLine[], added: boolean): void;
  clearAfterOrder(): void;
  campaignLoaded(): Promise<void>;
  setGroup(
    id: string,
    group: CartGroup | null,
    options?: { dismiss?: boolean },
    action?: CartOperation['action'],
  ): Promise<void>;
  setGroups(groups: Record<string, CartGroup>): Promise<void>;
  setQuantity(packageId: number, quantity: number, action?: CartOperation['action']): Promise<void>;
  removeItem(packageId: number): Promise<void>;
  addItem(packageId: number, quantity?: number, groupId?: string): Promise<void>;
  clear(): Promise<void>;
  applyCoupon(code: string): Promise<boolean>;
  removeCoupon(code: string): Promise<void>;
  setShipping(shippingId: number | undefined): Promise<void>;
}

export function emptyCart(): CartState {
  return { groups: {}, coupons: [], held: [], dismissed: [], calculating: false, frozen: false };
}

/** The cart's price: one calculation at a time, the latest wins; `settled()` waits for the last one. */
function createPricing(ctx: Context, quotes: Quotes, priced: () => void) {
  const pricing = latestWins();
  let pending: Promise<void> | undefined;
  let running: Promise<void> | undefined;
  let busy = false;
  let unpriced = false;
  let shippingAt: number | undefined;

  const state = () => ctx.getState().cart;
  const set = (patch: Partial<CartState>) => ctx.update('cart', patch);
  const cartOf = (summary?: CartSummary): Cart => publicCart(ctx.getState(), summary);

  const price = (codes: string[], signal?: AbortSignal) =>
    quotes.calculate(
      {
        lines: mergeLines(state().groups),
        vouchers: codes,
        currency: ctx.getState().campaign!.currency,
        shipping_method: shippingMethodOf(ctx.getState()),
      },
      { signal },
    );

  const settleShipping = (run: number, summary?: CartSummary) => {
    if (shippingAt === undefined || run <= shippingAt) return;
    shippingAt = undefined;
    const method = cartOf(summary).shipping_method;
    if (method) ctx.emit('shipping.settled', method);
  };

  const calculate = async (): Promise<void> => {
    const { run, signal, stale } = pricing.start();
    if (!mergeLines(state().groups).length || !ctx.getState().campaign) {
      if (state().calculating) set({ calculating: false });
      busy = false;
      settleShipping(run);
      return;
    }
    if (!state().calculating) set({ calculating: true });
    if (!busy) {
      busy = true;
      ctx.emit('cart.calculating', cartOf());
    }
    try {
      const summary = await price(vouchersOf(state()), signal);
      if (stale()) return;
      busy = false;
      unpriced = false;
      set({ summary, calculating: false });
      ctx.emit('cart.calculated', cartOf(summary));
      settleShipping(run, summary);
      priced();
    } catch (err) {
      if (stale()) return;
      busy = false;
      unpriced = true;
      set({ calculating: false });
      ctx.fail('cart.calculate', err);
      settleShipping(run);
    }
  };

  return {
    price,
    cartOf,
    settledSummary: () => (state().calculating || unpriced ? undefined : state().summary),
    recalculate: (): Promise<void> =>
      (pending ??= Promise.resolve().then(() => {
        pending = undefined;
        return (running = calculate());
      })),
    async settled(): Promise<void> {
      for (let next = pending ?? running; next; next = pending ?? running) {
        await next;
        if (running === next) running = undefined;
      }
    },
    shippingChanged: () => void (shippingAt = pricing.current()),
    cancel(): void {
      pricing.cancel();
      shippingAt = undefined;
    },
  };
}

export function createCart(ctx: Context): CartActions {
  const quotes = createQuotes(ctx);
  const state = () => ctx.getState().cart;
  const set = (patch: Partial<CartState>) => ctx.update('cart', patch);
  const lines = () => mergeLines(state().groups);
  const vouchers = () => vouchersOf(state());
  const pricing = createPricing(ctx, quotes, () => {
    if (state().held.length && !state().frozen) void coupons.checkHeld();
  });
  const { price, cartOf, settledSummary, recalculate, settled } = pricing;

  const commit = (patch: Partial<CartState>, operation?: CartOperation, also?: () => void): Promise<void> => {
    let done = Promise.resolve();
    ctx.batch(() => {
      done = apply(patch, operation);
      also?.();
    });
    return done;
  };

  const apply = (patch: Partial<CartState>, operation?: CartOperation): Promise<void> => {
    if (state().frozen) return Promise.resolve();
    const before = state().groups;
    const shipped = 'shippingId' in patch && patch.shippingId !== state().shippingId;
    const after = patch.groups ?? before;
    const priced = state().summary?.lines;
    const hasLines = mergeLines(after).length > 0;
    set({
      ...patch,
      ...(!hasLines && { summary: undefined }),
      calculating: hasLines && !!ctx.getState().campaign,
    });
    for (const id of Object.keys(before))
      if (toggleOn(before, id) && !toggleOn(after, id))
        ctx.emit('selector.deselected', publicToggle(ctx.getState(), id, before[id]));
    for (const id of Object.keys(after))
      if (toggleOn(after, id) && !toggleOn(before, id))
        ctx.emit('selector.selected', publicToggle(ctx.getState(), id, after[id]));
    const cart = cartOf();
    ctx.emit('cart.updated', cart);
    if (shipped && cart.shipping_method) ctx.emit('shipping.selected', cart.shipping_method);
    const { added, removed } = changesOf(ctx.getPackage, quantities(before), quantities(after), priced);
    operations.set(added, operation).set(removed, operation);
    if (removed.length) ctx.emit('cart.removed', { ...cart, changes: removed });
    if (added.length) ctx.emit('cart.added', { ...cart, changes: added });
    return recalculate();
  };

  const coupons = createCoupons(ctx, { vouchers, lines, price, settled, settledSummary, cartOf, commit });

  const setGroup: CartActions['setGroup'] = (id, group, options = {}, action = 'setGroup') => {
    if (state().frozen) return Promise.resolve();
    const groups = { ...state().groups };
    const keep = !!group && group.lines.some((l) => l.quantity > 0);
    if (keep) groups[id] = group;
    else delete groups[id];
    const dismissed = state().dismissed.filter((d) => d !== id);
    if (!keep && options.dismiss) dismissed.push(id);
    return commit({ groups, dismissed }, { action, group: id });
  };

  const setQuantity: CartActions['setQuantity'] = (packageId, quantity, action = 'setQuantity') => {
    const groups = withQuantity(state().groups, packageId, quantity);
    return groups ? commit({ groups }, { action }) : Promise.resolve();
  };

  return {
    quotes,
    lines,
    line: (packageId) => lines().find((l) => l.package_id === packageId),
    vouchers,
    current: () => cartOf(settledSummary()),
    currentCheckout: () => publicCheckout(ctx.getState(), settledSummary()),
    recalculate,
    settled,
    freeze: (frozen) => set({ frozen }),
    markReported(reported, added) {
      ctx.update('cart', { reported, added: state().added || added }, { silent: true });
    },
    clearAfterOrder() {
      pricing.cancel();
      coupons.dropAll();
      ctx.update(
        'cart',
        { ...emptyCart(), summary: undefined, shippingId: undefined, frozen: true, reported: [] },
        { silent: true },
      );
    },
    campaignLoaded() {
      const [groups, unknown] = knownOnly(state().groups, (l) => !!ctx.getPackage(l.packageId));
      if (!unknown.length) return lines().length ? recalculate() : Promise.resolve();
      ctx.log.warn(`removed package ids the campaign does not have: ${unknown.map((l) => l.packageId).join(', ')}`);
      return commit({ groups });
    },
    setGroup,
    setGroups: (groups) => commit({ groups }, { action: 'setGroups' }),
    setQuantity,
    removeItem: (packageId) => setQuantity(packageId, 0, 'removeItem'),
    addItem(packageId, quantity = 1, groupId = 'items') {
      const current = state().groups[groupId] ?? { lines: [], vouchers: [] };
      return setGroup(groupId, withItem(current, packageId, quantity), {}, 'addItem');
    },
    clear() {
      if (state().frozen) return Promise.resolve();
      const { coupons: applied, held } = state();
      coupons.stopChecks();
      const done = commit({ groups: {}, coupons: [], held: [], dismissed: [] }, { action: 'clear' }, () => {
        for (const code of applied) ctx.emit('coupon.removed', { code, reason: 'cleared' });
      });
      for (const code of held) coupons.answer(code, false);
      return done;
    },
    applyCoupon: (code) => coupons.apply(code),
    removeCoupon: (code) => coupons.remove(code),
    setShipping(shippingId) {
      if (state().frozen || shippingId === state().shippingId) return Promise.resolve();
      pricing.shippingChanged();
      return commit({ shippingId });
    },
  };
}
