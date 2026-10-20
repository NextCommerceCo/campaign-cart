import { parseCondition } from '../engine/condition';
import { format, resolve, resolveLines, truthy, type Value } from '../engine/values';
import { type BindContext, type Render, setText, setVisible } from './context';

function write(el: Element, v: Value, b: BindContext): void {
  const campaign = b.engine.getState().campaign;
  if (v.type === 'url' && el instanceof HTMLImageElement) {
    if (v.value && el.getAttribute('src') !== v.value) el.src = String(v.value);
    return;
  }
  setText(el, format(v, campaign?.currency, campaign?.language, el.getAttribute('data-next-format')));
}

export function bindDisplay(root: ParentNode, b: BindContext): Render[] {
  const renders: Render[] = [];

  root.querySelectorAll('[data-next-display]').forEach((el) => {
    const path = el.getAttribute('data-next-display') ?? '';
    const ctx = b.contextOf(el);
    renders.push(() => {
      const v = resolve(b.engine, path, ctx, b.cards);
      if (!v) return b.warn(`unknown display path "${path}"`);
      write(el, v, b);
    });
  });

  root.querySelectorAll('[data-next-bundle-display]').forEach((el) => {
    const prop = el.getAttribute('data-next-bundle-display') ?? '';
    renders.push(() => {
      const card = b.contextOf(el).card;
      if (!card) return b.warn('data-next-bundle-display outside a [data-next-bundle-card]');
      const selected = b.engine.getState().selections[card.selectorId] === card.cardId;
      const v = resolveLines(b.engine, card.lines, prop, selected);
      if (!v) return b.warn(`unknown bundle-display property "${prop}"`);
      write(el, v, b);
    });
  });

  root.querySelectorAll('[data-next-toggle-display]').forEach((el) => {
    const prop = el.getAttribute('data-next-toggle-display') ?? '';
    const cardEl = el.closest('[data-next-toggle-card]');
    const packageId = Number(cardEl?.getAttribute('data-next-package-id'));
    const quantity = Number(cardEl?.getAttribute('data-next-quantity') || 1);
    renders.push(() => {
      if (!packageId) return b.warn('data-next-toggle-display outside a [data-next-toggle-card]');
      const selected = !!b.engine.getState().cart.groups[`toggle:${packageId}`];
      const v = resolveLines(b.engine, [{ packageId, quantity }], prop, selected);
      if (!v) return b.warn(`unknown toggle-display property "${prop}"`);
      write(el, v, b);
    });
  });

  for (const attr of ['data-next-show', 'data-next-hide'] as const) {
    root.querySelectorAll<HTMLElement>(`[${attr}]`).forEach((el) => {
      const source = el.getAttribute(attr) ?? '';
      const condition = parseCondition(source);
      if (!condition) {
        b.warn(`cannot read ${attr}="${source}"`);
        return;
      }
      const ctx = b.contextOf(el);
      renders.push(() => {
        const v = resolve(b.engine, condition.path, ctx, b.cards);
        if (!v) return b.warn(`unknown path "${condition.path}" in ${attr}`);
        let met: boolean;
        if (condition.kind === 'compare') {
          const equal = String(v.value ?? '') === condition.literal;
          met = condition.op === '==' ? equal : !equal;
        } else {
          met = truthy(v) !== condition.negate;
        }
        setVisible(el, attr === 'data-next-show' ? met : !met);
      });
    });
  }

  return renders;
}
