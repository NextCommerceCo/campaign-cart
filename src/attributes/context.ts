import type { Actions } from '../engine/actions';
import type { Engine } from '../engine/engine';
import type { Query } from '../engine/query';
import type { BindContext, Render } from '../bindings/context';

/** Binds one kind of attribute inside `root`, returning what renders it; `only` limits show / hide to those elements. */
export type Binder = (root: ParentNode, a: AttributeContext, only?: Set<Element>) => Render[];

/**
 * What every v2 binding shares: the object model, the actions, and the scope each element reads
 * short paths from (an option, an `each` row, a `data-next-for`).
 */
export class AttributeContext {
  private scopes = new WeakMap<Element, () => unknown>();
  /** The last refusal of each action argument, read as `errors.<field>`. */
  readonly errors: Record<string, string> = {};

  constructor(
    readonly b: BindContext,
    readonly query: Query,
    readonly actions: Actions,
    readonly navigate: (url: string) => void,
    readonly bindTree: (root: ParentNode) => Render[],
    readonly rerender: () => void,
  ) {}

  get engine(): Engine {
    return this.b.engine;
  }

  setScope(el: Element, get: () => unknown): void {
    this.scopes.set(el, get);
  }

  /** The object short paths read inside `el`: the nearest scope at or above it. */
  scopeOf(el: Element): unknown {
    for (let node: Element | null = el; node; node = node.parentElement) {
      const get = this.scopes.get(node);
      if (get) return get();
    }
    return undefined;
  }

  /** The scope above `el`, for the element that sets a scope and reads one. */
  outerScopeOf(el: Element): unknown {
    return el.parentElement ? this.scopeOf(el.parentElement) : undefined;
  }

  read(path: string, el: Element): unknown {
    if (path.startsWith('errors.')) return this.errors[path.slice('errors.'.length)];
    return this.query.get(path, this.scopeOf(el));
  }

  /** The value of a path and the object it is a field of, for that object's defined formats. */
  readField(path: string, el: Element): { value: unknown; parent: unknown; field: string } {
    const parts = path.split('.');
    const field = parts.pop() ?? '';
    const parent = parts.length ? this.read(parts.join('.'), el) : this.scopeOf(el);
    return { value: this.read(path, el), parent, field };
  }
}
