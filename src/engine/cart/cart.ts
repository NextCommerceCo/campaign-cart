import { latestWins } from '../flow';
import { dollars } from '../format';
import { mergeLines, normalizeCode, quantities, toggleOn } from './lines';
import { publicCart, publicCheckout, publicToggle, shippingMethodOf } from './public';
import { createCoupons } from './coupons';
import { createQuotes } from './quotes';
import type { Context } from '../engine';
import type { Cart, CartChange } from '../events/carts';
import type { CartGroup, CartLine, CartOperation, CartState, CartSummary, ReportedLine, SummaryLine } from './types';

/** The cart action behind the `changes` of each `cart.added` and `cart.removed`, for the 0.4.x item events. */
export const operations = new WeakMap<CartChange[], CartOperation | undefined>();

export function emptyCart(): CartState {
  return { groups: {}, coupons: [], held: [], dismissed: [], calculating: false, frozen: false };
}

export function createCart(ctx: Context) {
  const quotes = createQuotes(ctx);
  const pricing = latestWins();
  let pending: Promise<void> | undefined;
  let running: Promise<void> | undefined;
  let busy = false;
  let unpriced = false;
  let shippingAt: number | undefined;

  const state = () => ctx.getState().cart;
  const lines = () => mergeLines(state().groups);

  const vouchers = () => {
    const all = new Set(state().coupons);
    for (const group of Object.values(state().groups)) group.vouchers.forEach((v) => all.add(normalizeCode(v)));
    return [...all];
  };

  const set = (patch: Partial<CartState>) => ctx.update('cart', patch);

  const price = (codes: string[], signal?: AbortSignal) =>
    quotes.calculate(
      {
        lines: lines(),
        vouchers: codes,
        currency: ctx.getState().campaign!.currency,
        shipping_method: shippingMethodOf(ctx.getState()),
      },
      { signal },
    );

  const cartOf = (summary?: CartSummary): Cart => publicCart(ctx.getState(), summary);
  const settledSummary = () => (state().calculating || unpriced ? undefined : state().summary);
  const currentCheckout = () => publicCheckout(ctx.getState(), settledSummary());

  const changesOf = (before: Map<number, number>, after: Map<number, number>, priced: SummaryLine[] = []) => {
    const added: CartChange[] = [];
    const removed: CartChange[] = [];
    for (const id of new Set([...before.keys(), ...after.keys()])) {
      const from = before.get(id) ?? 0;
      const to = after.get(id) ?? 0;
      if (from === to) continue;
      const p = ctx.getPackage(id);
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
  };

  const settleShipping = (run: number, summary?: CartSummary) => {
    if (shippingAt === undefined || run <= shippingAt) return;
    shippingAt = undefined;
    const method = cartOf(summary).shipping_method;
    if (method) ctx.emit('shipping.settled', method);
  };

  const calculate = async (): Promise<void> => {
    const { run, signal, stale } = pricing.start();
    if (!lines().length || !ctx.getState().campaign) {
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
      const summary = await price(vouchers(), signal);
      if (stale()) return;
      busy = false;
      unpriced = false;
      set({ summary, calculating: false });
      ctx.emit('cart.calculated', cartOf(summary));
      settleShipping(run, summary);
      if (state().held.length && !state().frozen) void coupons.checkHeld();
    } catch (err) {
      if (stale()) return;
      busy = false;
      unpriced = true;
      set({ calculating: false });
      ctx.fail('cart.calculate', err);
      settleShipping(run);
    }
  };

  const recalculate = (): Promise<void> =>
    (pending ??= Promise.resolve().then(() => {
      pending = undefined;
      return (running = calculate());
    }));

  const settled = async (): Promise<void> => {
    for (let next = pending ?? running; next; next = pending ?? running) {
      await next;
      if (running === next) running = undefined;
    }
  };

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
    const { added, removed } = changesOf(quantities(before), quantities(after), priced);
    operations.set(added, operation).set(removed, operation);
    if (removed.length) ctx.emit('cart.removed', { ...cart, changes: removed });
    if (added.length) ctx.emit('cart.added', { ...cart, changes: added });
    return recalculate();
  };

  const coupons = createCoupons(ctx, { vouchers, lines, price, settled, settledSummary, cartOf, commit });

  const knownOnly = (groups: Record<string, CartGroup>) => {
    const known = (l: CartLine) => !!ctx.getPackage(l.packageId);
    const unknown = Object.values(groups).flatMap((g) => g.lines.filter((l) => !known(l)));
    if (!unknown.length) return groups;
    ctx.log.warn(`removed package ids the campaign does not have: ${unknown.map((l) => l.packageId).join(', ')}`);
    return Object.fromEntries(
      Object.entries(groups)
        .map(([id, g]) => [id, { ...g, lines: g.lines.filter(known) }] as const)
        .filter(([, g]) => g.lines.length),
    );
  };

  const setGroup = (
    id: string,
    group: CartGroup | null,
    options: { dismiss?: boolean } = {},
    action: CartOperation['action'] = 'setGroup',
  ) => {
    if (state().frozen) return Promise.resolve();
    const groups = { ...state().groups };
    const keep = !!group && group.lines.some((l) => l.quantity > 0);
    if (keep) groups[id] = group;
    else delete groups[id];
    const dismissed = state().dismissed.filter((d) => d !== id);
    if (!keep && options.dismiss) dismissed.push(id);
    return commit({ groups, dismissed }, { action, group: id });
  };

  const setQuantity = (packageId: number, quantity: number, action: CartOperation['action'] = 'setQuantity') => {
    const total = lines().reduce((n, l) => n + (l.package_id === packageId ? l.quantity : 0), 0);
    let delta = Math.max(0, quantity) - total;
    if (!delta) return Promise.resolve();
    const groups = Object.fromEntries(
      Object.entries(state().groups).map(([id, g]) => [id, { ...g, lines: g.lines.map((l) => ({ ...l })) }]),
    );
    if (delta > 0) {
      const id = ['items', ...Object.keys(groups)].find((g) => groups[g]?.lines.some((l) => l.packageId === packageId));
      const group = (groups[id ?? 'items'] ??= { lines: [], vouchers: [] });
      const line = group.lines.find((l) => l.packageId === packageId);
      if (line) line.quantity += delta;
      else group.lines.push({ packageId, quantity: delta });
    } else {
      for (const group of Object.values(groups).reverse()) {
        for (const line of [...group.lines].reverse()) {
          if (line.packageId !== packageId || !delta) continue;
          const take = Math.min(line.quantity, -delta);
          line.quantity -= take;
          delta += take;
        }
      }
    }
    for (const [id, group] of Object.entries(groups)) {
      group.lines = group.lines.filter((l) => l.quantity > 0);
      if (!group.lines.length) delete groups[id];
    }
    return commit({ groups }, { action });
  };

  return {
    quotes,
    lines,
    vouchers,
    current: () => cartOf(settledSummary()),
    currentCheckout,
    recalculate,
    settled,
    freeze: (frozen: boolean) => set({ frozen }),
    markReported(reported: ReportedLine[], added: boolean) {
      ctx.update('cart', { reported, added: state().added || added }, { silent: true });
    },
    clearAfterOrder() {
      pricing.cancel();
      shippingAt = undefined;
      coupons.dropAll();
      ctx.update(
        'cart',
        { ...emptyCart(), summary: undefined, shippingId: undefined, frozen: true, reported: [] },
        { silent: true },
      );
    },
    campaignLoaded(): Promise<void> {
      const groups = knownOnly(state().groups);
      return groups !== state().groups ? commit({ groups }) : lines().length ? recalculate() : Promise.resolve();
    },
    setGroup,
    setGroups: (groups: Record<string, CartGroup>) => commit({ groups }, { action: 'setGroups' }),
    setQuantity,
    removeItem: (packageId: number) => setQuantity(packageId, 0, 'removeItem'),
    addItem(packageId: number, quantity = 1, groupId = 'items') {
      const current = state().groups[groupId] ?? { lines: [], vouchers: [] };
      const existing = current.lines.find((l) => l.packageId === packageId);
      const next = existing
        ? current.lines.map((l) => (l.packageId === packageId ? { ...l, quantity: l.quantity + quantity } : l))
        : [...current.lines, { packageId, quantity }];
      return setGroup(groupId, { ...current, lines: next }, {}, 'addItem');
    },
    clear(): Promise<void> {
      if (state().frozen) return Promise.resolve();
      const { coupons: applied, held } = state();
      coupons.stopChecks();
      const done = commit({ groups: {}, coupons: [], held: [], dismissed: [] }, { action: 'clear' }, () => {
        for (const code of applied) ctx.emit('coupon.removed', { code, reason: 'cleared' });
      });
      for (const code of held) coupons.answer(code, false);
      return done;
    },
    applyCoupon: (code: string) => coupons.apply(code),
    removeCoupon: (code: string) => coupons.remove(code),
    setShipping(shippingId: number | undefined) {
      if (state().frozen || shippingId === state().shippingId) return Promise.resolve();
      shippingAt = pricing.current();
      return commit({ shippingId });
    },
  };
}

export type CartActions = ReturnType<typeof createCart>;
