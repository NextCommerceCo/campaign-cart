import type { CartActions } from './cart';
import { apiLines, lineKey, mergeLines } from './lines';
import { cartItems, optionPrice, unitsOf } from './public';
import type { Context } from '../engine';
import type { Selector, SelectorOption } from '../events/selectors';
import { keyedLatestWins } from '../flow';
import { cents } from '../format';
import { forcedBundle } from '../params';
import type { CartGroup, CartLine, SelectorState, SelectorCard, SelectorMode, Slot, SummaryLine } from './types';
import type { State } from '../types';

export const bundleGroup = (selectorId: string) => `bundle:${selectorId}`;

const typeOf = (selector: SelectorState): 'bundle' | 'offer' => (selector.mode === 'offer' ? 'offer' : 'bundle');

const clamp = (card: SelectorCard, quantity: number) =>
  Math.min(Math.max(Math.round(quantity), card.min ?? 1), card.max ?? 999);

export const cardQuantity = (selector: SelectorState, card: SelectorCard) =>
  selector.quantities?.[card.id] ?? clamp(card, card.quantity ?? 1);

const slotLine = (slot: Slot): CartLine => ({
  packageId: slot.packageId,
  quantity: 1,
  ...(slot.properties && Object.keys(slot.properties).length && { properties: slot.properties }),
});

export function cardSlots(selector: SelectorState, card: SelectorCard): Slot[] {
  const times = cardQuantity(selector, card);
  const chosen = selector.slots?.[card.id] ?? [];
  const base = card.lines.flatMap((l) => (l.configurable ? Array(l.quantity * times).fill(l.packageId) : []));
  return base.map((packageId: number, i) => chosen[i] ?? { packageId });
}

export function cardLines(selector: SelectorState, card: SelectorCard): CartLine[] {
  const times = cardQuantity(selector, card);
  const fixed = card.lines
    .filter((l) => !l.configurable)
    .map(({ configurable: _, ...l }) => (times === 1 ? l : { ...l, quantity: l.quantity * times }));
  return [...fixed, ...cardSlots(selector, card).map(slotLine)];
}

export function pickedCard(selector: SelectorState | undefined): SelectorCard | undefined {
  return selector?.cards.find((c) => c.id === selector.picked);
}

const groupKey = (g: CartGroup) =>
  [...g.lines.map((l) => `${lineKey(l)}x${l.quantity}`).sort(), ...[...g.vouchers].sort()].join(',');

function slotsIn(card: SelectorCard, group: CartGroup): Slot[] | undefined {
  const count = card.lines.reduce((n, l) => n + (l.configurable ? l.quantity : 0), 0);
  if (!count || card.lines.some((l) => !l.configurable)) return undefined;
  if (group.lines.length !== count || group.lines.some((l) => l.quantity !== 1)) return undefined;
  return group.lines.map((l) => ({ packageId: l.packageId, ...(l.properties && { properties: l.properties }) }));
}

function quantityIn(card: SelectorCard, group: CartGroup): number | undefined {
  if (slotsIn(card, group)) return 1;
  const first = card.lines[0];
  const times = first && (group.lines.find((l) => lineKey(l) === lineKey(first))?.quantity ?? 0) / first.quantity;
  if (!times || !Number.isInteger(times)) return undefined;
  const scaled = { lines: card.lines.map((l) => ({ ...l, quantity: l.quantity * times })), vouchers: card.vouchers };
  return groupKey(scaled) === groupKey(group) ? times : undefined;
}

const sumOf = (lines: SummaryLine[], field: 'total' | 'subtotal') =>
  lines.reduce((n, l) => n + cents(l[field]), 0) / 100;

function publicOption(state: State, selector: SelectorState, card: SelectorCard): SelectorOption {
  const quoted = selector.quotes?.[card.id]?.lines;
  const lines = cartItems(state, apiLines(cardLines(selector, card)), quoted);
  const priced = !!quoted && lines.every((l) => l.price !== undefined);
  const quantity = unitsOf(lines);
  const total = priced ? sumOf(quoted, 'total') : undefined;
  const subtotal = priced ? sumOf(quoted, 'subtotal') : undefined;
  return {
    option_id: card.id,
    lines,
    quantity,
    selected: selector.picked === card.id,
    ...(priced && { ...optionPrice(subtotal!, total!, quantity), total, original_total: subtotal }),
  };
}

export function createSelectors(ctx: Context, cart: CartActions) {
  const { quotes } = cart;
  const runs = keyedLatestWins<string>();
  const bound = new Set<string>();
  const viewed = new Set<string>();
  const quotedOn = new Map<string, string>();

  const get = (id: string): SelectorState | undefined => ctx.getState().selectors[id];
  const set = (id: string, patch: Partial<SelectorState>) =>
    ctx.update('selectors', { [id]: { ...get(id)!, ...patch } });
  const publicSelector = (id: string): Selector => {
    const state = ctx.getState();
    const selector = get(id)!;
    const options = selector.cards.map((card) => publicOption(state, selector, card));
    const picked = options.find((o) => o.option_id === selector.picked);
    const card = pickedCard(selector);
    const group = state.cart.groups[bundleGroup(id)];
    const inCart =
      !!card && !!group && groupKey(group) === groupKey({ lines: cardLines(selector, card), vouchers: card.vouchers });
    const price = picked?.total !== undefined && {
      price: picked.price,
      original_price: picked.original_price,
      subtotal: picked.subtotal,
      total_discount: picked.total_discount,
      discount_percentage: picked.discount_percentage,
    };
    return {
      selector_id: id,
      type: typeOf(selector),
      ...(picked && { option_id: picked.option_id }),
      lines: picked?.lines ?? [],
      ...(state.campaign && { currency: state.campaign.currency }),
      ...(picked?.total !== undefined && { total: picked.total }),
      ...price,
      quantity: picked?.quantity ?? 0,
      in_cart: inCart,
      options,
    };
  };

  const addToCart = async (id: string): Promise<void> => {
    const selector = get(id);
    const card = pickedCard(selector);
    if (!selector || !card) return;
    const group = { lines: cardLines(selector, card), vouchers: card.vouchers };
    const current = ctx.getState().cart.groups[bundleGroup(id)];
    const write = current && groupKey(current) === groupKey(group) ? undefined : cart.setGroup(bundleGroup(id), group);
    if (card.shippingId) void cart.setShipping(card.shippingId);
    await write;
  };

  const locked = (selector: SelectorState) => selector.mode === 'swap' && ctx.getState().cart.frozen;

  const pick = (id: string, cardId: string): Promise<void> => {
    const selector = get(id);
    const card = selector?.cards.find((c) => c.id === cardId);
    if (!selector || !card || locked(selector)) return Promise.resolve();
    if (selector.picked !== cardId) {
      set(id, { picked: cardId });
      ctx.emit('selector.selected', publicSelector(id));
    }
    return selector.mode === 'swap' ? addToCart(id) : Promise.resolve();
  };

  const basis = () => [[...ctx.getState().cart.coupons].sort().join(), quotes.campaignVersion()].join('|');

  const quote = (id: string): Promise<void> => {
    const selector = get(id);
    const campaign = ctx.getState().campaign;
    if (!selector || !campaign) return Promise.resolve();
    quotedOn.set(id, basis());
    const { currency } = campaign;
    const own = new Set(selector.cards.flatMap((c) => c.vouchers));
    const extra = ctx.getState().cart.coupons.filter((c) => !own.has(c));
    const upsell = selector.mode === 'offer';
    const requests = selector.cards.map((card) => ({
      card,
      body: {
        lines: mergeLines({ [card.id]: { ...card, lines: cardLines(selector, card) } }),
        vouchers: [...new Set([...card.vouchers, ...extra])],
        currency,
      },
    }));
    const settle = () => {
      const priced = requests.flatMap((r) => {
        const summary = quotes.stored(r.body, upsell);
        return summary ? [[r.card.id, summary] as const] : [];
      });
      set(id, { quotes: Object.fromEntries(priced), quoting: false });
      ctx.emit('selector.priced', publicSelector(id));
    };
    return quotes.reprice(
      runs.start(id),
      requests.map((r) => r.body),
      upsell,
      settle,
      () => {
        set(id, { quoting: true });
        ctx.emit('selector.pricing', publicSelector(id));
      },
      (err) => {
        set(id, { quoting: false });
        ctx.fail('selector.price', err);
      },
    );
  };

  const updated = (id: string): Promise<void> => {
    const { mode } = get(id)!;
    ctx.emit('selector.updated', publicSelector(id));
    const quoting = quote(id);
    if (mode === 'offer') return quoting;
    return mode === 'swap' ? addToCart(id) : Promise.resolve();
  };

  ctx.on('cart.updated', () => {
    for (const [id, quoted] of quotedOn) if (quoted !== basis()) void quote(id);
  });

  return {
    register(id: string, cards: SelectorCard[], mode: SelectorMode, preferred?: string): Promise<void> {
      const previous = get(id)?.picked;
      const forcedId = forcedBundle(ctx.getState().visit.params.forceBundleId, id);
      const forced = forcedId ? cards.find((c) => c.id === forcedId) : undefined;
      if (forcedId && !forced) ctx.log.warn(`forceBundleId "${forcedId}" matches no card in selector "${id}"`);
      const inCart = ctx.getState().cart.groups[bundleGroup(id)];
      const found =
        inCart && (cards.find((c) => quantityIn(c, inCart) === 1) ?? cards.find((c) => quantityIn(c, inCart)));
      const restored = forced && found !== forced ? undefined : found;
      const initial =
        cards.find((c) => c.id === previous) ?? forced ?? restored ?? cards.find((c) => c.id === preferred) ?? cards[0];
      const quantities = restored && inCart ? { [restored.id]: quantityIn(restored, inCart)! } : undefined;
      const slots = restored && inCart && slotsIn(restored, inCart);
      ctx.update('selectors', {
        [id]: { mode, cards, quantities, picked: initial?.id, ...(slots && { slots: { [restored!.id]: slots } }) },
      });
      if (!bound.has(id)) {
        bound.add(id);
        ctx.emit('selector.bound', publicSelector(id));
      } else if (initial && initial.id !== previous) ctx.emit('selector.selected', publicSelector(id));
      const adding = mode === 'swap' ? addToCart(id) : Promise.resolve();
      void quote(id);
      return adding;
    },
    view(id: string): void {
      if (viewed.has(id) || !get(id)) return;
      viewed.add(id);
      ctx.emit('selector.viewed', publicSelector(id));
    },
    get,
    picked: (id: string) => pickedCard(get(id)),
    pick,
    addToCart,
    setSlot(id: string, cardId: string, index: number, slot: Partial<Slot>): Promise<void> {
      const selector = get(id);
      const card = selector?.cards.find((c) => c.id === cardId);
      if (!selector || !card || locked(selector)) return Promise.resolve();
      const before = cardSlots(selector, card);
      const slots = before.map((s, i) => (i === index ? { ...s, ...slot } : s));
      if (JSON.stringify(slots) === JSON.stringify(before)) return Promise.resolve();
      set(id, { slots: { ...selector.slots, [cardId]: slots } });
      return selector.picked === cardId ? updated(id) : Promise.resolve();
    },
    setQuantity(id: string, quantity: number): Promise<void> {
      const selector = get(id);
      const card = pickedCard(selector);
      if (!selector || !card || locked(selector)) return Promise.resolve();
      const next = clamp(card, quantity);
      if (next === cardQuantity(selector, card)) return Promise.resolve();
      set(id, { quantities: { ...selector.quantities, [card.id]: next } });
      return updated(id);
    },
    list(): Selector[] {
      return Object.keys(ctx.getState().selectors).map(publicSelector);
    },
    campaignLoaded(): void {
      for (const [id, selector] of Object.entries(ctx.getState().selectors)) {
        if (quotedOn.get(id) !== basis() || (!selector.quotes && !runs.running(id))) void quote(id);
      }
    },
  };
}

export type SelectorActions = ReturnType<typeof createSelectors>;
