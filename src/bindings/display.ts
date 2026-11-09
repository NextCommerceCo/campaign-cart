import { conditionMet, parseCondition } from '../engine/condition';
import type { Engine } from '../engine/engine';
import { format, localeOf, truthy, type Value } from '../engine/format';
import { resolve, resolveCard, resolveToggle } from '../engine/values';
import { type BindContext, type Render } from './context';
import { setText, setVisible, showWhen } from './dom';

const V2_SCOPE = '[data-next-option],[data-next-for],[data-next-selector],[data-next-each]';
const SHOW_HIDE = ['data-next-show', 'data-next-hide'] as const;

export function writeValue(el: HTMLElement, v: Value, engine: Engine): void {
  if (v.held) return;
  const campaign = engine.getState().campaign;
  if (v.type === 'bool') return setVisible(el, truthy(v));
  if (v.type === 'url' && el instanceof HTMLImageElement) {
    if (v.value && el.getAttribute('src') !== v.value) el.src = String(v.value);
    return;
  }
  setText(el, format(v, campaign?.currency, localeOf(engine.getState()), el.getAttribute('data-next-format')));
}

/** Writes each `data-next-display` and `data-next-show` / `-hide` under `root` once, `local` paths first. */
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
  for (const attr of SHOW_HIDE) {
    for (const el of root.querySelectorAll<HTMLElement>(`[${attr}]`)) {
      const condition = parseCondition(el.getAttribute(attr)!);
      const v = condition && (local(condition.path) ?? resolve(engine, condition.path));
      if (condition && v && !v.held) showWhen(el, attr, conditionMet(condition, v));
    }
  }
}

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

  for (const attr of SHOW_HIDE) {
    b.each(root, attr, (el) => {
      const source = el.getAttribute(attr) ?? '';
      const condition = parseCondition(source);
      const ctx = b.contextOf(el);
      const unknown = !condition || !resolve(b.engine, condition.path, ctx);
      // Attributes v2 paths are snake_case: a 0.4.x path such as `cart.hasItems` stays here, warned as before.
      if (el.closest(V2_SCOPE) || (unknown && !/[A-Z]/.test(source))) return void b.deferred.add(el);
      if (!condition) return b.warn(`cannot read ${attr}="${source}"`);
      renders.push(() => {
        const v = resolve(b.engine, condition.path, ctx);
        if (!v) return b.warn(`unknown path "${condition.path}" in ${attr}`);
        if (!v.held) showWhen(el, attr, conditionMet(condition, v));
      });
    });
  }

  return renders;
}
