import type { Context } from '../engine';
import type { State } from '../types';
import type { Cart, CartChange, CartItem, Discount } from '../events';
import type {
  Line,
  CartGroup,
  CartLine,
  CartState,
  CartSummary,
  ReportedLine,
  SummaryDiscount,
  SummaryLine,
} from './types';

export const toggleGroup = (packageId: number) => `toggle:${packageId}`;

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

export function cartItems(state: State, lines: Line[], priced?: SummaryLine[]): CartItem[] {
  const fresh =
    priced?.length === lines.length &&
    lines.every((l, i) => priced[i]!.package_id === l.package_id && priced[i]!.quantity === l.quantity);
  return lines.map((l, i) => cartItem(state, l, fresh ? priced[i] : undefined));
}

export function publicCart(state: State, summary?: CartSummary): Cart {
  const { coupons, shippingId } = state.cart;
  const campaign = state.campaign;
  const lines = mergeLines(state.cart.groups).map((line, i) =>
    cartItem(state, line, summary?.lines[i]?.package_id === line.package_id ? summary.lines[i] : undefined),
  );
  const listed = campaign?.shipping_methods.find((m) => m.ref_id === shippingId);
  const priced = summary?.shipping_method;
  const shipping_method = priced
    ? {
        id: priced.id,
        code: priced.code,
        name: priced.name,
        price: money(priced.price),
        original_price: money(priced.original_price),
        discounts: (priced.discounts ?? []).map((d) => discountOf(d, coupons)),
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
  return { groups: {}, coupons: [], dismissed: [], calculating: false, frozen: false };
}

export function createCart(ctx: Context) {
  let seq = 0;
  let abort: AbortController | undefined;
  let pending: Promise<void> | undefined;
  let running: Promise<void> | undefined;
  let busy = false;

  const state = () => ctx.getState().cart;
  const lines = () => mergeLines(state().groups);

  const vouchers = () => {
    const all = new Set(state().coupons);
    for (const group of Object.values(state().groups)) group.vouchers.forEach((v) => all.add(normalizeCode(v)));
    return [...all];
  };

  const set = (patch: Partial<CartState>) => ctx.update('cart', patch);
  const unchecked = new Set<string>();

  const price = (codes: string[]) =>
    ctx.api.calculate({
      lines: lines(),
      vouchers: codes,
      currency: ctx.getState().campaign!.currency,
      shipping_method: shippingMethodOf(ctx.getState()),
    });

  const changes = new Map<number, { quantity: number; price?: string }>();
  const quantities = () => {
    const by = new Map<number, number>();
    for (const l of lines()) by.set(l.package_id, (by.get(l.package_id) ?? 0) + l.quantity);
    return by;
  };
  const listed = (id: number) => money(ctx.getPackage(id)?.price_total);

  const track = (before: Map<number, number>, prices: SummaryLine[] | undefined) => {
    const after = quantities();
    for (const id of new Set([...before.keys(), ...after.keys()])) {
      const delta = (after.get(id) ?? 0) - (before.get(id) ?? 0);
      if (!delta) continue;
      const change = changes.get(id) ?? { quantity: 0 };
      change.quantity += delta;
      change.price ??= prices?.find((l) => l.package_id === id)?.package_price;
      changes.set(id, change);
    }
  };

  const cartOf = (summary?: CartSummary): Cart => publicCart(ctx.getState(), summary);

  const announce = (summary?: CartSummary) => {
    const added: CartChange[] = [];
    const removed: CartChange[] = [];
    for (const [id, change] of changes) {
      const p = ctx.getPackage(id);
      const product = {
        ...(p?.product_id !== undefined && { product_id: p.product_id }),
        ...(p?.product_variant_id !== undefined && { variant_id: p.product_variant_id }),
      };
      const now = summary?.lines.find((l) => l.package_id === id)?.package_price;
      if (change.quantity > 0)
        added.push({ package_id: id, ...product, quantity: change.quantity, price: now ? money(now) : listed(id) });
      if (change.quantity < 0)
        removed.push({
          package_id: id,
          ...product,
          quantity: -change.quantity,
          price: change.price ? money(change.price) : listed(id),
        });
    }
    changes.clear();
    if (removed.length) ctx.emit('cart.removed', { ...cartOf(summary), changes: removed });
    if (added.length) ctx.emit('cart.added', { ...cartOf(summary), changes: added });
  };

  const refuse = (code: string) => {
    ctx.emit('coupon.denied', { code });
    return commit({ coupons: state().coupons.filter((c) => c !== code) });
  };

  const recheck = async (withAll: CartSummary) => {
    for (const code of [...unchecked]) {
      unchecked.delete(code);
      if (!state().coupons.includes(code)) continue;
      try {
        if (!addsDiscount(await price(vouchers().filter((v) => v !== code)), withAll)) await refuse(code);
      } catch {
        unchecked.add(code);
      }
    }
  };

  const calculate = async (): Promise<void> => {
    const current = ++seq;
    abort?.abort();
    const campaign = ctx.getState().campaign;
    if (!lines().length || !campaign) {
      if (state().calculating) set({ calculating: false });
      busy = false;
      if (!lines().length) announce();
      return;
    }
    if (!busy) {
      busy = true;
      ctx.emit('cart.calculating', cartOf());
    }
    const controller = (abort = new AbortController());
    try {
      const summary = await ctx.api.calculate(
        {
          lines: lines(),
          vouchers: vouchers(),
          currency: campaign.currency,
          shipping_method: shippingMethodOf(ctx.getState()),
        },
        { signal: controller.signal },
      );
      if (current !== seq) return;
      busy = false;
      set({ summary, calculating: false });
      announce(summary);
      ctx.emit('cart.calculated', cartOf(summary));
      if (unchecked.size) void recheck(summary);
    } catch (err) {
      if (current !== seq) return;
      busy = false;
      set({ calculating: false });
      ctx.fail('cart.calculate', err);
      announce();
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

  const commit = (patch: Partial<CartState>): Promise<void> => {
    if (state().frozen) return Promise.resolve();
    const groups = patch.groups ?? state().groups;
    const hasLines = mergeLines(groups).length > 0;
    const before = quantities();
    const prices = state().summary?.lines;
    set({
      ...patch,
      ...(!hasLines && { summary: undefined }),
      calculating: hasLines && !!ctx.getState().campaign,
    });
    track(before, prices);
    ctx.emit('cart.updated', cartOf());
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

  const setGroup = (id: string, group: CartGroup | null, options: { dismiss?: boolean } = {}) => {
    const groups = { ...state().groups };
    const keep = !!group && group.lines.some((l) => l.quantity > 0);
    if (id.startsWith('toggle:') && keep !== !!groups[id]) {
      const lines = apiLines(group?.lines ?? []);
      const quoted = lines.map((l) => ctx.getState().toggles[l.package_id]?.line).filter((l) => !!l);
      ctx.emit(
        keep ? 'selector.selected' : 'selector.deselected',
        keep
          ? { selector_id: id, type: 'toggle', lines: cartItems(ctx.getState(), lines, quoted) }
          : { selector_id: id, type: 'toggle' },
      );
    }
    if (keep) groups[id] = group;
    else delete groups[id];
    const dismissed = state().dismissed.filter((d) => d !== id);
    if (!keep && options.dismiss) dismissed.push(id);
    return commit({ groups, dismissed });
  };

  const setQuantity = (packageId: number, quantity: number) => {
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
    return commit({ groups });
  };

  return {
    lines,
    vouchers,
    recalculate,
    settled,
    freeze: (frozen: boolean) => set({ frozen }),
    markReported(reported: ReportedLine[], added: boolean) {
      ctx.update('cart', { reported, added: state().added || added }, { silent: true });
    },
    clearAfterOrder() {
      changes.clear();
      seq++;
      abort?.abort();
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
    setGroups: (groups: Record<string, CartGroup>) => commit({ groups }),
    setQuantity,
    removeItem: (packageId: number) => setQuantity(packageId, 0),
    addItem(packageId: number, quantity = 1, groupId = 'items') {
      const current = state().groups[groupId] ?? { lines: [], vouchers: [] };
      const existing = current.lines.find((l) => l.packageId === packageId);
      const next = existing
        ? current.lines.map((l) => (l.packageId === packageId ? { ...l, quantity: l.quantity + quantity } : l))
        : [...current.lines, { packageId, quantity }];
      return setGroup(groupId, { ...current, lines: next });
    },
    clear: () => commit({ groups: {}, coupons: [], dismissed: [] }),
    async applyCoupon(code: string): Promise<boolean> {
      const normalized = normalizeCode(code);
      if (!normalized || vouchers().includes(normalized)) return false;
      if (!lines().length || !ctx.getState().campaign) unchecked.add(normalized);
      else {
        await settled();
        try {
          const without = state().summary ?? (await price(vouchers()));
          if (!addsDiscount(without, await price([...vouchers(), normalized]))) {
            ctx.emit('coupon.denied', { code: normalized });
            return false;
          }
        } catch (err) {
          ctx.fail('coupon.check', err);
          return false;
        }
        if (state().coupons.includes(normalized)) return false;
      }
      const done = commit({ coupons: [...state().coupons, normalized] });
      ctx.emit('coupon.applied', { code: normalized });
      await done;
      return true;
    },
    removeCoupon(code: string): Promise<void> {
      const normalized = normalizeCode(code);
      if (!state().coupons.includes(normalized)) return Promise.resolve();
      const done = commit({ coupons: state().coupons.filter((c) => c !== normalized) });
      ctx.emit('coupon.removed', { code: normalized });
      return done;
    },
    setShipping(shippingId: number | undefined) {
      if (shippingId === state().shippingId) return Promise.resolve();
      const done = commit({ shippingId });
      const method = ctx.getState().campaign?.shipping_methods.find((m) => m.ref_id === shippingId);
      ctx.emit('shipping.selected', {
        method_id: shippingId,
        ...(method && { method: { ref_id: method.ref_id, code: method.code, price: method.price } }),
      });
      return done;
    },
  };
}

export type CartActions = ReturnType<typeof createCart>;
