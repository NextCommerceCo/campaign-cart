import type { Value } from '../engine/format';
import type { Tokens } from '../engine/tokens';
import { showWhen } from './dom';

export const tokenValue =
  (tokens: Record<string, string>) =>
  (path: string): Value | undefined => {
    const raw = tokens[path];
    if (raw === undefined) return undefined;
    if (raw === 'true' || raw === 'show') return { type: 'bool', value: true };
    if (raw === 'false' || raw === 'hide') return { type: 'bool', value: false };
    return { type: 'text', value: raw };
  };

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

const SLOT_TOKEN = /\{((?:slot|item)\.\w+)\}/g;

/** Binds every `{slot.*}` / `{item.*}` token in `root` once; the returned patch rewrites only what changed. */
export function bindTokens(root: ParentNode): (values: Tokens) => void {
  const writes: Array<(values: Tokens) => void> = [];
  const filled = (raw: string, values: Tokens) => raw.replace(SLOT_TOKEN, (t, key: string) => values[key] ?? t);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node as Text;
      const raw = text.data;
      if (raw.match(SLOT_TOKEN))
        writes.push((v) => {
          const next = filled(raw, v);
          if (text.data !== next) text.data = next;
        });
      continue;
    }
    const el = node as Element;
    for (const { name, value: raw } of [...el.attributes]) {
      if (raw.match(SLOT_TOKEN))
        writes.push((v) => {
          const next = filled(raw, v);
          if (el.getAttribute(name) !== next) el.setAttribute(name, next);
        });
    }
  }
  const toggles = (['data-next-show', 'data-next-hide'] as const).flatMap((attr) =>
    [...root.querySelectorAll<HTMLElement>(`[${attr}^="item."]`)].map((node) => {
      const key = node.getAttribute(attr)!;
      node.removeAttribute(attr);
      return (v: Tokens) => void showWhen(node, attr, v[key] === 'show');
    }),
  );
  return (values) => [...writes, ...toggles].forEach((write) => write(values));
}
