import { createActions, type Actions } from '../engine/actions';
import type { Engine } from '../engine/engine';
import { nextUrl } from '../engine/params';
import type { Query } from '../engine/query';
import { BindContext, type Render } from '../bindings/context';
import { bindActions } from './actions';
import { AttributeContext } from './context';
import { bindEach, bindFor, bindQuery, bindShow } from './display';
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

export interface AttributeBindings {
  render(): void;
  bind(root: ParentNode): void;
}

/**
 * Binds attributes v2 inside `root`: scopes first (`data-next-for`, selectors and options), then
 * lists, then what reads and acts on them. `deferred` are the `data-next-show` / `-hide`
 * elements the 0.4.x bindings left to v2: a condition they cannot read or a path they do not know.
 */
export function bindAttributes(
  root: ParentNode,
  engine: Engine,
  query: Query,
  options: { navigate?: (url: string) => void; deferred?: Set<Element> } = {},
): AttributeBindings {
  const renders: Render[] = [];
  const render = () => renders.forEach((r) => r());
  const bindTree = (node: ParentNode): Render[] => [
    ...bindFor(node, a),
    ...bindOptions(node, a),
    ...bindEach(node, a),
    ...bindQuery(node, a),
    ...bindShow(node, a, node === root ? options.deferred : undefined),
    ...bindActions(node, a),
    ...bindFields(node, a),
  ];
  const a: AttributeContext = new AttributeContext(
    new BindContext(engine),
    query,
    pageActions(engine),
    options.navigate ?? ((url) => location.assign(url)),
    bindTree,
    render,
  );
  defineVariants(query, engine);
  renders.push(...bindTree(root));
  engine.subscribe(render);
  render();
  return {
    render,
    bind: (node) => {
      const added = bindTree(node);
      renders.push(...added);
      added.forEach((r) => r());
    },
  };
}
