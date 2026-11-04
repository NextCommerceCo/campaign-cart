import { describe, expect, it, vi } from 'vitest';
import { fakeApi } from '../../fixtures/api';
import { flush, makeEngine, wait } from '../../fixtures/engine';
import { MemoryStorage } from '../../fixtures/storage';
import type { EventMap } from '../../../src/engine/events';

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
    engine.on('coupon.denied', (e) => refused.push(e.data.code));
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
    engine.on('coupon.denied', (e) => refused.push(e.data.code));
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
    engine.on('cart.updated', () => updated.push(engine.getState().cart.calculating));
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
  it('removes package ids the campaign does not have, with a warning rather than an error', async () => {
    const { engine } = makeEngine();
    const errors: unknown[] = [];
    engine.on('sdk.error', (e) => errors.push(e.data));
    const warn = vi.spyOn(engine.log, 'warn').mockImplementation(() => {});
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
    expect(errors).toEqual([]);
    expect(warn).toHaveBeenCalledWith('removed package ids the campaign does not have: 404');
  });
  it('announces shipping and selection changes with their data', async () => {
    const { engine } = makeEngine();
    const seen: unknown[] = [];
    engine.on('shipping.selected', (e) => seen.push(e.data));
    engine.on('selector.selected', (e) => seen.push(e.data));
    await engine.cart.setShipping(2);
    await engine.cart.setShipping(2);
    void engine.selectors.register(
      'main',
      [{ id: 'two', lines: [{ packageId: 2, quantity: 1 }], vouchers: [] }],
      'select',
    );
    expect(seen).toEqual([
      { method_id: 2 },
      {
        selector_id: 'main',
        type: 'bundle',
        option_id: 'two',
        lines: [{ package_id: 2, quantity: 1 }],
      },
    ]);
  });
  it('announces one price run per burst of changes, and the net change once the cart is priced', async () => {
    const { engine } = makeEngine();
    await engine.start();
    const seen: unknown[] = [];
    engine.on('*', (e) => {
      if (e.name === 'cart.calculating' || e.name === 'cart.calculated') seen.push(e.name);
      if (e.name === 'cart.added' || e.name === 'cart.removed') seen.push([e.name, e.data]);
    });
    void engine.cart.addItem(1);
    void engine.cart.addItem(1);
    await engine.cart.setQuantity(1, 1);
    await engine.cart.settled();
    const change = { package_id: 1, product_id: 400, quantity: 1, price: 49 };
    expect(seen).toEqual([
      'cart.calculating',
      [
        'cart.added',
        expect.objectContaining({
          lines: [expect.objectContaining({ package_id: 1, product_id: 400, quantity: 1, price: 49, total: 49 })],
          currency: 'USD',
          subtotal: 49,
          total: 49,
          changes: [change],
        }),
      ],
      'cart.calculated',
    ]);
    seen.length = 0;
    void engine.cart.addItem(2);
    await engine.cart.removeItem(2);
    await engine.cart.settled();
    expect(seen.filter((e) => typeof e !== 'string')).toEqual([]);
    seen.length = 0;
    await engine.cart.clear();
    expect(seen).toEqual([['cart.removed', { lines: [], coupons: [], currency: 'USD', changes: [change] }]]);
  });

  it('announces an addition at the package price when pricing fails', async () => {
    const api = fakeApi();
    const fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
      String(input).includes('/carts/calculate')
        ? Promise.resolve(new Response('{}', { status: 502 }))
        : api.fetch(input, init)) as typeof globalThis.fetch;
    const { engine } = makeEngine({ fetch });
    vi.spyOn(engine.log, 'info').mockImplementation(() => {});
    await engine.start();
    const added: unknown[] = [];
    engine.on('cart.added', (e) => added.push(e.data));
    await engine.cart.addItem(1);
    await engine.cart.settled();
    expect(added).toEqual([
      {
        lines: [{ package_id: 1, quantity: 1, product_id: 400, image: 'https://cdn.test/1.png' }],
        coupons: [],
        currency: 'USD',
        changes: [{ package_id: 1, product_id: 400, quantity: 1, price: 49 }],
      },
    ]);
  });

  it('prices each line in numbers, and tells a coupon the shopper entered from a bundle card’s own code', async () => {
    const { engine } = makeEngine();
    await engine.start();
    const carts: Array<EventMap['cart.calculated']> = [];
    engine.on('cart.calculated', (e) => carts.push(e.data));
    await engine.cart.setGroup('bundle:main', { lines: [{ packageId: 1, quantity: 1 }], vouchers: ['SAVE10'] });
    await engine.cart.settled();
    expect(carts.at(-1)!.discounts).toEqual([{ name: 'SAVE10', amount: 1, source: 'offer', offer_id: 10 }]);
    await engine.cart.setGroup('bundle:main', { lines: [{ packageId: 1, quantity: 1 }], vouchers: [] });
    await engine.cart.applyCoupon('save10');
    await engine.cart.settled();
    const cart = carts.at(-1)!;
    expect(cart.discounts).toEqual([{ name: 'SAVE10', amount: 1, source: 'coupon', code: 'SAVE10', offer_id: 10 }]);
    expect(cart.lines[0]).toMatchObject({ price: 49, original_price: 99, total: 49, total_discount: 0 });
    expect(cart.shipping_method).toEqual({
      id: 1,
      code: 'standard',
      name: 'Standard',
      price: 0,
      original_price: 0,
      discounts: [],
    });
    expect(cart).toMatchObject({ coupons: ['SAVE10'], currency: 'USD', subtotal: 49, total: 39 });
  });

  it('announces a coupon applied, removed or denied', async () => {
    const { engine } = makeEngine();
    await engine.start();
    await engine.cart.addItem(1);
    const seen: string[] = [];
    engine.on('*', (e) => e.name.startsWith('coupon.') && seen.push(`${e.name} ${(e.data as { code: string }).code}`));
    await engine.cart.applyCoupon('nope');
    await engine.cart.applyCoupon('save10');
    await engine.cart.removeCoupon('save10');
    await engine.cart.removeCoupon('save10');
    expect(seen).toEqual(['coupon.denied NOPE', 'coupon.applied SAVE10', 'coupon.removed SAVE10']);
  });

  it('announces a toggle switched on and off, but not a change of its quantity', async () => {
    const { engine } = makeEngine();
    await engine.start();
    const seen: string[] = [];
    engine.on('*', (e) => e.name.startsWith('selector.') && seen.push(`${e.name} ${JSON.stringify(e.data)}`));
    await engine.cart.setGroup('toggle:9', { lines: [{ packageId: 9, quantity: 1 }], vouchers: [] });
    await engine.cart.setGroup('toggle:9', { lines: [{ packageId: 9, quantity: 2 }], vouchers: [] });
    await engine.cart.setGroup('toggle:9', null);
    expect(seen).toEqual([
      'selector.selected {"selector_id":"toggle:9","type":"toggle","lines":[{"package_id":9,"quantity":1,"product_id":900,"image":"https://cdn.test/9.png"}]}',
      'selector.deselected {"selector_id":"toggle:9","type":"toggle","lines":[]}',
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
    engine.on('sdk.error', (e) => errors.push(e.data as { message: string }));
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
