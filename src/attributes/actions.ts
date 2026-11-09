import type { ActionArgs, ActionName, ActionResult } from '../engine/actions';
import { ready } from '../engine/actions';
import { nextUrl } from '../engine/visit/params';
import type { Render } from '../dom/context';
import { matching } from '../dom/dom';
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
const FROM_SCOPE = ['package_id', 'selector_id', 'option_id', 'slot_index', 'code', 'value', 'shipping_id'];

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

/** `data-next-action="<name>"`: runs `next.actions.<name>` on click, or on submit for a form. */
export function bindActions(root: ParentNode, a: AttributeContext): Render[] {
  const renders: Render[] = [];
  for (const el of matching(root, '[data-next-action]')) {
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
      const { order, visit } = a.engine.getState();
      a.navigate(nextUrl(go, new URL(location.href), visit.params, order?.refId));
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
      const off = !running && !ready(a.engine, name, argsOf());
      el.toggleAttribute('data-next-disabled', off);
      if ('disabled' in el && !(el instanceof HTMLFormElement)) (el as HTMLButtonElement).disabled = off;
    });
  }
  return renders;
}
