import type { CartActions } from './cart';
import type { Quotes } from './quotes';
import { apiLines, lineKey, mergeLines } from './lines';
import { cartItems, optionPrice, unitsOf } from './public';
import type { Context } from '../engine';
import type { Selector, SelectorOption } from '../events/selectors';
import { keyedLatestWins } from '../runtime/flow';
import { cents } from '../display/format';
import { forcedBundle } from '../visit/params';
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

function publicSelector(state: State, id: string): Selector {
  const selector = state.selectors[id]!;
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
}

function forcedCard(ctx: Context, id: string, cards: SelectorCard[]): SelectorCard | undefined {
  const forcedId = forcedBundle(ctx.getState().visit.params.forceBundleId, id);
  const forced = forcedId ? cards.find((c) => c.id === forcedId) : undefined;
  if (forcedId && !forced) ctx.log.warn(`forceBundleId "${forcedId}" matches no card in selector "${id}"`);
  return forced;
}

/** First pick: the previous pick, `forced`, the card already in the cart, `preferred`, the first card. */
function registered(
  cards: SelectorCard[],
  mode: SelectorMode,
  inCart: CartGroup | undefined,
  previous: string | undefined,
  forced: SelectorCard | undefined,
  preferred: string | undefined,
): SelectorState {
  const found = inCart && (cards.find((c) => quantityIn(c, inCart) === 1) ?? cards.find((c) => quantityIn(c, inCart)));
  const restored = forced && found !== forced ? undefined : found;
  const initial =
    cards.find((c) => c.id === previous) ?? forced ?? restored ?? cards.find((c) => c.id === preferred) ?? cards[0];
  const quantities = restored && inCart ? { [restored.id]: quantityIn(restored, inCart)! } : undefined;
  const slots = restored && inCart && slotsIn(restored, inCart);
  return { mode, cards, quantities, picked: initial?.id, ...(slots && { slots: { [restored!.id]: slots } }) };
}

/** The picked card into the cart and its shipping, skipped when the cart already has it. */
async function addPicked(ctx: Context, cart: CartActions, id: string): Promise<void> {
  const selector = ctx.getState().selectors[id];
  const card = pickedCard(selector);
  if (!selector || !card) return;
  const group = { lines: cardLines(selector, card), vouchers: card.vouchers };
  const current = ctx.getState().cart.groups[bundleGroup(id)];
  const write = current && groupKey(current) === groupKey(group) ? undefined : cart.setGroup(bundleGroup(id), group);
  if (card.shippingId) void cart.setShipping(card.shippingId);
  await write;
}

function quoteRequests(selector: SelectorState, coupons: string[], currency: string) {
  const own = new Set(selector.cards.flatMap((c) => c.vouchers));
  const extra = coupons.filter((c) => !own.has(c));
  return selector.cards.map((card) => ({
    card,
    body: {
      lines: mergeLines({ [card.id]: { ...card, lines: cardLines(selector, card) } }),
      vouchers: [...new Set([...card.vouchers, ...extra])],
      currency,
    },
  }));
}

type Patch = (id: string, patch: Partial<SelectorState>) => void;

/** Card quotes: on register, quantity or slot change, coupon change and when the campaign arrives. */
function createCardQuotes(ctx: Context, quotes: Quotes, set: Patch, view: (id: string) => Selector) {
  const runs = keyedLatestWins<string>();
  const quotedOn = new Map<string, string>();

  const basis = () => [[...ctx.getState().cart.coupons].sort().join(), quotes.campaignVersion()].join('|');

  const quote = (id: string): Promise<void> => {
    const selector = ctx.getState().selectors[id];
    const campaign = ctx.getState().campaign;
    if (!selector || !campaign) return Promise.resolve();
    quotedOn.set(id, basis());
    const upsell = selector.mode === 'offer';
    const requests = quoteRequests(selector, ctx.getState().cart.coupons, campaign.currency);
    const settle = () => {
      const priced = requests.flatMap((r) => {
        const summary = quotes.stored(r.body, upsell);
        return summary ? [[r.card.id, summary] as const] : [];
      });
      set(id, { quotes: Object.fromEntries(priced), quoting: false });
      ctx.emit('selector.priced', view(id));
    };
    return quotes.reprice(
      runs.start(id),
      requests.map((r) => r.body),
      upsell,
      settle,
      () => {
        set(id, { quoting: true });
        ctx.emit('selector.pricing', view(id));
      },
      (err) => {
        set(id, { quoting: false });
        ctx.fail('selector.price', err);
      },
    );
  };

  ctx.on('cart.updated', () => {
    for (const [id, quoted] of quotedOn) if (quoted !== basis()) void quote(id);
  });

  return {
    quote,
    campaignLoaded(): void {
      for (const [id, selector] of Object.entries(ctx.getState().selectors)) {
        if (quotedOn.get(id) !== basis() || (!selector.quotes && !runs.running(id))) void quote(id);
      }
    },
  };
}

export function createSelectors(ctx: Context, cart: CartActions) {
  const bound = new Set<string>();
  const viewed = new Set<string>();

  const get = (id: string): SelectorState | undefined => ctx.getState().selectors[id];
  const set: Patch = (id, patch) => ctx.update('selectors', { [id]: { ...get(id)!, ...patch } });
  const view = (id: string) => publicSelector(ctx.getState(), id);
  const { quote, campaignLoaded } = createCardQuotes(ctx, cart.quotes, set, view);

  const addToCart = (id: string) => addPicked(ctx, cart, id);

  const locked = (selector: SelectorState) => selector.mode === 'swap' && ctx.getState().cart.frozen;

  const updated = (id: string): Promise<void> => {
    const { mode } = get(id)!;
    ctx.emit('selector.updated', view(id));
    const quoting = quote(id);
    if (mode === 'offer') return quoting;
    return mode === 'swap' ? addToCart(id) : Promise.resolve();
  };

  return {
    register(id: string, cards: SelectorCard[], mode: SelectorMode, preferred?: string): Promise<void> {
      const previous = get(id)?.picked;
      const forced = forcedCard(ctx, id, cards);
      const next = registered(cards, mode, ctx.getState().cart.groups[bundleGroup(id)], previous, forced, preferred);
      ctx.update('selectors', { [id]: next });
      if (!bound.has(id)) {
        bound.add(id);
        ctx.emit('selector.bound', view(id));
      } else if (next.picked !== undefined && next.picked !== previous) ctx.emit('selector.selected', view(id));
      const adding = mode === 'swap' ? addToCart(id) : Promise.resolve();
      void quote(id);
      return adding;
    },
    view(id: string): void {
      if (viewed.has(id) || !get(id)) return;
      viewed.add(id);
      ctx.emit('selector.viewed', view(id));
    },
    get,
    picked: (id: string) => pickedCard(get(id)),
    pick(id: string, cardId: string): Promise<void> {
      const selector = get(id);
      const card = selector?.cards.find((c) => c.id === cardId);
      if (!selector || !card || locked(selector)) return Promise.resolve();
      if (selector.picked !== cardId) {
        set(id, { picked: cardId });
        ctx.emit('selector.selected', view(id));
      }
      return selector.mode === 'swap' ? addToCart(id) : Promise.resolve();
    },
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
      return Object.keys(ctx.getState().selectors).map(view);
    },
    campaignLoaded,
  };
}

export type SelectorActions = ReturnType<typeof createSelectors>;
