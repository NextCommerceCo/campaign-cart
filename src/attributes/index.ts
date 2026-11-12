import { createActions, type ActionArgs, type Actions } from '../engine/actions';
import type { CartLine } from '../engine/cart/types';
import type { Engine } from '../engine/engine';
import { nextUrl } from '../engine/visit/params';
import type { Query } from '../engine/display/query';
import { BindContext, type Render } from '../dom/context';
import { bindActions } from './actions';
import { AttributeContext, type Binder } from './context';
import { bindEach, bindFor, bindQuery, bindShow } from './display';
import { bindDefine } from './define';
import { bindFields, defineVariants } from './fields';
import { bindOptions } from './options';

const made = new WeakMap<Engine, Actions>();

/** The actions `next.actions` and `data-next-action` share, made once per page. */
export function pageActions(engine: Engine): Actions {
  let actions = made.get(engine);
  if (!actions) {
    actions = createActions(engine, {
      page: () => location.pathname,
      navigate: (url) => location.assign(url),
      url: (target) => nextUrl(target, new URL(location.href), engine.getState().visit.params),
    });
    made.set(engine, actions);
  }
  return actions;
}

/** A `next.actions` call: one object of field names, or one of 0.5's positional calls (`addItem(42, 2)`). */
export function runAction(engine: Engine, name: string, args: unknown[]): Promise<unknown> {
  const [first, second] = args;
  const { cart } = engine;
  if (name === 'setGroup') {
    const group = second as { lines: CartLine[]; vouchers?: string[] } | null;
    return cart.setGroup(String(first), group && { lines: group.lines, vouchers: group.vouchers ?? [] });
  }
  if (typeof first !== 'object' || first === null) {
    switch (name) {
      case 'addItem':
        return cart.addItem(Number(first), second as number | undefined);
      case 'removeItem':
        return cart.removeItem(Number(first));
      case 'setQuantity':
        return cart.setQuantity(Number(first), Number(second));
      case 'applyCoupon':
        return cart.applyCoupon(String(first));
      case 'removeCoupon':
        return cart.removeCoupon(String(first));
      case 'setShipping':
        return cart.setShipping(first as number | undefined);
    }
  }
  const actions = pageActions(engine);
  if (!(name in actions)) {
    engine.log.warn(`next.actions: unknown action "${name}"`);
    return Promise.resolve({ ok: false, errors: { action: `unknown action "${name}"` } });
  }
  return actions[name as keyof Actions](first as ActionArgs | undefined);
}

export interface AttributeBindings {
  render(): void;
  bind(root: ParentNode): void;
  /** Stops rendering on engine updates and removes the listeners these bindings own. */
  dispose(): void;
}

/**
 * Binds attributes v2 inside `root`: scopes first (`data-next-for`, selectors and options), then
 * lists, then what reads and acts on them. `deferred` are the `data-next-show` / `-hide`
 * elements the 0.4.x bindings left to v2: a condition they cannot read or a path they do not know.
 * A list row's copy is bound whole: the 0.4.x bindings never saw it.
 */
export function bindAttributes(
  root: ParentNode,
  engine: Engine,
  query: Query,
  options: { navigate?: (url: string) => void; deferred?: Set<Element> } = {},
): AttributeBindings {
  const renders: Render[] = [];
  const render = () => renders.forEach((r) => r());
  const binders: Binder[] = [bindDefine, bindFor, bindOptions, bindEach, bindQuery, bindShow, bindActions, bindFields];
  const bindTree = (node: ParentNode, shown?: Set<Element>): Render[] =>
    binders.flatMap((binder) => binder(node, a, shown));
  const b = new BindContext(engine);
  const a: AttributeContext = new AttributeContext(
    b,
    query,
    pageActions(engine),
    options.navigate ?? ((url) => location.assign(url)),
    (node) => bindTree(node),
    render,
  );
  defineVariants(query, engine);
  renders.push(...bindTree(root, options.deferred));
  b.offs.push(engine.subscribe(render));
  render();
  return {
    render,
    dispose: () => b.offs.forEach((off) => off()),
    bind: (node) => {
      const added = bindTree(node, options.deferred);
      renders.push(...added);
      added.forEach((r) => r());
    },
  };
}
