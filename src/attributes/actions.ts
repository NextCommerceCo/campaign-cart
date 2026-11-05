import type { ActionArgs, ActionName, ActionResult } from '../engine/actions';
import { nextQuantity } from '../engine/actions';
import { nextUrl } from '../engine/params';
import type { Render } from '../bindings/context';
import type { AttributeContext } from './context';

/** Attributes with their own role: never an action argument. */
const ROLES = new Set([
  'action',
  'go',
  'query',
  'show',
  'hide',
  'each',
  'for',
  'field',
  'format',
  'empty',
  'selector',
  'option',
  'checkout',
  'promotion',
  'address',
  'payment',
  'express',
  'selected',
  'in-cart',
  'loading',
  'disabled',
  'invalid',
]);

/** The fields an object in scope fills when the element does not name them. */
const FROM_SCOPE = ['package_id', 'selector_id', 'option_id', 'code', 'shipping_id'];

const snake = (name: string) => name.replace(/-/g, '_');

/** `data-next-<kebab>` attributes on an action element: its arguments, named as the model's fields. */
function ownArgs(el: Element): ActionArgs {
  const args: ActionArgs = {};
  for (const { name, value } of el.attributes) {
    if (!name.startsWith('data-next-')) continue;
    const key = name.slice('data-next-'.length);
    if (!ROLES.has(key)) args[snake(key)] = value;
  }
  return args;
}

/** Inputs inside the element (a form) whose `data-next-field` names an argument. */
function fieldArgs(el: Element): ActionArgs {
  const args: ActionArgs = {};
  for (const input of el.querySelectorAll<HTMLInputElement>('[data-next-field]')) {
    const name = input.getAttribute('data-next-field')!;
    if (name.includes('.')) continue;
    args[name] = input.type === 'checkbox' ? input.checked : input.value;
  }
  return args;
}

function scopeArgs(scope: unknown): ActionArgs {
  if (typeof scope === 'string') return { code: scope };
  if (!scope || typeof scope !== 'object') return {};
  const o = scope as Record<string, unknown>;
  const args: ActionArgs = {};
  for (const key of FROM_SCOPE) {
    const v = o[key];
    if (typeof v === 'string' || typeof v === 'number') args[key] = v;
  }
  return args;
}

/** Whether a quantity step can move: false at a limit, so the button is disabled. */
function canStep(a: AttributeContext, args: ActionArgs): boolean {
  const state = a.engine.getState();
  const selectorId = args.selector_id && String(args.selector_id);
  if (selectorId) {
    const selector = state.selectors[selectorId];
    const card = selector?.cards.find((c) => c.id === selector.picked);
    if (!selector || !card) return false;
    const current = selector.quantities?.[card.id] ?? card.quantity ?? 1;
    const next = nextQuantity(args.quantity, current);
    return next !== undefined && next !== current && next >= (card.min ?? 1) && next <= (card.max ?? 999);
  }
  const packageId = Number(args.package_id);
  const current = a.engine.cart.lines().find((l) => l.package_id === packageId)?.quantity ?? 0;
  const next = nextQuantity(args.quantity, current);
  const min = Number(args.min_quantity ?? (current > 0 ? 1 : 0));
  const max = Number(args.max_quantity ?? Infinity);
  return !!packageId && next !== undefined && next !== current && next >= min && next <= max;
}

function ready(a: AttributeContext, name: ActionName, args: ActionArgs): boolean {
  switch (name) {
    case 'addItem':
    case 'acceptUpsell':
      return !args.selector_id || !!a.engine.getState().selectors[String(args.selector_id)]?.picked;
    case 'setQuantity':
      return canStep(a, args);
    case 'select':
      return !!args.selector_id && !!args.option_id;
    default:
      return true;
  }
}

/** `data-next-action="<name>"`: runs `next.actions.<name>` on click, or on submit for a form. */
export function bindActions(root: ParentNode, a: AttributeContext): Render[] {
  const els = [...root.querySelectorAll<HTMLElement>('[data-next-action]')];
  if (root instanceof HTMLElement && root.matches('[data-next-action]')) els.unshift(root);
  const renders: Render[] = [];
  for (const el of els) {
    const name = el.getAttribute('data-next-action') as ActionName;
    if (!(name in a.actions) || !a.b.claim(el, 'data-next-action')) continue;
    const argsOf = (): ActionArgs => ({
      ...scopeArgs(a.scopeOf(el)),
      ...fieldArgs(el),
      ...ownArgs(el),
    });
    let running = false;
    const finish = (result: ActionResult) => {
      for (const field of Object.keys(a.errors)) if (field in argsOf()) delete a.errors[field];
      Object.assign(a.errors, result.errors);
      el.toggleAttribute('data-next-invalid', !result.ok);
      const go = el.getAttribute('data-next-go');
      if (!result.ok || !go) return false;
      const url = new URL(go, location.href);
      const refId = a.engine.getState().order?.refId;
      if (refId && !url.searchParams.has('ref_id')) url.searchParams.set('ref_id', refId);
      a.navigate(nextUrl(url.href, new URL(location.href), a.engine.getState().visit.params));
      return true;
    };
    const run = async (e: Event) => {
      e.preventDefault();
      if (running || el.hasAttribute('data-next-disabled')) return;
      running = true;
      el.toggleAttribute('data-next-loading', true);
      el.setAttribute('aria-busy', 'true');
      let leaving = false;
      try {
        leaving = finish(await a.actions[name](argsOf()));
      } finally {
        running = leaving;
        if (!leaving) {
          el.toggleAttribute('data-next-loading', false);
          el.removeAttribute('aria-busy');
        }
        a.rerender();
      }
    };
    el.addEventListener(el instanceof HTMLFormElement ? 'submit' : 'click', (e) => void run(e));
    renders.push(() => {
      const off = !running && !ready(a, name, argsOf());
      el.toggleAttribute('data-next-disabled', off);
      if ('disabled' in el && !(el instanceof HTMLFormElement)) (el as HTMLButtonElement).disabled = off;
    });
  }
  return renders;
}
