import { parseCondition } from '../engine/condition';
import { resolve, resolveCard, resolveToggle, type Value } from '../engine/values';
import { type BindContext, type Render } from './context';
import { conditionMet, setVisible, writeValue } from './dom';

const write = (el: HTMLElement, v: Value, b: BindContext) => writeValue(el, v, b.engine);

export function bindDisplay(root: ParentNode, b: BindContext): Render[] {
  const renders: Render[] = [];

  b.each(root, 'data-next-display', (el) => {
    const path = el.getAttribute('data-next-display') ?? '';
    const ctx = b.contextOf(el);
    renders.push(() => {
      const v = resolve(b.engine, path, ctx);
      if (!v) return b.warn(`unknown display path "${path}"`);
      write(el, v, b);
    });
  });

  b.each(root, 'data-next-bundle-display', (el) => {
    const prop = el.getAttribute('data-next-bundle-display') ?? '';
    const card = b.cardOf(el);
    if (!card) return b.warn('data-next-bundle-display outside a [data-next-bundle-card]');
    renders.push(() => {
      const v = resolveCard(b.engine, card, prop);
      if (!v) return b.warn(`unknown bundle-display property "${prop}"`);
      write(el, v, b);
    });
  });

  b.each(root, 'data-next-toggle-display', (el) => {
    const prop = el.getAttribute('data-next-toggle-display') ?? '';
    const cardEl = el.closest('[data-next-toggle-card]');
    const packageId = Number(cardEl?.getAttribute('data-next-package-id'));
    const baseQty = Number(cardEl?.getAttribute('data-next-quantity') || 1);
    if (!packageId) return b.warn('data-next-toggle-display outside a [data-next-toggle-card]');
    renders.push(() => {
      const v = resolveToggle(b.engine, packageId, prop, baseQty);
      if (!v) return b.warn(`unknown toggle-display property "${prop}"`);
      write(el, v, b);
    });
  });

  for (const attr of ['data-next-show', 'data-next-hide'] as const) {
    b.each(root, attr, (el) => {
      const source = el.getAttribute(attr) ?? '';
      const condition = parseCondition(source);
      if (!condition) return b.warn(`cannot read ${attr}="${source}"`);
      const ctx = b.contextOf(el);
      renders.push(() => {
        const v = resolve(b.engine, condition.path, ctx);
        if (!v) return b.warn(`unknown path "${condition.path}" in ${attr}`);
        const met = conditionMet(condition, v);
        setVisible(el, attr === 'data-next-show' ? met : !met);
      });
    });
  }

  return renders;
}
