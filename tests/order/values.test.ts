import { describe, expect, it } from 'vitest';
import { createOrder } from '../../src/order/state';
import { ORDER_VALUES, orderValue, pathsOf } from '../../src/order/values';
import { format } from '../../src/engine/display/format';
import { fakeApi } from '../fixtures/api';
import { makeEngine } from '../fixtures/engine';
import { ORDER } from '../fixtures/order';
import type { ApiOrder, State } from '../../src/engine/types';

async function setup() {
  const api = fakeApi();
  const { engine } = makeEngine({ fetch: api.fetch });
  await engine.start();
  const order = engine.attach((ctx) => createOrder(ctx, engine.cart));
  return { engine, order };
}

describe('order values', () => {
  it('answers the receipt’s order.* paths', async () => {
    const { engine, order } = await setup();
    const show = (path: string) => {
      const v = orderValue(engine.getState(), path);
      return v && format(v, 'USD', 'en');
    };
    expect(orderValue(engine.getState(), 'hasTax')).toEqual({ type: 'bool', value: false });
    await order.load('R1');
    expect(show('total')).toBe('$106.11');
    expect(show('subtotal')).toBe('$89.00');
    expect(show('tax')).toBe('$7.12');
    expect(show('shipping')).toBe('$9.99');
    expect(orderValue(engine.getState(), 'hasTax')).toEqual({ type: 'bool', value: true });
    expect(show('number')).toBe('1001');
    expect(show('paymentMethod')).toBe('Credit Card');
    expect(show('customer.name')).toBe('Jane Doe');
    expect(show('shippingAddress.city')).toBe('Austin');
    expect(show('billingAddress.name')).toBe('Ann Lee');
    expect(orderValue(engine.getState(), 'nope')).toBeUndefined();
  });

  it('lists every order path, and reads the customer and addresses by their own fields only', async () => {
    expect(pathsOf('order', ORDER_VALUES)).toMatchInlineSnapshot(`
      [
        "order.number",
        "order.refId",
        "order.ref_id",
        "order.currency",
        "order.total",
        "order.totalExclTax",
        "order.total_excl_tax",
        "order.tax",
        "order.shipping",
        "order.shippingExclTax",
        "order.discounts",
        "order.subtotal",
        "order.hasTax",
        "order.hasShipping",
        "order.hasDiscounts",
        "order.hasItems",
        "order.isEmpty",
        "order.hasUpsells",
        "order.supportsUpsells",
        "order.itemCount",
        "order.shippingMethod",
        "order.paymentMethod",
        "order.customer",
        "order.user",
        "order.shippingAddress",
        "order.billingAddress",
      ]
    `);
    const { engine, order } = await setup();
    await order.load('R1');
    const state = engine.getState();
    expect(orderValue(state, 'customer.email')).toEqual(orderValue(state, 'user.email'));
    expect(orderValue(state, 'shippingAddress.zip')).toEqual(orderValue(state, 'shippingAddress.postcode'));
    expect(orderValue(state, 'customer.constructor')).toBeUndefined();
    expect(orderValue(state, 'billingAddress.toString')).toBeUndefined();
  });

  it('writes an order address on one line, every field its own part, empty ones left out', () => {
    const line = (shipping_address: ApiOrder['shipping_address']) =>
      orderValue({ order: { order: { ...ORDER, shipping_address } } } as State, 'shippingAddress')?.value;
    const full = { line1: '1 Main St', line2: 'Apt 2', line4: 'Austin', state: 'TX', postcode: '73301', country: 'US' };
    expect(line(full)).toBe('1 Main St, Apt 2, Austin, TX, 73301, US');
    expect(line({ ...full, line2: '', state: undefined })).toBe('1 Main St, Austin, 73301, US');
    expect(line({ line1: '9 High St' })).toBe('9 High St');
    expect(orderValue({ order: { order: ORDER } } as State, 'billingAddress.full')?.value).toBe(
      '2 Side St, Reno, NV, US',
    );
  });
});
