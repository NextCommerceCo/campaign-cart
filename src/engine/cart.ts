import type { Context } from './engine';
import type { ApiLine, CartGroup, CartLine, CartState } from './types';

const lineKey = (l: CartLine) =>
  `${l.packageId}|${l.isUpsell ? 1 : 0}|${JSON.stringify(Object.entries(l.properties ?? {}).sort())}`;

export function mergeLines(groups: Record<string, CartGroup>): ApiLine[] {
  const merged = new Map<string, ApiLine>();
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

export function emptyCart(): CartState {
  return { groups: {}, coupons: [], dismissed: [], calculating: false };
}

export function createCart(ctx: Context) {
  let seq = 0;
  let abort: AbortController | undefined;
  let pending: Promise<void> | undefined;

  const state = () => ctx.getState().cart;
  const lines = () => mergeLines(state().groups);

  const vouchers = () => {
    const all = new Set(state().coupons);
    for (const group of Object.values(state().groups)) group.vouchers.forEach((v) => all.add(normalizeCode(v)));
    return [...all];
  };

  const set = (patch: Partial<CartState>) => {
    ctx.update('cart', patch);
    ctx.emit('cart.updated', { cart: state() });
  };

  const calculate = async (): Promise<void> => {
    const current = ++seq;
    abort?.abort();
    const campaign = ctx.getState().campaign;
    if (!lines().length || !campaign) {
      if (state().calculating) set({ calculating: false });
      return;
    }
    const controller = (abort = new AbortController());
    try {
      const summary = await ctx.api.calculate(
        { lines: lines(), vouchers: vouchers(), currency: campaign.currency, shipping_method: state().shippingId },
        controller.signal,
      );
      if (current !== seq) return;
      set({ summary, calculating: false });
      ctx.emit('cart.calculated', { summary });
    } catch (err) {
      if (current !== seq) return;
      set({ calculating: false });
      ctx.fail('calculate', err);
    }
  };

  const recalculate = (): Promise<void> =>
    (pending ??= Promise.resolve().then(() => {
      pending = undefined;
      return calculate();
    }));

  const commit = (patch: Partial<CartState>): Promise<void> => {
    const groups = patch.groups ?? state().groups;
    const hasLines = mergeLines(groups).length > 0;
    set({
      ...patch,
      ...(!hasLines && { summary: undefined }),
      calculating: hasLines && !!ctx.getState().campaign,
    });
    return recalculate();
  };

  const knownOnly = (groups: Record<string, CartGroup>) => {
    const known = (l: CartLine) => !!ctx.getPackage(l.packageId);
    const unknown = Object.values(groups).flatMap((g) => g.lines.filter((l) => !known(l)));
    if (!unknown.length) return groups;
    ctx.fail('cart', new Error(`removed unknown package ids ${unknown.map((l) => l.packageId).join(', ')}`));
    return Object.fromEntries(
      Object.entries(groups)
        .map(([id, g]) => [id, { ...g, lines: g.lines.filter(known) }] as const)
        .filter(([, g]) => g.lines.length),
    );
  };

  const setGroup = (id: string, group: CartGroup | null, options: { dismiss?: boolean } = {}) => {
    const groups = { ...state().groups };
    const keep = !!group && group.lines.some((l) => l.quantity > 0);
    if (keep) groups[id] = group;
    else delete groups[id];
    const dismissed = state().dismissed.filter((d) => d !== id);
    if (!keep && options.dismiss) dismissed.push(id);
    return commit({ groups, dismissed });
  };

  const setQuantity = (packageId: number, quantity: number) => {
    const groups: Record<string, CartGroup> = {};
    for (const [id, group] of Object.entries(state().groups)) {
      const kept = group.lines
        .map((l) => (l.packageId === packageId ? { ...l, quantity } : l))
        .filter((l) => l.quantity > 0);
      if (kept.length) groups[id] = { ...group, lines: kept };
    }
    return commit({ groups });
  };

  return {
    lines,
    vouchers,
    recalculate,
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
    applyCoupon(code: string) {
      const normalized = normalizeCode(code);
      if (!normalized || state().coupons.includes(normalized)) return Promise.resolve();
      return commit({ coupons: [...state().coupons, normalized] });
    },
    removeCoupon: (code: string) => commit({ coupons: state().coupons.filter((c) => c !== normalizeCode(code)) }),
    setShipping(shippingId: number | undefined) {
      if (shippingId === state().shippingId) return Promise.resolve();
      const done = commit({ shippingId });
      ctx.emit('shipping.changed', { methodId: shippingId });
      return done;
    },
  };
}

export type CartActions = ReturnType<typeof createCart>;
