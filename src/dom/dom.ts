import type { SelectorCard, SelectorLine, SelectorMode } from '../engine/cart/types';
import { toggleGroup } from '../engine/cart/toggles';
import type { BindContext } from './context';

const VISIBLE = 0.5;

/** Calls `fn` once, when half of `el` is on screen; at once where the browser cannot tell. Returns what stops watching. */
export function onceVisible(el: Element, fn: () => void): () => void {
  if (typeof IntersectionObserver === 'undefined') return (fn(), () => {});
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.intersectionRatio >= VISIBLE)) return;
      observer.disconnect();
      fn();
    },
    { threshold: VISIBLE },
  );
  observer.observe(el);
  return () => observer.disconnect();
}

/** The elements under `root` matching `selector`, `root` first when it matches too. */
export function matching<E extends Element = HTMLElement>(root: ParentNode, selector: string): E[] {
  const els = [...root.querySelectorAll<E>(selector)];
  if (root instanceof Element && root.matches(selector)) els.unshift(root as E);
  return els;
}

/** The first of these `<meta name>` tags that has content. */
export const metaContent = (...names: string[]): string | undefined =>
  names.map((n) => document.querySelector<HTMLMetaElement>(`meta[name="${n}"]`)?.content).find(Boolean);

const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const escapeHtml = (text: string): string => text.replace(/[&<>"']/g, (c) => ENTITIES[c]!);

/** A template token: `{key}`, `{item.price}`, `{slot.index}`, `{discount.name}`. */
const TOKEN = /\{([\w.]+)\}/g;

/** `text` with each token's value (through `as`); an unknown key stays when `keep`, else goes. */
export const fill = (
  text: string,
  values: Record<string, string>,
  keep?: boolean,
  as: (value: string) => string = String,
  pattern = TOKEN,
): string =>
  text.replace(pattern, (raw, key: string) => (values[key] === undefined ? (keep ? raw : '') : as(values[key])));

/** An HTML template with each token replaced by its escaped value; unknown keys stay. */
export const fillTemplate = (html: string, values: Record<string, string>, pattern?: RegExp): string =>
  fill(html, values, true, escapeHtml, pattern);

/** A bundle selector's id: `data-next-selector-id`, else the deprecated `data-next-id`, else `default`. */
export const selectorIdOf = (el: Element): string =>
  el.getAttribute('data-next-selector-id') || el.getAttribute('data-next-id') || 'default';

/** The elements whose `attr` is exactly `value`, whatever characters it has. */
export const withAttribute = (root: ParentNode, attr: string, value: string): Element[] =>
  [...root.querySelectorAll(`[${attr}]`)].filter((el) => el.getAttribute(attr) === value);

/** Each input's trimmed value under its name; empty ones are left out. */
export function inputValues(inputs: Iterable<Element>, nameOf: (input: Element) => string): Record<string, string> {
  const found: Record<string, string> = {};
  for (const input of inputs) {
    const value = (input as HTMLInputElement).value.trim();
    if (value) found[nameOf(input)] = value;
  }
  return found;
}

/** Points an image, or a `<source>`'s srcset, at `src` when it is a new, non-empty address. */
export function setSource(el: HTMLImageElement | HTMLSourceElement, src: unknown): void {
  const attr = el instanceof HTMLSourceElement ? 'srcset' : 'src';
  if (src && el.getAttribute(attr) !== src) el.setAttribute(attr, String(src));
}

export function setText(el: Element, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}

export function setVisible(el: HTMLElement, visible: boolean): void {
  el.style.display = visible ? '' : 'none';
  el.classList.toggle('next-visible', visible);
  el.classList.toggle('next-hidden', !visible);
}

/** Shows `el` while `met` for `data-next-show`, while not `met` for `data-next-hide`; returns whether it shows. */
export function showWhen(el: HTMLElement, attr: 'data-next-show' | 'data-next-hide', met: boolean): boolean {
  const visible = met === (attr === 'data-next-show');
  setVisible(el, visible);
  return visible;
}

/** The 0.4.x state classes page CSS selects. */
export function stateClasses(el: Element, selected: boolean, inCart: boolean): void {
  el.classList.toggle('next-selected', selected);
  el.classList.toggle('next-active', selected);
  el.classList.toggle('next-in-cart', inCart);
  el.classList.toggle('next-not-in-cart', !inCart);
}

export const isFormControl = (target: EventTarget | null) =>
  target instanceof Element && !!target.closest('a, input, select, textarea, label');

/** A selector card: its lines and vouchers as the dialect reads them, the rest from the attributes both share. */
export function cardFromElement(el: Element, id: string, lines: SelectorLine[], vouchers: string[]): SelectorCard {
  const n = (attr: string) => Number(el.getAttribute(attr)) || undefined;
  return {
    id,
    lines,
    vouchers,
    shippingId: n('data-next-shipping-id'),
    quantity: n('data-next-quantity'),
    min: n('data-next-min-quantity'),
    max: n('data-next-max-quantity'),
  };
}

/** A click on a card picks it, the first `selected` card is the page's pick, `view` once half of `el` is on screen. */
export function registerSelector(
  b: BindContext,
  el: Element,
  id: string,
  cards: SelectorCard[],
  els: Map<string, Element>,
  mode: SelectorMode,
  selected: (card: Element) => boolean,
): void {
  const { engine } = b;
  els.forEach((card, cardId) =>
    card.addEventListener('click', (e) => {
      if (!isFormControl(e.target)) void engine.selectors.pick(id, cardId);
    }),
  );
  const preferred = [...els].find(([, card]) => selected(card))?.[0];
  void engine.selectors.register(id, cards, mode, preferred);
  b.offs.push(onceVisible(el, () => engine.selectors.view(id)));
}

/**
 * A package `el` switches on and off as its own cart group: added when `selected` and not
 * dismissed, viewed once on screen, added again when an input changes while in the cart.
 * Returns a resync for a quantity that follows the cart: the preselect retried, a changed quantity added.
 */
export function bindToggle(
  b: BindContext,
  el: Element,
  packageId: number,
  quantity: () => number,
  add: () => unknown,
  inputs: Element[],
  on: () => boolean,
  selected: boolean,
): () => void {
  const { engine } = b;
  const group = toggleGroup(packageId);
  let preselected = selected && !engine.getState().cart.dismissed.includes(group);
  const addPreselected = () => {
    if (!preselected || on() || quantity() <= 0) return;
    preselected = false;
    void add();
  };
  addPreselected();
  b.offs.push(onceVisible(el, () => engine.toggles.view(packageId, quantity() || 1)));
  for (const input of inputs) b.listen(input, 'change', () => engine.cart.group(group) && void add());
  el.addEventListener('click', (e) => {
    if (isFormControl(e.target)) return;
    if (!on()) void add();
    else if (engine.cart.group(group)) void engine.cart.setGroup(group, null, { dismiss: true });
    else void engine.cart.removeItem(packageId);
  });
  return () => {
    addPreselected();
    const current = engine.cart.group(group)?.lines[0]?.quantity;
    if (current !== undefined && current !== quantity()) void add();
  };
}
