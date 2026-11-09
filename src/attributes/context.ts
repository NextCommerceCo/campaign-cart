import type { Actions } from '../engine/actions';
import type { Engine } from '../engine/engine';
import type { Query } from '../engine/display/query';
import type { BindContext, Render } from '../dom/context';

/** Binds one kind of attribute inside `root`, returning what renders it; `only` limits show / hide to those elements. */
export type Binder = (root: ParentNode, a: AttributeContext, only?: Set<Element>) => Render[];

/**
 * What every v2 binding shares: the object model, the actions, and the scope each element reads
 * short paths from (an option, an `each` row, a `data-next-for`).
 */
export class AttributeContext {
  private scopes = new WeakMap<Element, () => unknown>();
  private warned = new Set<string>();
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

  read(path: string, el: Element, attr?: string): unknown {
    if (path.startsWith('errors.')) return this.errors[path.slice('errors.'.length)];
    return this.readIn(path, this.scopeOf(el), el, attr);
  }

  /** Reads `path` in `scope`; an undefined field its object's type lacks warns once, naming `el`'s `attr`. */
  readIn(path: string, scope: unknown, el: Element, attr?: string): unknown {
    const value = this.query.get(path, scope);
    const unknown = value === undefined && attr && this.query.unknown(path, scope);
    if (unknown) this.warn(el, attr!, `unknown field "${unknown.field}" on ${unknown.type}`);
    return value;
  }

  /** Warns once about an element's attribute, with the attribute and its value as data for the debug panel. */
  warn(el: Element, attribute: string, note: string): void {
    const value = el.getAttribute(attribute) ?? '';
    const message = `${note} in ${attribute}="${value}"`;
    if (this.warned.has(message)) return;
    this.warned.add(message);
    this.engine.log.warn(message, { attribute, value, note });
  }

  /** The value of a path and the object it is a field of, for that object's defined formats. */
  readField(path: string, el: Element, attr: string): { value: unknown; parent: unknown; field: string } {
    const parts = path.split('.');
    const field = parts.pop() ?? '';
    const parent = parts.length ? this.read(parts.join('.'), el) : this.scopeOf(el);
    return { value: this.read(path, el, attr), parent, field };
  }
}
