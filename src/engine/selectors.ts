import { type CartActions, lineKey, mergeLines } from './cart';
import type { Context } from './engine';
import type { CartGroup, CartLine, Selector, SelectorCard, SelectorMode, Slot } from './types';

export const bundleGroup = (selectorId: string) => `bundle:${selectorId}`;

const clamp = (card: SelectorCard, quantity: number) =>
  Math.min(Math.max(Math.round(quantity), card.min ?? 1), card.max ?? 999);

export const cardQuantity = (selector: Selector, card: SelectorCard) =>
  selector.quantities?.[card.id] ?? clamp(card, card.quantity ?? 1);

const slotLine = (slot: Slot): CartLine => ({
  packageId: slot.packageId,
  quantity: 1,
  ...(slot.properties && Object.keys(slot.properties).length && { properties: slot.properties }),
});

export function cardSlots(selector: Selector, card: SelectorCard): Slot[] {
  const times = cardQuantity(selector, card);
  const chosen = selector.slots?.[card.id] ?? [];
  const base = card.lines.flatMap((l) => (l.configurable ? Array(l.quantity * times).fill(l.packageId) : []));
  return base.map((packageId: number, i) => chosen[i] ?? { packageId });
}

export function cardLines(selector: Selector, card: SelectorCard): CartLine[] {
  const times = cardQuantity(selector, card);
  const fixed = card.lines
    .filter((l) => !l.configurable)
    .map(({ configurable: _, ...l }) => (times === 1 ? l : { ...l, quantity: l.quantity * times }));
  return [...fixed, ...cardSlots(selector, card).map(slotLine)];
}

export function pickedCard(selector: Selector | undefined): SelectorCard | undefined {
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

export function createSelectors(ctx: Context, cart: CartActions) {
  const inFlight = new Map<string, AbortController>();

  const get = (id: string): Selector | undefined => ctx.getState().selectors[id];
  const set = (id: string, patch: Partial<Selector>) => ctx.update('selectors', { [id]: { ...get(id)!, ...patch } });

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

  const pick = (id: string, cardId: string): Promise<void> => {
    const selector = get(id);
    const card = selector?.cards.find((c) => c.id === cardId);
    if (!selector || !card) return Promise.resolve();
    if (selector.picked !== cardId) {
      set(id, { picked: cardId });
      ctx.emit('selection.changed', { selectorId: id, cardId, items: cardLines(selector, card) });
    }
    return selector.mode === 'swap' ? addToCart(id) : Promise.resolve();
  };

  const quote = async (id: string): Promise<void> => {
    const selector = get(id);
    const currency = ctx.getState().campaign?.currency;
    if (!selector || !currency) return;
    inFlight.get(id)?.abort();
    const controller = new AbortController();
    inFlight.set(id, controller);
    set(id, { quoting: true });
    try {
      const summaries = await Promise.all(
        selector.cards.map((card) =>
          ctx.api.calculate(
            {
              lines: mergeLines({ [card.id]: { ...card, lines: cardLines(selector, card) } }),
              vouchers: card.vouchers,
              currency,
            },
            { signal: controller.signal, upsell: selector.mode === 'offer' },
          ),
        ),
      );
      if (inFlight.get(id) !== controller) return;
      set(id, { quotes: Object.fromEntries(selector.cards.map((c, i) => [c.id, summaries[i]!])), quoting: false });
    } catch (err) {
      if (inFlight.get(id) !== controller) return;
      set(id, { quoting: false });
      ctx.fail('quote', err);
    } finally {
      if (inFlight.get(id) === controller) inFlight.delete(id);
    }
  };

  return {
    register(id: string, cards: SelectorCard[], mode: SelectorMode, preferred?: string, priced = false): Promise<void> {
      const previous = get(id)?.picked;
      const inCart = ctx.getState().cart.groups[bundleGroup(id)];
      const restored =
        inCart && (cards.find((c) => quantityIn(c, inCart) === 1) ?? cards.find((c) => quantityIn(c, inCart)));
      const initial =
        cards.find((c) => c.id === previous) ?? restored ?? cards.find((c) => c.id === preferred) ?? cards[0];
      const quantities = restored && inCart ? { [restored.id]: quantityIn(restored, inCart)! } : undefined;
      const slots = restored && inCart && slotsIn(restored, inCart);
      ctx.update('selectors', {
        [id]: { mode, cards, quantities, priced, ...(slots && { slots: { [restored!.id]: slots } }) },
      });
      if (mode === 'offer' || priced) void quote(id);
      return initial ? pick(id, initial.id) : Promise.resolve();
    },
    pick,
    addToCart,
    setSlot(id: string, cardId: string, index: number, slot: Partial<Slot>): Promise<void> {
      const selector = get(id);
      const card = selector?.cards.find((c) => c.id === cardId);
      if (!selector || !card) return Promise.resolve();
      const slots = cardSlots(selector, card).map((s, i) => (i === index ? { ...s, ...slot } : s));
      set(id, { slots: { ...selector.slots, [cardId]: slots } });
      if (selector.picked !== cardId) return Promise.resolve();
      ctx.emit('selection.changed', { selectorId: id, cardId, items: cardLines(get(id)!, card) });
      const quoting = selector.mode === 'offer' || selector.priced ? quote(id) : Promise.resolve();
      if (selector.mode === 'offer') return quoting;
      return selector.mode === 'swap' ? addToCart(id) : Promise.resolve();
    },
    setQuantity(id: string, quantity: number): Promise<void> {
      const selector = get(id);
      const card = pickedCard(selector);
      if (!selector || !card) return Promise.resolve();
      const next = clamp(card, quantity);
      if (next === cardQuantity(selector, card)) return Promise.resolve();
      set(id, { quantities: { ...selector.quantities, [card.id]: next } });
      ctx.emit('selection.changed', { selectorId: id, cardId: card.id, items: cardLines(get(id)!, card) });
      const quoting = selector.mode === 'offer' || selector.priced ? quote(id) : Promise.resolve();
      if (selector.mode === 'offer') return quoting;
      return selector.mode === 'swap' ? addToCart(id) : Promise.resolve();
    },
    campaignLoaded(): void {
      for (const [id, selector] of Object.entries(ctx.getState().selectors)) {
        if ((selector.mode === 'offer' || selector.priced) && !selector.quotes && !inFlight.has(id)) void quote(id);
      }
    },
  };
}

export type SelectorActions = ReturnType<typeof createSelectors>;
