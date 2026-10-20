import type { Engine } from '../engine/engine';
import type { CartLine } from '../engine/types';
import type { CardLookup, Context } from '../engine/values';
import { legacySelectorId } from '../legacy';

export type Render = () => void;

export interface Card {
  selectorId: string;
  cardId: string;
  lines: CartLine[];
  vouchers: string[];
  shippingId?: number;
  el: Element;
}

export class BindContext {
  readonly selectors = new Map<string, Card[]>();
  private bound = new WeakMap<Element, Set<string>>();
  private warned = new Set<string>();

  constructor(readonly engine: Engine) {}

  claim(el: Element, attr: string): boolean {
    const attrs = this.bound.get(el) ?? new Set<string>();
    if (attrs.has(attr)) return false;
    this.bound.set(el, attrs.add(attr));
    return true;
  }

  each<E extends Element = HTMLElement>(root: ParentNode, attr: string, fn: (el: E) => void): void {
    const selector = `[${attr}]`;
    const els = [...root.querySelectorAll<E>(selector)];
    if (root instanceof Element && root.matches(selector)) els.unshift(root as E);
    els.filter((el) => this.claim(el, attr)).forEach(fn);
  }

  selected(selectorId: string): Card | undefined {
    const id = this.engine.getState().selections[selectorId];
    return this.selectors.get(selectorId)?.find((c) => c.cardId === id);
  }

  readonly cards: CardLookup = (id) => {
    const card = this.selected(id) ?? [...this.selectors.values()].flat().find((c) => c.cardId === id);
    return card && { lines: card.lines, selected: this.selected(card.selectorId) === card };
  };

  cardOf(el: Element): Card | undefined {
    const cardEl = el.closest('[data-next-bundle-card]');
    return cardEl ? [...this.selectors.values()].flat().find((c) => c.el === cardEl) : undefined;
  }

  contextOf(el: Element): Context {
    const ctx: Context = {};
    const card = this.cardOf(el);
    if (card) ctx.card = { selectorId: card.selectorId, cardId: card.cardId, lines: card.lines };
    const id = Number(el.closest('[data-next-package-id]')?.getAttribute('data-next-package-id'));
    if (id) ctx.packageId = id;
    return ctx;
  }

  warn(message: string): void {
    if (this.warned.has(message)) return;
    this.warned.add(message);
    console.warn(`[next] ${message}`);
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

export function setState(el: Element, on: boolean): void {
  el.classList.toggle('next-selected', on);
  el.classList.toggle('next-active', on);
  el.classList.toggle('next-in-cart', on);
  el.classList.toggle('next-not-in-cart', !on);
  el.setAttribute('data-next-selected', String(on));
  el.setAttribute('data-next-active', String(on));
  el.setAttribute('aria-pressed', String(on));
}

export const isFormControl = (target: EventTarget | null) =>
  target instanceof Element && !!target.closest('a, input, select, textarea, label');
