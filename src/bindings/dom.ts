import { type Condition, parseCondition } from '../engine/condition';
import type { Engine } from '../engine/engine';
import type { SelectorLine } from '../engine/types';
import { format, resolve, type Tokens, truthy, type Value } from '../engine/values';
import { legacySelectorId } from '../legacy';

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

export function parseLines(raw: string | null): SelectorLine[] {
  return parseJson<SelectorLine[]>(raw, [])
    .map((i) => ({
      packageId: Number(i.packageId),
      quantity: Number(i.quantity ?? 1),
      ...(i.configurable === true && { configurable: true }),
    }))
    .filter((l) => l.packageId > 0 && l.quantity > 0);
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
  setText(el, format(v, campaign?.currency, campaign?.language, el.getAttribute('data-next-format')));
}

export const conditionMet = (condition: Condition, v: Value) =>
  condition.kind === 'compare'
    ? (String(v.value ?? '') === condition.literal) === (condition.op === '==')
    : truthy(v) !== condition.negate;

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
