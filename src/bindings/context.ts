import type { Engine } from '../engine/engine';
import type { CardRef, ValueScope } from '../engine/values';
import { matching } from './dom';

export type Render = () => void;

export class BindContext {
  readonly cards = new WeakMap<Element, CardRef>();
  /** `data-next-show` / `-hide` elements these bindings leave to attributes v2: a condition or a path they do not know. */
  readonly deferred = new Set<Element>();
  private bound = new WeakMap<Element, Set<string>>();
  private warned = new Set<string>();
  /** What `dispose` runs: engine subscriptions and listeners outside the bound elements. */
  readonly offs: Array<() => void> = [];

  constructor(readonly engine: Engine) {}

  /** Adds a listener that `dispose` removes. */
  listen<E extends Event>(target: EventTarget, type: string, fn: (e: E) => void): void {
    target.addEventListener(type, fn as EventListener);
    this.offs.push(() => target.removeEventListener(type, fn as EventListener));
  }

  claim(el: Element, attr: string): boolean {
    const attrs = this.bound.get(el) ?? new Set<string>();
    if (attrs.has(attr)) return false;
    this.bound.set(el, attrs.add(attr));
    return true;
  }

  each<E extends Element = HTMLElement>(root: ParentNode, attr: string, fn: (el: E) => void): void {
    matching<E>(root, `[${attr}]`)
      .filter((el) => this.claim(el, attr))
      .forEach(fn);
  }

  cardOf(el: Element): CardRef | undefined {
    const cardEl = el.closest('[data-next-bundle-card]');
    return cardEl ? this.cards.get(cardEl) : undefined;
  }

  contextOf(el: Element): ValueScope {
    const ctx: ValueScope = {};
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
