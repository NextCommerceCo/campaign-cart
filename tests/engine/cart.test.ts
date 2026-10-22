import { describe, expect, it } from 'vitest';
import { fakeApi } from '../fixtures/api';
import { flush, makeEngine, wait } from '../fixtures/engine';
import { MemoryStorage } from '../fixtures/storage';

const toggle = (id: number) => ({ lines: [{ packageId: id, quantity: 1 }], vouchers: [] });

describe('cart', () => {
  it('coalesces changes in one tick into one calculate request with the key header', async () => {
    const { engine, api } = makeEngine();
    await engine.start();
    void engine.cart.addItem(1);
    void engine.cart.setGroup('bundle:main', { lines: [{ packageId: 9, quantity: 1 }], vouchers: ['save10'] });
    await engine.cart.setShipping(1);
    expect(await engine.cart.applyCoupon(' save10 ')).toBe(false);
    expect(api.calls).toHaveLength(1);
    expect(api.calls[0]!.headers.Authorization).toBe('pk_test');
    expect(api.calls[0]!.body.vouchers).toEqual(['SAVE10']);
    expect(engine.getState().cart.summary?.total).toBe('48.00');
  });
  it('prices the cart with the shipping method the order will use, like 0.4.x', async () => {
    const { engine, api } = makeEngine();
    await engine.start();
    await engine.cart.addItem(1);
    expect(api.calls.at(-1)!.body.shipping_method).toBe(1);
  });

  it('keeps a code only when the server gives a discount for it, like 0.4.x', async () => {
    const { engine, api } = makeEngine();
    await engine.start();
    const refused: string[] = [];
    engine.on('coupon.refused', (e) => refused.push(e.data.code));
    await engine.cart.addItem(1);
    expect(await engine.cart.applyCoupon('nope')).toBe(false);
    expect(engine.getState().cart.coupons).toEqual([]);
    expect(await engine.cart.applyCoupon('save10')).toBe(true);
    expect(engine.getState().cart.coupons).toEqual(['SAVE10']);
    expect(refused).toEqual(['NOPE']);
    expect(api.calls.filter((c) => c.body.vouchers.includes('NOPE'))).toHaveLength(1);
  });

  it('checks a code entered on an empty cart once the cart has items', async () => {
    const { engine } = makeEngine();
    await engine.start();
    const refused: string[] = [];
    engine.on('coupon.refused', (e) => refused.push(e.data.code));
    expect(await engine.cart.applyCoupon('nope')).toBe(true);
    expect(await engine.cart.applyCoupon('save10')).toBe(true);
    await engine.cart.addItem(1);
    await flush();
    await engine.cart.settled();
    expect(engine.getState().cart.coupons).toEqual(['SAVE10']);
    expect(refused).toEqual(['NOPE']);
  });

  it('never lets an older response overwrite a newer one', async () => {
    const api = fakeApi({ delays: [40, 5], ignoreAbort: true });
    const { engine } = makeEngine({ fetch: api.fetch });
    await engine.start();
    void engine.cart.addItem(1);
    await flush();
    void engine.cart.addItem(9);
    await wait(60);
    expect(engine.getState().cart.summary?.subtotal).toBe('58.00');
  });
  it('does not bring a summary back when the cart is emptied mid-request', async () => {
    const api = fakeApi({ delays: [20] });
    const { engine } = makeEngine({ fetch: api.fetch });
    await engine.start();
    void engine.cart.setGroup('toggle:9', toggle(9));
    await flush();
    void engine.cart.setGroup('toggle:9', null, { dismiss: true });
    await wait(40);
    expect(engine.getState().cart.summary).toBeUndefined();
    expect(engine.getState().cart.calculating).toBe(false);
  });
  it('shows calculating in state, and keeps cart.updated for changes the shopper made', async () => {
    const { engine } = makeEngine();
    await engine.start();
    const updated: boolean[] = [];
    engine.on('cart.updated', (e) => updated.push(e.data.cart.calculating));
    const pending = engine.cart.addItem(1);
    expect(engine.getState().cart.calculating).toBe(true);
    await pending;
    expect(engine.getState().cart.calculating).toBe(false);
    expect(updated).toEqual([true]);
  });
  it('swaps one group without touching another', async () => {
    const { engine } = makeEngine();
    await engine.start();
    await engine.cart.setGroup('bundle:main', toggle(1));
    await engine.cart.setGroup('toggle:9', toggle(9));
    await engine.cart.setGroup('bundle:main', toggle(2));
    expect(engine.cart.lines()).toEqual([
      { package_id: 2, quantity: 1 },
      { package_id: 9, quantity: 1 },
    ]);
  });
  it('remembers a group the shopper switched off', async () => {
    const { engine } = makeEngine();
    await engine.cart.setGroup('toggle:9', toggle(9));
    await engine.cart.setGroup('toggle:9', null, { dismiss: true });
    expect(engine.getState().cart.dismissed).toEqual(['toggle:9']);
  });
  it('removes package ids the campaign does not have', async () => {
    const { engine } = makeEngine();
    const errors: unknown[] = [];
    engine.on('error', (e) => errors.push(e.data));
    void engine.cart.setGroup('items', {
      lines: [
        { packageId: 1, quantity: 1 },
        { packageId: 404, quantity: 1 },
      ],
      vouchers: [],
    });
    await engine.start();
    await flush();
    expect(engine.cart.lines()).toEqual([{ package_id: 1, quantity: 1 }]);
    expect(errors).toHaveLength(1);
  });
  it('announces shipping and selection changes with their data', async () => {
    const { engine } = makeEngine();
    const seen: unknown[] = [];
    engine.on('shipping.changed', (e) => seen.push(e.data));
    engine.on('selection.changed', (e) => seen.push(e.data));
    await engine.cart.setShipping(2);
    await engine.cart.setShipping(2);
    void engine.selectors.register(
      'main',
      [{ id: 'two', lines: [{ packageId: 2, quantity: 1 }], vouchers: [] }],
      'select',
    );
    expect(seen).toEqual([
      { methodId: 2 },
      { selectorId: 'main', cardId: 'two', items: [{ packageId: 2, quantity: 1 }] },
    ]);
  });
  it('keeps working in memory when every storage is blocked', async () => {
    const { engine } = makeEngine({ local: new MemoryStorage('always'), session: new MemoryStorage('always') });
    await engine.start();
    await engine.cart.addItem(1);
    expect(engine.getState().cart.summary?.total).toBe('49.00');
  });
  it('keeps the HTTP status when an error body is not JSON', async () => {
    const failing = (async () => new Response('<html>Bad Gateway</html>', { status: 502 })) as typeof fetch;
    const { engine } = makeEngine({ fetch: failing });
    const errors: Array<{ message: string }> = [];
    engine.on('error', (e) => errors.push(e.data as { message: string }));
    await engine.start();
    await engine.cart.addItem(1);
    expect(errors[0]!.message).toContain('502');
    expect(engine.getState().cart.calculating).toBe(false);
  });

  it('keeps lines with different properties or an upsell flag apart, and sends them', async () => {
    const { engine, api } = makeEngine();
    await engine.start();
    await engine.cart.setGroups({
      a: { lines: [{ packageId: 1, quantity: 1, properties: { engraving: 'Ann' } }], vouchers: [] },
      b: { lines: [{ packageId: 1, quantity: 1, properties: { engraving: 'Bob' } }], vouchers: [] },
      c: {
        lines: [
          { packageId: 9, quantity: 1, isUpsell: true },
          { packageId: 1, quantity: 2, properties: { engraving: 'Ann' } },
        ],
        vouchers: [],
      },
    });
    expect(api.calls.at(-1)!.body.lines).toEqual([
      { package_id: 1, quantity: 3, properties: { engraving: 'Ann' } },
      { package_id: 1, quantity: 1, properties: { engraving: 'Bob' } },
      { package_id: 9, quantity: 1, is_upsell: true },
    ]);
  });
  it('sets a package to the total the shopper sees, wherever its lines live', async () => {
    const { engine } = makeEngine();
    await engine.start();
    await engine.cart.setGroup('bundle:main', { lines: [{ packageId: 1, quantity: 2 }], vouchers: [] });
    await engine.cart.addItem(1, 1);
    await engine.cart.setQuantity(1, 4);
    expect(engine.cart.lines()).toEqual([{ package_id: 1, quantity: 4 }]);
    await engine.cart.setQuantity(1, 1);
    expect(engine.cart.lines()).toEqual([{ package_id: 1, quantity: 1 }]);
    expect(Object.keys(engine.getState().cart.groups)).toEqual(['bundle:main']);
    await engine.cart.removeItem(1);
    expect(engine.cart.lines()).toEqual([]);
  });

  it('leaves no totals behind after a paid order', async () => {
    const { engine } = makeEngine();
    await engine.start();
    await engine.cart.addItem(1);
    await engine.cart.setShipping(2);
    engine.cart.clearAfterOrder();
    expect(engine.getState().cart).toMatchObject({ summary: undefined, shippingId: undefined, groups: {} });
  });
});
