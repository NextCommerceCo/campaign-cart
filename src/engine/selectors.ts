import { type CartActions, lineKey, mergeLines } from './cart';
import type { Context } from './engine';
import type { CartGroup, Selector, SelectorCard, SelectorMode } from './types';

export const bundleGroup = (selectorId: string) => `bundle:${selectorId}`;

const groupKey = (g: CartGroup) =>
  [...g.lines.map((l) => `${lineKey(l)}x${l.quantity}`).sort(), ...[...g.vouchers].sort()].join(',');

export function createSelectors(ctx: Context, cart: CartActions) {
  const inFlight = new Map<string, AbortController>();

  const get = (id: string): Selector | undefined => ctx.getState().selectors[id];
  const set = (id: string, patch: Partial<Selector>) => ctx.update('selectors', { [id]: { ...get(id)!, ...patch } });

  const addToCart = async (id: string): Promise<void> => {
    const selector = get(id);
    const card = selector?.cards.find((c) => c.id === selector.picked);
    if (!card) return;
    const group = { lines: card.lines, vouchers: card.vouchers };
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
      ctx.emit('selection.changed', { selectorId: id, cardId, items: card.lines });
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
            { lines: mergeLines({ [card.id]: card }), vouchers: card.vouchers, currency },
            { signal: controller.signal, upsell: true },
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
    register(id: string, cards: SelectorCard[], mode: SelectorMode, preferred?: string): Promise<void> {
      const previous = get(id)?.picked;
      const inCart = ctx.getState().cart.groups[bundleGroup(id)];
      const initial =
        cards.find((c) => c.id === previous) ??
        (inCart && cards.find((c) => groupKey(c) === groupKey(inCart))) ??
        cards.find((c) => c.id === preferred) ??
        cards[0];
      ctx.update('selectors', { [id]: { mode, cards } });
      if (mode === 'offer') void quote(id);
      return initial ? pick(id, initial.id) : Promise.resolve();
    },
    pick,
    addToCart,
    campaignLoaded(): void {
      for (const [id, selector] of Object.entries(ctx.getState().selectors)) {
        if (selector.mode === 'offer' && !selector.quotes && !inFlight.has(id)) void quote(id);
      }
    },
  };
}

export type SelectorActions = ReturnType<typeof createSelectors>;
