import type { Engine } from '../engine/engine';
import type { CartLine } from '../engine/types';
import type { CardLookup, Context } from '../engine/values';
import { legacySelectorId } from '../legacy';

export type Render = () => void;

export interface Card {
  cardId: string;
  lines: CartLine[];
  vouchers: string[];
  shippingId?: number;
  el: Element;
}

export class BindContext {
  readonly selectors = new Map<string, Card[]>();
  private warned = new Set<string>();

  constructor(readonly engine: Engine) {}

  readonly cards: CardLookup = (selectorId, cardId) => {
    const cards = this.selectors.get(selectorId);
    const id = cardId ?? this.engine.getState().selections[selectorId];
    const card = cards?.find((c) => c.cardId === id);
    return card && { cardId: card.cardId, lines: card.lines };
  };

  warn(message: string): void {
    if (this.warned.has(message)) return;
    this.warned.add(message);
    console.warn(`[next] ${message}`);
  }

  contextOf(el: Element): Context {
    const ctx: Context = {};
    const cardEl = el.closest('[data-next-bundle-card]');
    const selectorEl = cardEl?.closest('[data-next-bundle-selector]');
    if (cardEl && selectorEl) {
      const selectorId = selectorIdOf(selectorEl);
      const card = this.selectors.get(selectorId)?.find((c) => c.el === cardEl);
      if (card) ctx.card = { selectorId, cardId: card.cardId, lines: card.lines };
    }
    const pkgEl = el.closest('[data-next-package-id]');
    const id = Number(pkgEl?.getAttribute('data-next-package-id'));
    if (id) ctx.packageId = id;
    return ctx;
  }
}

export function selectorIdOf(el: Element): string {
  return el.getAttribute('data-next-selector-id') || legacySelectorId(el) || 'default';
}

export function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function parseLines(raw: string | null): CartLine[] {
  return parseJson<CartLine[]>(raw, [])
    .map((i) => ({ packageId: Number(i.packageId), quantity: Number(i.quantity ?? 1) }))
    .filter((l) => l.packageId > 0 && l.quantity > 0);
}

export function setText(el: Element, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}

export function setVisible(el: HTMLElement, visible: boolean): void {
  el.style.display = visible ? '' : 'none';
  el.classList.toggle('next-visible', visible);
  el.classList.toggle('next-hidden', !visible);
}
