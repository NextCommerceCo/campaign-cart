import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { FIELDS, modelType, Query } from '../../../src/engine/display/query';
import { flush, makeEngine } from '../../fixtures/engine';

async function ready(params?: Record<string, string>) {
  const { engine } = makeEngine({ params });
  await engine.start();
  return { engine, query: new Query(engine) };
}

const cards = [
  { id: 'one', lines: [{ packageId: 1, quantity: 1 }], vouchers: [] },
  { id: 'three', lines: [{ packageId: 1, quantity: 3 }], vouchers: [] },
];

describe('query', () => {
  it('reads the cart as cart.* events carry it', async () => {
    const { engine, query } = await ready();
    await engine.cart.addItem(1, 2);
    await engine.cart.settled();
    expect(query.get('cart')).toEqual(engine.cart.current());
    expect(query.get('cart.quantity')).toBe(2);
    expect(query.get('cart.lines.0.package_id')).toBe(1);
    expect(query.get('cart.lines.1')).toBeUndefined();
  });

  it('finds a selector and its options by id, and a list entry by its id field', async () => {
    const { engine, query } = await ready();
    await engine.selectors.register('main', cards, 'swap', 'three');
    await flush();
    expect(query.get('selector.main.option_id')).toBe('three');
    expect(query.get('selector.main.options.one.selected')).toBe(false);
    expect(query.get('selector.main.options.three.quantity')).toBe(3);
    expect(query.get('selector.nope')).toBeUndefined();
  });

  it('reads a package at its campaign price, and the visit’s URL parameters', async () => {
    const { query } = await ready({ utm_source: 'fb' });
    expect(query.get('package.2')).toMatchObject({ package_id: 2, quantity: 1, price: 89, total: 89, subtotal: 89 });
    expect(query.get('package.2.total_discount')).toBe(0);
    expect(query.get('package.999')).toBeUndefined();
    expect(query.get('param.utm_source')).toBe('fb');
    expect(query.get('checkout')).toBeUndefined();
  });

  it('reads a short path from the scope object, and roots from anywhere', async () => {
    const { engine, query } = await ready();
    await engine.cart.addItem(1);
    const option = { option_id: 'x', lines: [], quantity: 1, selected: true, total: 10 };
    expect(query.get('total', option)).toBe(10);
    expect(query.get('cart.quantity', option)).toBe(1);
    expect(query.get('nope', option)).toBeUndefined();
  });

  it('adds a field a page defines to every object of its type, and keeps its format', async () => {
    const { engine, query } = await ready();
    await engine.selectors.register('main', cards, 'swap', 'one');
    query.define('Option', 'per_day', (o: { quantity: number }) => o.quantity * 10, { format: 'currency' });
    query.define('Cart', 'lines_count', (c: { lines: unknown[] }) => c.lines.length);
    expect(query.get('selector.main.options.three.per_day')).toBe(30);
    expect(query.get('per_day', query.get('selector.main.options.one'))).toBe(10);
    expect(query.get('cart.lines_count')).toBe(1);
    expect(query.formatOf(query.get('selector.main.options.one'), 'per_day')).toBe('currency');
    expect(query.get('selector.main.per_day')).toBeUndefined();
  });

  it('takes an extra root entry, such as an order bump the page named', async () => {
    const { query } = await ready();
    query.register('selector.protect', () => ({ selector_id: 'toggle:9', in_cart: true }));
    expect(query.get('selector.protect.in_cart')).toBe(true);
  });

  it('calls a watcher with the value now and on each change, not on an unchanged render', async () => {
    const { engine, query } = await ready();
    const fn = vi.fn();
    const off = query.watch('cart.quantity', fn);
    expect(fn).toHaveBeenLastCalledWith(0);
    await engine.cart.addItem(1, 2);
    await flush();
    expect(fn).toHaveBeenLastCalledWith(2);
    const calls = fn.mock.calls.length;
    await engine.cart.setShipping(1);
    await flush();
    expect(fn).toHaveBeenCalledTimes(calls);
    off();
  });

  it('names an object’s model type from its fields', () => {
    expect(modelType({ selector_id: 'a' })).toBe('Selector');
    expect(modelType({ option_id: 'a' })).toBe('Option');
    expect(modelType({ package_id: 1 })).toBe('CartItem');
    expect(modelType({ lines: [], coupons: [] })).toBe('Cart');
    expect(modelType({ ref_id: 'R', lines: [] })).toBe('Order');
    expect(modelType({ id: 'L', upsell: false, product_title: 'x' })).toBe('OrderItem');
    expect(modelType({ id: 'c', cart: {} })).toBe('Checkout');
    expect(modelType(3)).toBeUndefined();
  });

  it('names an option card, which carries its selector’s id, an Option, and an order bump a Selector', () => {
    expect(modelType({ option_id: 'a', selector_id: 'main', selected: true, lines: [], slots: [] })).toBe('Option');
    expect(modelType({ selector_id: 'toggle:9', in_cart: false, option_id: 'protect', selected: false })).toBe(
      'Selector',
    );
  });

  it('reads a list entry that is a plain value, such as a coupon code, as `value`', async () => {
    const { engine, query } = await ready();
    expect(query.get('value', 'SAVE10')).toBe('SAVE10');
    expect(query.get('value', 3)).toBe(3);
    await engine.cart.addItem(1);
    await engine.cart.applyCoupon('save10');
    expect(query.get('cart.coupons.0.value')).toBe('SAVE10');
    expect(query.get('value', { value: 'Black', name: 'Black' })).toBe('Black');
  });
});

describe('query: unknown fields', () => {
  it('names a field the object’s type does not have', async () => {
    const { query } = await ready();
    expect(query.unknown('cart.totl')).toEqual({ field: 'totl', type: 'Cart' });
    expect(query.unknown('totl', { package_id: 1, quantity: 1 })).toEqual({ field: 'totl', type: 'CartItem' });
    expect(query.unknown('package.2.prise')).toEqual({ field: 'prise', type: 'CartItem' });
  });

  it('never names a field its type has but the object lacks yet, an id lookup, an untyped object or a defined field', async () => {
    const { engine, query } = await ready();
    expect(query.get('cart.total')).toBeUndefined();
    for (const path of [
      'cart.total',
      'cart.discount_percentage',
      'selector.nope',
      'cart.lines.4',
      'param.x',
      'cart.shipping_method.nme',
    ])
      expect(query.unknown(path)).toBeUndefined();
    expect(query.unknown('original_total', { option_id: 'a', selector_id: 'm', selected: false, lines: [] })).toBe(
      undefined,
    );
    query.define('Cart', 'free_shipping_left', () => undefined);
    expect(query.unknown('cart.free_shipping_left')).toBeUndefined();
    await engine.cart.addItem(1);
    expect(query.unknown('cart.lines.0.totl')).toEqual({ field: 'totl', type: 'CartItem' });
  });

  it('lists exactly the fields of each model type’s TypeScript interface', () => {
    const files = ['carts', 'selectors', 'checkout', 'orders'].map((f) => `src/engine/events/${f}.ts`);
    const program = ts.createProgram(files, { strict: true, noEmit: true });
    const checker = program.getTypeChecker();
    const interfaces = new Map<string, ts.Type>();
    for (const file of files)
      ts.forEachChild(program.getSourceFile(file)!, (node) => {
        if (ts.isInterfaceDeclaration(node)) interfaces.set(node.name.text, checker.getTypeAtLocation(node));
      });
    const TYPES = {
      Cart: 'Cart',
      CartItem: 'CartItem',
      Selector: 'Selector',
      Option: 'SelectorOption',
      Checkout: 'Checkout',
      Order: 'Order',
      OrderItem: 'OrderItem',
    } as const;
    for (const [type, name] of Object.entries(TYPES)) {
      const keys = checker.getPropertiesOfType(interfaces.get(name)!).map((p) => p.name);
      expect(FIELDS[type as keyof typeof TYPES].split(' ').sort(), type).toEqual(keys.sort());
    }
    expect(Object.keys(FIELDS).sort()).toEqual(Object.keys(TYPES).sort());
  });
});
