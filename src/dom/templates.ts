import type { Tokens } from '../engine/display/tokens';
import { fill } from './dom';

/** Calls `found` with each text and attribute under `root` that has a `{`, and a write that touches only a change. */
export function eachTokenText(root: ParentNode, found: (raw: string, write: (text: string) => void) => void): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node as Text;
      if (text.data.includes('{')) found(text.data, (next) => void (text.data !== next && (text.data = next)));
      continue;
    }
    const el = node as Element;
    for (const { name, value } of [...el.attributes]) {
      if (value.includes('{'))
        found(value, (next) => void (el.getAttribute(name) !== next && el.setAttribute(name, next)));
    }
  }
}

export function fillTokens(root: ParentNode, tokens: Tokens): void {
  eachTokenText(root, (raw, write) => write(fill(raw, tokens)));
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
