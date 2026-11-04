import { failureOf } from '../api';
import type { Context } from '../engine';
import type { State } from '../types';
import type { Cart, CartChange, CartItem, Checkout, Discount, EventMap, Selector } from '../events';
import type {
  Line,
  CartGroup,
  CartLine,
  CartOperation,
  CartState,
  CartSummary,
  ReportedLine,
  SummaryDiscount,
  SummaryLine,
} from './types';

const TOGGLE = 'toggle:';

export const toggleGroup = (packageId: number) => TOGGLE + packageId;

export const lineKey = (l: CartLine) =>
  `${l.packageId}|${l.isUpsell ? 1 : 0}|${JSON.stringify(Object.entries(l.properties ?? {}).sort())}`;

export const apiLines = (lines: CartLine[]) => mergeLines({ lines: { lines, vouchers: [] } });

export function mergeLines(groups: Record<string, CartGroup>): Line[] {
  const merged = new Map<string, Line>();
  for (const group of Object.values(groups)) {
    for (const line of group.lines) {
      const key = lineKey(line);
      const existing = merged.get(key);
      if (existing) existing.quantity += line.quantity;
      else
        merged.set(key, {
          package_id: line.packageId,
          quantity: line.quantity,
          ...(line.isUpsell && { is_upsell: true }),
          ...(line.properties && Object.keys(line.properties).length && { properties: line.properties }),
        });
    }
  }
  return [...merged.values()].filter((l) => l.quantity > 0);
}

const normalizeCode = (code: string) => code.trim().toUpperCase();

const cents = (amount: string | undefined) => Math.round(Number(amount ?? 0) * 100);
const money = (amount: string | undefined) => cents(amount) / 100;
const sum = (amounts: number[]) => Math.round(amounts.reduce((n, a) => n + a * 100, 0)) / 100;

const discountOf = (d: SummaryDiscount, coupons: string[]): Discount => {
  const code = d.description?.toUpperCase();
  const coupon = !!code && coupons.includes(code);
  return {
    name: d.name ?? '',
    amount: money(d.amount),
    source: coupon ? 'coupon' : 'offer',
    ...(coupon && { code }),
    offer_id: d.offer_id ?? 0,
  };
};

export function cartItem(state: State, line: Line, priced?: SummaryLine): CartItem {
  const p = state.campaign?.packages.find((pk) => pk.ref_id === line.package_id);
  const interval = p?.is_recurring && p.interval ? p.interval : undefined;
  return {
    ...line,
    ...(p?.product_id !== undefined && { product_id: p.product_id }),
    ...(p?.product_name && { product_title: p.product_name }),
    ...(p?.product_variant_id !== undefined && { variant_id: p.product_variant_id }),
    ...(p?.product_variant_name && { variant_title: p.product_variant_name }),
    ...(p?.image && { image: p.image }),
    ...(priced && {
      price: money(priced.package_price),
      original_price: money(priced.original_package_price),
      total_discount: money(priced.total_discount),
      total: money(priced.total),
      discounts: priced.discounts.map((d) => discountOf(d, state.cart.coupons)),
    }),
    ...(interval && {
      subscription: {
        interval,
        interval_count: p!.interval_count ?? 1,
        ...(priced?.price_recurring && {
          price: money(priced.price_recurring),
          original_price: money(priced.original_recurring_price ?? priced.price_recurring),
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
  return {
    selector_id: id,
    type: 'toggle',
    lines: items,
    ...(currency && { currency }),
    ...(priced && { total: sum(items.map((l) => l.total!)) }),
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
        price: money(method.price),
        original_price: money(method.original_price),
        discounts: (method.discounts ?? []).map((d) => discountOf(d, coupons)),
      }
    : shippingId !== undefined
      ? { id: shippingId, ...(listed && { code: listed.code }) }
      : undefined;
  const byOffer = new Map<number, Discount>();
  for (const d of lines.flatMap((l) => l.discounts ?? [])) {
    const seen = byOffer.get(d.offer_id);
    byOffer.set(d.offer_id, seen ? { ...seen, amount: sum([seen.amount, d.amount]) } : d);
  }
  return {
    lines,
    coupons,
    ...(campaign && { currency: campaign.currency }),
    ...(shipping_method && { shipping_method }),
    ...(summary && {
      subtotal: money(summary.subtotal),
      total_discount: sum(lines.map((l) => l.total_discount ?? 0)),
      total: money(summary.total),
      discounts: [...byOffer.values()],
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

function addsDiscount(without: CartSummary, withCode: CartSummary): boolean {
  const ids = (s: CartSummary) =>
    new Set(
      [...s.voucher_discounts, ...s.offer_discounts, ...(s.shipping_method?.discounts ?? [])].map((d) => d.offer_id),
    );
  const before = ids(without);
  return [...ids(withCode)].some((id) => !before.has(id)) || cents(withCode.total) < cents(without.total);
}

export const shippingMethodOf = (state: State) => state.cart.shippingId ?? state.campaign?.shipping_methods[0]?.ref_id;

export function emptyCart(): CartState {
  return { groups: {}, coupons: [], held: [], dismissed: [], calculating: false, frozen: false };
}

const quantities = (groups: Record<string, CartGroup>) => {
  const by = new Map<number, number>();
  for (const l of mergeLines(groups)) by.set(l.package_id, (by.get(l.package_id) ?? 0) + l.quantity);
  return by;
};

const toggleOn = (groups: Record<string, CartGroup>, id: string) =>
  id.startsWith(TOGGLE) && !!groups[id]?.lines.some((l) => l.quantity > 0);

export function createCart(ctx: Context) {
  let seq = 0;
  let abort: AbortController | undefined;
  let pending: Promise<void> | undefined;
  let running: Promise<void> | undefined;
  let busy = false;
  let unpriced = false;
  let shippingAt: number | undefined;
  let checkingHeld = false;
  let checks: Promise<unknown> = Promise.resolve();
  const waiting = new Map<string, (applied: boolean) => void>();
  const checking = new Map<string, object>();

  const state = () => ctx.getState().cart;
  const lines = () => mergeLines(state().groups);

  const vouchers = () => {
    const all = new Set(state().coupons);
    for (const group of Object.values(state().groups)) group.vouchers.forEach((v) => all.add(normalizeCode(v)));
    return [...all];
  };

  const set = (patch: Partial<CartState>) => ctx.update('cart', patch);

  const price = (codes: string[], signal?: AbortSignal) =>
    ctx.api.calculate(
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
        ...(charged !== undefined && { price: money(charged) }),
      });
    }
    return { added, removed };
  };

  const announceShipping = (run: number, summary?: CartSummary) => {
    if (shippingAt === undefined || run <= shippingAt) return;
    shippingAt = undefined;
    const method = cartOf(summary).shipping_method;
    if (method) ctx.emit('shipping.selected', method);
  };

  const deny = (code: string, reason: EventMap['coupon.denied']['reason'], message?: string) =>
    ctx.emit('coupon.denied', { code, reason, ...(message && { message }) });

  const discountsOf = (code: string, summary: CartSummary) => {
    const cart = cartOf(summary);
    const discounts = [...(cart.discounts ?? []), ...(cart.shipping_method?.discounts ?? [])].filter(
      (d) => d.code === code,
    );
    return discounts.length ? { amount: sum(discounts.map((d) => d.amount)), discounts } : {};
  };

  const answer = (code: string, applied: boolean) => {
    waiting.get(code)?.(applied);
    waiting.delete(code);
  };

  const unheld = (code: string) => state().held.filter((c) => c !== code);

  const check = (code: string) => {
    const run = {};
    checking.set(code, run);
    const go = async (): Promise<'applied' | 'denied' | 'frozen' | 'dropped'> => {
      let without: CartSummary | undefined;
      let withCode: CartSummary | undefined;
      let error: unknown;
      try {
        await settled();
        const base = vouchers();
        without = settledSummary() || (await price(base));
        withCode = await price([...base, code]);
      } catch (err) {
        error = err;
      }
      if (checking.get(code) !== run) return 'dropped';
      checking.delete(code);
      if (state().frozen) return 'frozen';
      if (!withCode) {
        ctx.fail('coupon.check', error);
        deny(code, 'check_failed', failureOf(error).message);
        return 'denied';
      }
      if (!addsDiscount(without!, withCode)) {
        deny(code, 'no_discount');
        return 'denied';
      }
      const done = commit({ coupons: [...state().coupons, code], held: unheld(code) });
      ctx.emit('coupon.applied', { code, ...discountsOf(code, withCode) });
      await done;
      return 'applied';
    };
    return (checks = checks.then(go, go));
  };

  const checkHeld = async () => {
    if (checkingHeld) return;
    checkingHeld = true;
    try {
      for (let code = state().held[0]; code !== undefined; code = state().held[0]) {
        if (state().frozen || !lines().length) break;
        const result = await check(code);
        if (result === 'frozen') break;
        if (result === 'denied') set({ held: unheld(code) });
        if (result !== 'dropped') answer(code, result === 'applied');
      }
    } finally {
      checkingHeld = false;
    }
  };

  const calculate = async (): Promise<void> => {
    const current = ++seq;
    abort?.abort();
    if (!lines().length || !ctx.getState().campaign) {
      if (state().calculating) set({ calculating: false });
      busy = false;
      announceShipping(current);
      return;
    }
    if (!state().calculating) set({ calculating: true });
    if (!busy) {
      busy = true;
      ctx.emit('cart.calculating', cartOf());
    }
    const controller = (abort = new AbortController());
    try {
      const summary = await price(vouchers(), controller.signal);
      if (current !== seq) return;
      busy = false;
      unpriced = false;
      set({ summary, calculating: false });
      ctx.emit('cart.calculated', cartOf(summary));
      announceShipping(current, summary);
      if (state().held.length && !state().frozen) void checkHeld();
    } catch (err) {
      if (current !== seq) return;
      busy = false;
      unpriced = true;
      set({ calculating: false });
      ctx.fail('cart.calculate', err);
      announceShipping(current);
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

  const commit = (patch: Partial<CartState>, lastOperation?: CartOperation): Promise<void> => {
    if (state().frozen) return Promise.resolve();
    const before = state().groups;
    const after = patch.groups ?? before;
    const priced = state().summary?.lines;
    const hasLines = mergeLines(after).length > 0;
    set({
      ...patch,
      lastOperation,
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
    const { added, removed } = changesOf(quantities(before), quantities(after), priced);
    if (removed.length) ctx.emit('cart.removed', { ...cart, changes: removed });
    if (added.length) ctx.emit('cart.added', { ...cart, changes: added });
    return recalculate();
  };

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
      seq++;
      abort?.abort();
      shippingAt = undefined;
      waiting.forEach((done) => done(false));
      waiting.clear();
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
      const { coupons, held } = state();
      checking.clear();
      const done = commit({ groups: {}, coupons: [], held: [], dismissed: [] }, { action: 'clear' });
      for (const code of coupons) ctx.emit('coupon.removed', { code, reason: 'cleared' });
      for (const code of held) answer(code, false);
      return done;
    },
    async applyCoupon(code: string): Promise<boolean> {
      const normalized = normalizeCode(code);
      if (state().frozen || !normalized) return false;
      if (vouchers().includes(normalized) || state().held.includes(normalized) || checking.has(normalized)) {
        deny(normalized, 'duplicate');
        return false;
      }
      if (lines().length && ctx.getState().campaign) return (await check(normalized)) === 'applied';
      set({ held: [...state().held, normalized] });
      return new Promise((done) => waiting.set(normalized, done));
    },
    removeCoupon(code: string): Promise<void> {
      const normalized = normalizeCode(code);
      if (state().frozen) return Promise.resolve();
      checking.delete(normalized);
      if (state().held.includes(normalized)) {
        set({ held: unheld(normalized) });
        answer(normalized, false);
      }
      if (!state().coupons.includes(normalized)) return Promise.resolve();
      const done = commit({ coupons: state().coupons.filter((c) => c !== normalized) });
      ctx.emit('coupon.removed', { code: normalized, reason: 'shopper' });
      return done;
    },
    setShipping(shippingId: number | undefined) {
      if (state().frozen || shippingId === state().shippingId) return Promise.resolve();
      shippingAt = seq;
      return commit({ shippingId });
    },
  };
}

export type CartActions = ReturnType<typeof createCart>;
