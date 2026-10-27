import type { Engine } from '../engine/engine';
import type { CardRef, Context } from '../engine/values';

export type Render = () => void;

export class BindContext {
  readonly cards = new WeakMap<Element, CardRef>();
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

  cardOf(el: Element): CardRef | undefined {
    const cardEl = el.closest('[data-next-bundle-card]');
    return cardEl ? this.cards.get(cardEl) : undefined;
  }

  contextOf(el: Element): Context {
    const ctx: Context = {};
    const card = this.cardOf(el);
    if (card) ctx.card = card;
    const id = Number(el.closest('[data-next-package-id]')?.getAttribute('data-next-package-id'));
    if (id) ctx.packageId = id;
    return ctx;
  }

  warn(message: string): void {
    if (this.warned.has(message)) return;
    this.warned.add(message);
    this.engine.log.warn(message);
  }
}
