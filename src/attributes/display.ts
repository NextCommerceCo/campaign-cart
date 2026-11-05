import { setVisible } from '../bindings/dom';
import type { Render } from '../bindings/context';
import { evaluate, parseExpression } from './condition';
import type { AttributeContext } from './context';
import { write } from './value';

const own = <E extends Element = HTMLElement>(root: ParentNode, attr: string): E[] => {
  const selector = `[${attr}]`;
  const els = [...root.querySelectorAll<E>(selector)];
  if (root instanceof Element && root.matches(selector)) els.unshift(root as E);
  return els;
};

/** `data-next-for="path"`: the object its children read short paths from. */
export function bindFor(root: ParentNode, a: AttributeContext): Render[] {
  for (const el of own(root, 'data-next-for')) {
    if (!a.b.claim(el, 'data-next-for')) continue;
    const path = el.getAttribute('data-next-for') ?? '';
    a.setScope(el, () => a.query.get(path, a.outerScopeOf(el)));
  }
  return [];
}

/** `data-next-query="path"`: writes the value into the element by its kind. */
export function bindQuery(root: ParentNode, a: AttributeContext): Render[] {
  return own(root, 'data-next-query')
    .filter((el) => a.b.claim(el, 'data-next-query'))
    .map((el) => {
      const path = el.getAttribute('data-next-query') ?? '';
      return () => {
        const { value, parent, field } = a.readField(path, el);
        const override = el.getAttribute('data-next-format') ?? a.query.formatOf(parent, field);
        write(el, field, value, a.engine, override);
      };
    });
}

/** `data-next-show` / `data-next-hide`: shown or hidden while the condition holds. */
export function bindShow(root: ParentNode, a: AttributeContext, only?: Set<Element>): Render[] {
  const renders: Render[] = [];
  for (const attr of ['data-next-show', 'data-next-hide'] as const) {
    for (const el of own(root, attr)) {
      if (only && !only.has(el)) continue;
      if (!a.b.claim(el, attr)) continue;
      const source = el.getAttribute(attr) ?? '';
      const expression = parseExpression(source);
      if (!expression) {
        a.b.warn(`cannot read ${attr}="${source}"`);
        continue;
      }
      renders.push(() => {
        const met = evaluate(expression, (path) => a.read(path, el));
        const visible = attr === 'data-next-show' ? met : !met;
        setVisible(el, visible);
        el.hidden = !visible;
      });
    }
  }
  return renders;
}

/** `data-next-each="list"`: one copy of the first child `<template>` per item; each copy reads that item. */
export function bindEach(root: ParentNode, a: AttributeContext): Render[] {
  return own(root, 'data-next-each')
    .filter((el) => a.b.claim(el, 'data-next-each'))
    .flatMap((container) => {
      const template = container.querySelector<HTMLTemplateElement>(':scope > template');
      const path = container.getAttribute('data-next-each') ?? '';
      if (!template) {
        a.b.warn(`data-next-each="${path}" needs a <template> child`);
        return [];
      }
      let shown: string | undefined;
      let items: unknown[] = [];
      let rows: Render[] = [];
      return [
        () => {
          const list = a.read(path, container);
          const next = Array.isArray(list) ? list : [];
          const key = JSON.stringify(next);
          if (key !== shown) {
            shown = key;
            items = next;
            container.replaceChildren(template);
            rows = [];
            items.forEach((_, i) => {
              const copy = template.content.cloneNode(true) as DocumentFragment;
              const nodes = [...copy.children];
              container.append(copy);
              for (const node of nodes) {
                a.setScope(node, () => items[i]);
                rows.push(...a.bindTree(node));
              }
            });
            container.toggleAttribute('data-next-empty', !items.length);
          }
          rows.forEach((r) => r());
        },
      ];
    });
}
