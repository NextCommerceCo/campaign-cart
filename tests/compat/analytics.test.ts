import { beforeEach, describe, expect, it } from 'vitest';
import { startLegacyDataLayer } from '../../src/compat/analytics';
import type { Engine } from '../../src/engine/engine';
import { OBJECTS, type TrackingEvent, type TrackingMap, type TrackingName } from '../../src/engine/events/analytics';
import type { Cart, CartItem } from '../../src/engine/events/carts';
import { newId } from '../../src/engine/id';
import { publicOrder } from '../../src/engine/order';
import { makeEngine } from '../fixtures/engine';
import { ORDER, withUpsell } from '../fixtures/order';

type Win = Window & { NextDataLayer?: any[]; dataLayer?: any[] };
const win = window as Win;
const options = { apiKey: 'pk_test', version: '1.0.0' };
const pushes = (event: string) => win.NextDataLayer!.filter((e) => e.event === event);

const track = <K extends TrackingName>(engine: Engine, event_type: K, data: TrackingMap[K], event_id = newId()) => {
  const event = {
    event_id,
    event_type,
    object: OBJECTS[event_type],
    data,
    created_at: new Date().toISOString(),
    session_id: engine.sessionId(),
    sdk_version: options.version,
    context: engine.eventContext(),
  } as TrackingEvent;
  engine.events.emit('analytics', event);
  return event_id;
};

const line = (package_id: number, quantity: number, price: number): CartItem => ({ package_id, quantity, price });
const emptyCart: Cart = { lines: [], coupons: [], quantity: 0, currency: 'USD' };

async function started() {
  const { engine } = makeEngine();
  await engine.start();
  startLegacyDataLayer(engine, options);
  return engine;
}

beforeEach(() => {
  delete win.NextDataLayer;
  delete win.dataLayer;
});

describe('0.4.x data layer from tracking events', () => {
  it('sends the lines added in one tick as one dl_add_to_cart, under the first line’s id', async () => {
    const engine = await started();
    const first = track(engine, 'product_added_to_cart', { ...line(1, 1, 49), first_in_session: true });
    track(engine, 'product_added_to_cart', { ...line(9, 2, 9), first_in_session: false });
    expect(win.NextDataLayer).toEqual([]);
    await Promise.resolve();
    expect(pushes('dl_add_to_cart')).toMatchObject([
      {
        event_id: first,
        first_in_session: true,
        ecommerce: {
          currency: 'USD',
          value: 67,
          items: [
            { item_id: '11', price: 49, quantity: 1, index: 0 },
            { item_id: '19', price: 9, quantity: 2, index: 1 },
          ],
        },
      },
    ]);
    expect(win.dataLayer).toEqual([{ ecommerce: null }, win.NextDataLayer![0]]);
  });

  it('pushes a pending burst before what follows it, and removes before adds', async () => {
    const engine = await started();
    track(engine, 'product_removed_from_cart', line(1, 1, 49));
    track(engine, 'product_added_to_cart', { ...line(2, 1, 89), first_in_session: false });
    track(engine, 'cart_updated', { ...emptyCart, lines: [line(2, 1, 89)] });
    expect(win.NextDataLayer!.map((e) => e.event)).toEqual([
      'dl_remove_from_cart',
      'dl_add_to_cart',
      'dl_cart_updated',
    ]);
    expect(pushes('dl_remove_from_cart')[0].ecommerce.items).toMatchObject([{ item_id: '11', price: 49 }]);
    expect(pushes('dl_add_to_cart')[0].ecommerce.items).toMatchObject([
      { item_id: '12', price: 44.5, quantity: 2, discount: 54.5 },
    ]);
    await Promise.resolve();
    expect(win.NextDataLayer).toHaveLength(3);
  });

  it('sends dl_add_shipping_info once per checkout, on the first of the address and the method', async () => {
    const engine = await started();
    const cart: Cart = {
      ...emptyCart,
      lines: [line(2, 1, 89)],
      shipping_method: { id: 2, name: 'Express', price: 9.99 },
    };
    track(engine, 'checkout_shipping_address_submitted', { id: 'c1', cart });
    track(engine, 'checkout_shipping_method_submitted', { id: 'c1', cart });
    track(engine, 'checkout_shipping_method_submitted', { id: 'c2', cart: { ...emptyCart, lines: cart.lines } });
    track(engine, 'checkout_shipping_address_submitted', { id: 'c2', cart });
    expect(pushes('dl_add_shipping_info')).toMatchObject([
      {
        shipping_tier: 'Express',
        event_category: 'ecommerce',
        ecommerce: { currency: 'USD', currencyCode: 'USD', shipping: 9.99, shipping_tier: 'Express', value: 89 },
      },
      { shipping_tier: 'Standard' },
    ]);
    expect(pushes('dl_add_shipping_info')[1].ecommerce).not.toHaveProperty('shipping');
  });

  it('builds dl_purchase from the order as the API returned it, with the code the checkout sent', async () => {
    const engine = await started();
    engine.attach((ctx) =>
      ctx.update('order', { paidOrder: ORDER, coupon: { refId: 'R1', code: 'CARD5', codes: ['SAVE10'] } }),
    );
    track(engine, 'checkout_completed', publicOrder(ORDER, ['SAVE10']), '1001');
    expect(pushes('dl_purchase')).toMatchObject([
      {
        event_id: '1001',
        pageType: 'purchase',
        ecommerce: {
          currency: 'USD',
          transaction_id: '1001',
          value: 89,
          tax: 7.12,
          shipping: 9.99,
          affiliation: 'Online Store',
          coupon: 'CARD5',
          items: [{ item_id: 'EB-2', item_name: 'Earbuds', price: 44.5, quantity: 2, index: 0 }],
        },
      },
    ]);
    expect(pushes('dl_purchase')[0].ecommerce).not.toHaveProperty('discount');
    expect(JSON.stringify(win.NextDataLayer)).not.toContain('jane@example.com');
  });

  it('sends no dl_purchase for an order that is not in the state', async () => {
    const engine = await started();
    track(engine, 'checkout_completed', publicOrder({ ...ORDER, ref_id: 'R2' }), '1002');
    expect(pushes('dl_purchase')).toEqual([]);
  });

  it('builds dl_upsell_purchase from the order’s upsell line', async () => {
    const engine = await started();
    const order = withUpsell(ORDER, 99, 1, { package: 9 });
    engine.attach((ctx) => ctx.update('order', { order }));
    const upsell = publicOrder(order).lines.find((l) => l.upsell)!;
    track(engine, 'upsell_completed', { ...publicOrder(order), upsell: { number: 1, line: upsell } }, 'R1-US1');
    expect(pushes('dl_upsell_purchase')).toMatchObject([
      {
        event_id: 'R1-US1',
        pageType: 'upsell',
        ecommerce: { transaction_id: 'R1-US1', affiliation: 'Upsell', value: 20, tax: 0, shipping: 0 },
        upsell_metadata: { original_order_id: 'R1', upsell_number: 1, package_id: '9', package_name: 'Bump' },
      },
    ]);
  });
});
