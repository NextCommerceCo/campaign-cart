import { conditionMet, parseCondition } from '../engine/condition';
import type { Engine } from '../engine/engine';
import { format, localeOf, truthy, type Value } from '../engine/format';
import type { Tokens } from '../engine/tokens';
import { resolve } from '../engine/values';
import { legacySelectorId } from '../compat/legacy/registry';

const VISIBLE = 0.5;

/** Calls `fn` once, when half of `el` is on screen; at once where the browser cannot tell. */
export function onceVisible(el: Element, fn: () => void): void {
  if (typeof IntersectionObserver === 'undefined') return fn();
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.intersectionRatio >= VISIBLE)) return;
      observer.disconnect();
      fn();
    },
    { threshold: VISIBLE },
  );
  observer.observe(el);
}

export function selectorIdOf(el: Element): string {
  return el.getAttribute('data-next-selector-id') || legacySelectorId(el) || 'default';
}

export function ownProperties(el: Element): Record<string, string> {
  const inputs = [...el.querySelectorAll<HTMLInputElement>('[data-next-property]')];
  return Object.fromEntries(
    inputs.map((i) => [i.getAttribute('data-next-property')!, i.value.trim()]).filter(([, value]) => value),
  );
}

export function pageProperties(card?: Element): Record<string, string> {
  const exclude = (card?.getAttribute('data-next-exclude-property') ?? '').split(',').map((s) => s.trim());
  if (exclude.includes('*')) return {};
  const found: Record<string, string> = {};
  for (const el of document.querySelectorAll<HTMLInputElement>('[data-next-default-property]')) {
    const name = el.getAttribute('data-next-default-property')!;
    if (el.value.trim() && !exclude.includes(name)) found[name] = el.value.trim();
  }
  return found;
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

export function writeValue(el: HTMLElement, v: Value, engine: Engine): void {
  const campaign = engine.getState().campaign;
  if (v.type === 'bool') return setVisible(el, truthy(v));
  if (v.type === 'url' && el instanceof HTMLImageElement) {
    if (v.value && el.getAttribute('src') !== v.value) el.src = String(v.value);
    return;
  }
  setText(el, format(v, campaign?.currency, localeOf(engine.getState()), el.getAttribute('data-next-format')));
}

export const tokenValue =
  (tokens: Record<string, string>) =>
  (path: string): Value | undefined => {
    const raw = tokens[path];
    if (raw === undefined) return undefined;
    if (raw === 'true' || raw === 'show') return { type: 'bool', value: true };
    if (raw === 'false' || raw === 'hide') return { type: 'bool', value: false };
    return { type: 'text', value: raw };
  };

export function applyValues(
  root: ParentNode,
  engine: Engine,
  local: (path: string) => Value | undefined = () => undefined,
): void {
  for (const el of root.querySelectorAll<HTMLElement>('[data-next-display]')) {
    const path = el.getAttribute('data-next-display')!;
    const v = local(path) ?? resolve(engine, path);
    if (v) writeValue(el, v, engine);
  }
  for (const attr of ['data-next-show', 'data-next-hide'] as const) {
    for (const el of root.querySelectorAll<HTMLElement>(`[${attr}]`)) {
      const condition = parseCondition(el.getAttribute(attr)!);
      const v = condition && (local(condition.path) ?? resolve(engine, condition.path));
      if (!condition || !v) continue;
      const met = conditionMet(condition, v);
      setVisible(el, attr === 'data-next-show' ? met : !met);
    }
  }
}

const TOKEN = /\{([\w.]+)\}/g;

export function fillTokens(root: ParentNode, tokens: Tokens): void {
  const replace = (text: string) => text.replace(TOKEN, (_, key: string) => tokens[key] ?? '');
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.nodeValue?.includes('{')) node.nodeValue = replace(node.nodeValue);
    } else {
      for (const attr of [...(node as Element).attributes]) {
        if (attr.value.includes('{')) attr.value = replace(attr.value);
      }
    }
  }
}

export function stamp<T>(
  container: Element,
  items: T[],
  tokensOf: (item: T) => Tokens,
  each?: (el: DocumentFragment, item: T) => void,
): void {
  const template = container.querySelector(':scope > template');
  if (!template) return;
  container.replaceChildren(template);
  for (const item of items) {
    const copy = (template as HTMLTemplateElement).content.cloneNode(true) as DocumentFragment;
    fillTokens(copy, tokensOf(item));
    each?.(copy, item);
    container.append(copy);
  }
  container.classList.toggle('next-summary-empty', !items.length);
  container.classList.toggle('next-summary-has-items', items.length > 0);
  container.classList.toggle('next-discounts-empty', !items.length);
  container.classList.toggle('next-discounts-has-items', items.length > 0);
}
