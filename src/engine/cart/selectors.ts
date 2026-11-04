import { apiLines, type CartActions, cartItems, lineKey, mergeLines } from './cart';
import type { Context } from '../engine';
import type { Selector } from '../events';
import { forcedBundle } from '../params';
import type { CartGroup, CartLine, CartSummary, SelectorState, SelectorCard, SelectorMode, Slot } from './types';
import type { Package } from '../types';

export const bundleGroup = (selectorId: string) => `bundle:${selectorId}`;

const QUOTES = 'quotes';
const QUOTE_MAX_AGE = 10 * 60 * 1000;
const QUOTE_LIMIT = 24;
type SavedQuotes = Record<string, { at: number; summary: CartSummary }>;

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

export function createSelectors(ctx: Context, cart: CartActions) {
  const inFlight = new Map<string, AbortController>();

  const get = (id: string): SelectorState | undefined => ctx.getState().selectors[id];
  const set = (id: string, patch: Partial<SelectorState>) =>
    ctx.update('selectors', { [id]: { ...get(id)!, ...patch } });
  const publicSelector = (id: string): Selector => {
    const selector = get(id)!;
    const card = pickedCard(selector);
    const lines = card ? apiLines(cardLines(selector, card)) : [];
    return {
      selector_id: id,
      type: typeOf(selector),
      ...(card && { option_id: card.id }),
      lines: cartItems(ctx.getState(), lines, card && selector.quotes?.[card.id]?.lines),
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

  const pick = (id: string, cardId: string): Promise<void> => {
    const selector = get(id);
    const card = selector?.cards.find((c) => c.id === cardId);
    if (!selector || !card) return Promise.resolve();
    if (selector.picked !== cardId) {
      set(id, { picked: cardId });
      ctx.emit('selector.selected', publicSelector(id));
    }
    return selector.mode === 'swap' ? addToCart(id) : Promise.resolve();
  };

  const coupons = () => [...ctx.getState().cart.coupons].sort().join();
  const quotedCoupons = new Map<string, string>();

  const quote = async (id: string): Promise<void> => {
    const selector = get(id);
    const currency = ctx.getState().campaign?.currency;
    if (!selector || !currency) return;
    quotedCoupons.set(id, coupons());
    const own = new Set(selector.cards.flatMap((c) => c.vouchers));
    const extra = ctx.getState().cart.coupons.filter((c) => !own.has(c));
    const upsell = selector.mode === 'offer';
    const requests = selector.cards.map((card) => {
      const lines = mergeLines({ [card.id]: { ...card, lines: cardLines(selector, card) } });
      const vouchers = [...new Set([...card.vouchers, ...extra])];
      return {
        card,
        body: { lines, vouchers, currency },
        key: JSON.stringify([lines, [...vouchers].sort(), currency, upsell]),
      };
    });
    const now = Date.now();
    const saved = Object.fromEntries(
      Object.entries(ctx.local.get<SavedQuotes>(QUOTES) ?? {}).filter(([, q]) => now - q.at < QUOTE_MAX_AGE),
    );
    const settle = () => {
      const quotes = Object.fromEntries(
        requests.filter((r) => saved[r.key]).map((r) => [r.card.id, saved[r.key]!.summary]),
      );
      set(id, { quotes, quoting: false });
      ctx.emit('selector.calculated', publicSelector(id));
    };
    const missing = requests.filter((r) => !saved[r.key]);
    inFlight.get(id)?.abort();
    if (!missing.length) {
      inFlight.delete(id);
      return settle();
    }
    const controller = new AbortController();
    inFlight.set(id, controller);
    set(id, { quoting: true });
    ctx.emit('selector.calculating', publicSelector(id));
    try {
      const summaries = await Promise.all(
        missing.map((r) => ctx.api.calculate(r.body, { signal: controller.signal, upsell })),
      );
      if (inFlight.get(id) !== controller) return;
      const at = Date.now();
      missing.forEach((r, i) => (saved[r.key] = { at, summary: summaries[i]! }));
      const newest = Object.entries(saved).sort(([, a], [, b]) => b.at - a.at);
      ctx.local.set(QUOTES, Object.fromEntries(newest.slice(0, QUOTE_LIMIT)));
      settle();
    } catch (err) {
      if (inFlight.get(id) !== controller) return;
      set(id, { quoting: false });
      ctx.fail('selector.calculate', err);
    } finally {
      if (inFlight.get(id) === controller) inFlight.delete(id);
    }
  };

  ctx.on('cart.updated', () => {
    for (const [id, quoted] of quotedCoupons) if (quoted !== coupons()) void quote(id);
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
        [id]: { mode, cards, quantities, ...(slots && { slots: { [restored!.id]: slots } }) },
      });
      const picking = initial ? pick(id, initial.id) : Promise.resolve();
      void quote(id);
      return picking;
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
      ctx.emit('selector.selected', publicSelector(id));
      const quoting = quote(id);
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
      ctx.emit('selector.selected', publicSelector(id));
      const quoting = quote(id);
      if (selector.mode === 'offer') return quoting;
      return selector.mode === 'swap' ? addToCart(id) : Promise.resolve();
    },
    campaignLoaded(): void {
      for (const [id, selector] of Object.entries(ctx.getState().selectors)) {
        if (!selector.quotes && !inFlight.has(id)) void quote(id);
      }
    },
  };
}

export type SelectorActions = ReturnType<typeof createSelectors>;

export interface VariantOption {
  value: string;
  packageId?: number;
}

export interface VariantChoice {
  code: string;
  name: string;
  value?: string;
  options: VariantOption[];
}

export function variantChoices(packages: Package[], packageId: number): VariantChoice[] {
  const current = packages.find((p) => p.ref_id === packageId);
  const own = current?.product_variant_attribute_values ?? [];
  if (!current?.product_id || !own.length) return [];
  const family = packages.filter((p) => p.product_id === current.product_id);
  const attributes = family.flatMap((p) => p.product_variant_attribute_values ?? []);
  const selected = Object.fromEntries(own.map((a) => [a.code, a.value]));
  const matching = (wanted: Record<string, string>) =>
    family.find(
      (p) =>
        p.product_purchase_availability !== 'unavailable' &&
        Object.entries(wanted).every(([code, value]) =>
          p.product_variant_attribute_values?.some((a) => a.code === code && a.value === value),
        ),
    );
  return [...new Map(attributes.map((a) => [a.code, a.name]))].map(([code, name]) => ({
    code,
    name,
    value: selected[code],
    options: [...new Set(attributes.filter((a) => a.code === code).map((a) => a.value))].map((value) => ({
      value,
      packageId: matching({ ...selected, [code]: value })?.ref_id,
    })),
  }));
}
