import { cartItem } from './cart/public';
import type { Engine } from './engine';

export type ModelType = 'Cart' | 'CartItem' | 'Selector' | 'Option' | 'Checkout' | 'Order' | 'OrderItem';

type Model = Record<string, unknown>;
type Derive = (object: never) => unknown;

/** The model type of an object from its fields: the objects `next.query()`, events and attributes share. */
export function modelType(o: unknown): ModelType | undefined {
  if (!o || typeof o !== 'object') return undefined;
  const has = (k: string) => k in o;
  if (has('selector_id')) return 'Selector';
  if (has('option_id')) return 'Option';
  if (has('ref_id') && has('lines')) return 'Order';
  if (has('upsell') && has('product_title')) return 'OrderItem';
  if (has('package_id')) return 'CartItem';
  if (has('coupons') && has('lines')) return 'Cart';
  if (has('cart') && has('id')) return 'Checkout';
  return undefined;
}

const ID_FIELDS = ['option_id', 'selector_id', 'package_id', 'id', 'code'];

const child = (o: unknown, key: string): unknown => {
  if (Array.isArray(o)) {
    if (/^\d+$/.test(key)) return o[Number(key)];
    return o.find((item) => ID_FIELDS.some((f) => String((item as Model)?.[f]) === key));
  }
  return o && typeof o === 'object' ? (o as Model)[key] : undefined;
};

/**
 * Reads a path of the object model: `cart.total`, `selector.main.options.three.price`,
 * `package.42.price`, `order.lines.0.product_title`. A path whose first part is not a root reads
 * the `scope` object (a card, an `each` row) instead. Fields a page defines with `define` read
 * like the SDK's own.
 */
export class Query {
  private defined = new Map<string, { derive: Derive; format?: string }>();
  private extra = new Map<string, () => unknown>();

  constructor(private engine: Engine) {}

  define(type: ModelType, name: string, derive: Derive, options: { format?: string } = {}): void {
    this.defined.set(`${type}.${name}`, { derive, format: options.format });
  }

  /** The format a defined field asked for, for display. */
  formatOf(object: unknown, name: string): string | undefined {
    return this.defined.get(`${modelType(object)}.${name}`)?.format;
  }

  /** Adds a root entry, such as `selector.protect` for an order bump the page named. */
  register(path: string, get: () => unknown): void {
    this.extra.set(path, get);
  }

  root(name: string): unknown {
    const { engine } = this;
    const state = engine.getState();
    switch (name) {
      case 'cart':
        return engine.cart.current();
      case 'selector':
        return engine.selectors.list();
      case 'checkout':
        return state.checkout && { ...engine.cart.currentCheckout(), errors: this.errors() };
      case 'order':
        return engine.snapshot().order;
      case 'campaign':
        return engine.eventCampaign();
      case 'param':
        return state.visit.params;
      default:
        return undefined;
    }
  }

  get(path: string, scope?: unknown): unknown {
    const parts = path.split('.').filter(Boolean);
    const [first = '', second = ''] = parts;
    const extra = this.extra.get(`${first}.${second}`);
    let value: unknown;
    let rest: string[];
    if (extra) {
      value = extra();
      rest = parts.slice(2);
    } else if (first === 'package' && /^\d+$/.test(second)) {
      value = this.package(Number(second));
      rest = parts.slice(2);
    } else if (scope !== undefined && child(scope, first) !== undefined) {
      value = scope;
      rest = parts;
    } else if (this.root(first) !== undefined || ['checkout', 'order', 'campaign'].includes(first)) {
      value = this.root(first);
      rest = parts.slice(1);
    } else {
      value = scope;
      rest = parts;
    }
    for (const key of rest) value = this.field(value, key);
    return value;
  }

  field(object: unknown, key: string): unknown {
    const own = child(object, key);
    if (own !== undefined) return own;
    const defined = this.defined.get(`${modelType(object)}.${key}`);
    return defined ? defined.derive(object as never) : undefined;
  }

  /** Calls `fn` with the path's value now and each time it changes. */
  watch(path: string, fn: (value: unknown) => void): () => void {
    let last = JSON.stringify(this.get(path)) ?? '';
    fn(this.get(path));
    return this.engine.subscribe(() => {
      const value = this.get(path);
      const key = JSON.stringify(value) ?? '';
      if (key === last) return;
      last = key;
      fn(value);
    });
  }

  private package(id: number): unknown {
    const pkg = this.engine.getPackage(id);
    if (!pkg) return undefined;
    const total = pkg.price_total;
    return cartItem(
      this.engine.getState(),
      { package_id: id, quantity: 1 },
      {
        package_id: id,
        quantity: 1,
        unit_price: pkg.price,
        original_unit_price: pkg.price,
        package_price: total,
        original_package_price: total,
        subtotal: total,
        total_discount: '0',
        total,
        discounts: [],
      },
    );
  }

  private errors(): Record<string, string> {
    const errors = this.engine.getState().checkout?.errors ?? {};
    return Object.fromEntries(Object.entries(errors).map(([field, e]) => [field, e.message ?? e.code]));
  }
}
