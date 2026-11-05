import { describe, expect, it, vi } from 'vitest';
import { fakeApi } from '../../fixtures/api';
import { flush, makeEngine, wait } from '../../fixtures/engine';
import { operations } from '../../../src/engine/cart/cart';
import { publicCart } from '../../../src/engine/cart/public';
import { MemoryStorage } from '../../fixtures/storage';
import type { EventMap } from '../../../src/engine/events/bus';
import type { Selector } from '../../../src/engine/events/selectors';
import { campaign } from '../../fixtures/campaign';

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

  it('holds a code entered on an empty cart off the cart until its first price, and resolves applyCoupon once that decides it', async () => {
    const { engine } = makeEngine();
    await engine.start();
    const seen: unknown[] = [];
    engine.on('*', (e) => e.name.startsWith('coupon.') && seen.push([e.name, e.data]));
    const results: Record<string, boolean> = {};
    const nope = engine.cart.applyCoupon('nope').then((r) => (results.NOPE = r));
    const save = engine.cart.applyCoupon('save10').then((r) => (results.SAVE10 = r));
    expect(await engine.cart.applyCoupon('Save10')).toBe(false);
    await flush();
    expect(engine.getState().cart.coupons).toEqual([]);
    expect(results).toEqual({});
    expect(seen).toEqual([['coupon.denied', { code: 'SAVE10', reason: 'duplicate' }]]);
    seen.length = 0;
    await engine.cart.addItem(1);
    await Promise.all([nope, save]);
    expect(results).toEqual({ NOPE: false, SAVE10: true });
    expect(engine.getState().cart.coupons).toEqual(['SAVE10']);
    expect(seen).toEqual([
      ['coupon.denied', { code: 'NOPE', reason: 'no_discount' }],
      [
        'coupon.applied',
        {
          code: 'SAVE10',
          amount: 1,
          discounts: [{ name: 'SAVE10', amount: 1, source: 'coupon', code: 'SAVE10', offer_id: 10 }],
        },
      ],
    ]);
  });

  it('holds a code entered before the campaign loads until the cart is priced', async () => {
    let load!: (c: typeof campaign) => void;
    const { engine } = makeEngine({ campaign: new Promise((r) => (load = r)) });
    const starting = engine.start();
    void engine.cart.addItem(1);
    let applied: boolean | undefined;
    const applying = engine.cart.applyCoupon('save10').then((r) => (applied = r));
    await flush();
    expect(applied).toBeUndefined();
    expect(engine.getState().cart.coupons).toEqual([]);
    load(campaign);
    await starting;
    await applying;
    expect(applied).toBe(true);
    expect(engine.getState().cart.coupons).toEqual(['SAVE10']);
  });

  it('records the cart action behind each change on its payload, and a listener’s change comes after the change it heard', async () => {
    const { engine } = makeEngine();
    await engine.start();
    const seen: Array<[string, unknown]> = [];
    engine.on('*', (e) => {
      if (e.name === 'cart.added' || e.name === 'cart.removed')
        seen.push([e.name, operations.get((e.data as EventMap['cart.added']).changes)]);
    });
    await engine.cart.addItem(1);
    await engine.cart.setQuantity(1, 3);
    await engine.cart.removeItem(1);
    await engine.cart.setGroup('bundle:main', toggle(2));
    await engine.cart.setGroups({ items: toggle(3) });
    await engine.cart.clear();
    const off = engine.on('cart.updated', () => {
      off();
      void engine.cart.setGroup('toggle:9', toggle(9));
    });
    await engine.cart.addItem(1);
    expect(seen).toEqual([
      ['cart.added', { action: 'addItem', group: 'items' }],
      ['cart.added', { action: 'setQuantity' }],
      ['cart.removed', { action: 'removeItem' }],
      ['cart.added', { action: 'setGroup', group: 'bundle:main' }],
      ['cart.removed', { action: 'setGroups' }],
      ['cart.added', { action: 'setGroups' }],
      ['cart.removed', { action: 'clear' }],
      ['cart.added', { action: 'addItem', group: 'items' }],
      ['cart.added', { action: 'setGroup', group: 'toggle:9' }],
    ]);
  });

  it('keeps a held code in this tab, and checks and announces it at the first price on the next page', async () => {
    const session = new MemoryStorage();
    const first = makeEngine({ session }).engine;
    await first.start();
    void first.cart.applyCoupon('nope');
    void first.cart.applyCoupon('save10');
    await flush();
    const { engine, api } = makeEngine({ session });
    expect(engine.getState().cart).toMatchObject({ coupons: [], held: ['NOPE', 'SAVE10'] });
    await engine.start();
    const seen: unknown[] = [];
    engine.on('*', (e) => e.name.startsWith('coupon.') && seen.push([e.name, (e.data as { code: string }).code]));
    const again = engine.cart.applyCoupon('save10');
    await engine.cart.addItem(1);
    await flush();
    await engine.cart.settled();
    expect(await again).toBe(false);
    expect(api.calls[0]!.body.vouchers).toEqual([]);
    expect(seen).toEqual([
      ['coupon.denied', 'SAVE10'],
      ['coupon.denied', 'NOPE'],
      ['coupon.applied', 'SAVE10'],
    ]);
    expect(engine.getState().cart).toMatchObject({ coupons: ['SAVE10'], held: [] });
    expect(makeEngine({ session }).engine.getState().cart).toMatchObject({ coupons: ['SAVE10'], held: [] });
  });

  it('drops held codes when the cart is cleared: applyCoupon answers false, with no coupon event', async () => {
    const { engine, api } = makeEngine();
    await engine.start();
    const seen: string[] = [];
    engine.on('*', (e) => e.name.startsWith('coupon.') && seen.push(e.name));
    let applied: boolean | undefined;
    void engine.cart.applyCoupon('save10').then((r) => (applied = r));
    await engine.cart.clear();
    await flush();
    expect(applied).toBe(false);
    expect(engine.getState().cart.held).toEqual([]);
    await engine.cart.addItem(1);
    await flush();
    expect(engine.getState().cart.coupons).toEqual([]);
    expect(api.calls.filter((c) => c.body.vouchers.includes('SAVE10'))).toEqual([]);
    expect(seen).toEqual([]);
  });

  it('drops a held code being checked when the cart is cleared', async () => {
    const api = fakeApi({ delays: [0, 20] });
    const { engine } = makeEngine({ fetch: api.fetch });
    await engine.start();
    const seen: string[] = [];
    engine.on('*', (e) => e.name.startsWith('coupon.') && seen.push(e.name));
    let applied: boolean | undefined;
    void engine.cart.applyCoupon('save10').then((r) => (applied = r));
    await engine.cart.addItem(1);
    await flush();
    expect(api.calls.at(-1)!.body.vouchers).toEqual(['SAVE10']);
    await engine.cart.clear();
    await wait(40);
    expect(applied).toBe(false);
    expect(engine.getState().cart).toMatchObject({ coupons: [], held: [] });
    expect(seen).toEqual([]);
  });

  it('cancels a code whose check is in flight when the shopper removes it or clears the cart', async () => {
    const api = fakeApi();
    const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(init?.body ?? '').includes('SAVE10')) await wait(20);
      return api.fetch(input, init);
    }) as typeof globalThis.fetch;
    const { engine } = makeEngine({ fetch });
    await engine.start();
    await engine.cart.addItem(1);
    const seen: string[] = [];
    engine.on('*', (e) => e.name.startsWith('coupon.') && seen.push(e.name));
    const removed = engine.cart.applyCoupon('save10');
    await flush();
    await engine.cart.removeCoupon('save10');
    const cleared = engine.cart.applyCoupon('save10');
    await flush();
    await engine.cart.clear();
    expect(await removed).toBe(false);
    expect(await cleared).toBe(false);
    expect(engine.getState().cart.coupons).toEqual([]);
    expect(seen).toEqual([]);
  });

  it('cancels a held code on removeCoupon: applyCoupon answers false, with no coupon event', async () => {
    const { engine, api } = makeEngine();
    await engine.start();
    const seen: string[] = [];
    engine.on('*', (e) => e.name.startsWith('coupon.') && seen.push(e.name));
    let applied: boolean | undefined;
    void engine.cart.applyCoupon('save10').then((r) => (applied = r));
    await engine.cart.removeCoupon(' Save10 ');
    await flush();
    expect(applied).toBe(false);
    expect(engine.getState().cart.held).toEqual([]);
    await engine.cart.addItem(1);
    await flush();
    expect(engine.getState().cart.coupons).toEqual([]);
    expect(api.calls.filter((c) => c.body.vouchers.includes('SAVE10'))).toEqual([]);
    expect(seen).toEqual([]);
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
  it('shows calculating in state while a saved cart is priced on the next page', async () => {
    const session = new MemoryStorage();
    const first = makeEngine({ session }).engine;
    await first.start();
    await first.cart.addItem(2);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const api = fakeApi();
    let requests = 0;
    const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      requests++;
      await gate;
      return api.fetch(input, init);
    }) as typeof globalThis.fetch;
    const { engine } = makeEngine({ session, fetch });
    const calculating: boolean[] = [];
    engine.on('cart.calculating', () => calculating.push(engine.getState().cart.calculating));
    await engine.start();
    await flush();
    expect(requests).toBe(1);
    expect(calculating).toEqual([true]);
    expect(engine.getState().cart.calculating).toBe(true);
    release();
    await engine.cart.settled();
    expect(engine.getState().cart.calculating).toBe(false);
    expect(engine.getState().cart.summary?.total).toBe('89.00');
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
  it('announces a shipping method with what is known when the cart cannot be priced', async () => {
    const { engine } = makeEngine();
    const seen: unknown[] = [];
    engine.on('shipping.selected', (e) => seen.push(e.data));
    await engine.cart.setShipping(2);
    await engine.cart.setShipping(2);
    expect(seen).toEqual([{ id: 2 }]);
    await engine.start();
    await engine.cart.setShipping(1);
    expect(seen).toEqual([{ id: 2 }, { id: 1, code: 'standard' }]);
  });

  it('announces a shipping method right after its cart.updated, without prices, and settles it once the cart is priced', async () => {
    const { engine } = makeEngine();
    await engine.start();
    await engine.cart.addItem(1);
    const seen: unknown[] = [];
    engine.on('*', (e) => {
      if (e.name.startsWith('shipping.')) seen.push([e.name, e.data]);
      else if (e.name.startsWith('cart.')) seen.push(e.name);
    });
    await engine.cart.setShipping(1);
    const priced = { id: 1, code: 'standard', name: 'Standard', price: 0, original_price: 0, discounts: [] };
    expect(seen).toEqual([
      'cart.updated',
      ['shipping.selected', { id: 1, code: 'standard' }],
      'cart.calculating',
      'cart.calculated',
      ['shipping.settled', priced],
    ]);
  });

  it('announces one price run per burst of changes, and each change right after its cart.updated', async () => {
    const { engine } = makeEngine();
    await engine.start();
    const seen: unknown[] = [];
    engine.on('*', (e) => {
      if (e.name === 'cart.added' || e.name === 'cart.removed')
        seen.push([e.name, (e.data as EventMap['cart.added']).changes]);
      else if (e.name.startsWith('cart.')) seen.push(e.name);
    });
    void engine.cart.addItem(1);
    void engine.cart.addItem(1);
    await engine.cart.setQuantity(1, 1);
    await engine.cart.settled();
    const earbuds = { package_id: 1, product_id: 400, quantity: 1 };
    expect(seen).toEqual([
      'cart.updated',
      ['cart.added', [{ ...earbuds, from: 0, to: 1 }]],
      'cart.updated',
      ['cart.added', [{ ...earbuds, from: 1, to: 2 }]],
      'cart.updated',
      ['cart.removed', [{ ...earbuds, from: 2, to: 1 }]],
      'cart.calculating',
      'cart.calculated',
    ]);
    seen.length = 0;
    await engine.cart.setGroups({ bundle: { lines: [{ packageId: 2, quantity: 2 }], vouchers: [] } });
    expect(seen.slice(0, 3)).toEqual([
      'cart.updated',
      ['cart.removed', [{ ...earbuds, from: 1, to: 0, price: 49 }]],
      ['cart.added', [{ package_id: 2, product_id: 400, quantity: 2, from: 0, to: 2 }]],
    ]);
  });

  it('carries on cart.added the cart its cart.updated carried', async () => {
    const { engine } = makeEngine();
    await engine.start();
    const carts: unknown[] = [];
    engine.on('cart.updated', (e) => carts.push(e.data));
    engine.on('cart.added', (e) => carts.push(e.data));
    await engine.cart.addItem(9, 2);
    const changes = [{ package_id: 9, product_id: 900, quantity: 2, from: 0, to: 2 }];
    expect(carts).toEqual([carts[0], { ...(carts[0] as object), changes }]);
  });

  it('prices a change only at what the server already charged for that package', async () => {
    const { engine } = makeEngine();
    await engine.start();
    const changes: unknown[] = [];
    engine.on('cart.added', (e) => changes.push(...e.data.changes));
    engine.on('cart.removed', (e) => changes.push(...e.data.changes));
    await engine.cart.addItem(1);
    await engine.cart.addItem(1);
    await engine.cart.addItem(9);
    await engine.cart.clear();
    expect(changes).toEqual([
      { package_id: 1, product_id: 400, quantity: 1, from: 0, to: 1 },
      { package_id: 1, product_id: 400, quantity: 1, from: 1, to: 2, price: 49 },
      { package_id: 9, product_id: 900, quantity: 1, from: 0, to: 1 },
      { package_id: 1, product_id: 400, quantity: 2, from: 2, to: 0, price: 49 },
      { package_id: 9, product_id: 900, quantity: 1, from: 1, to: 0, price: 9 },
    ]);
  });

  it('checks a coupon against a fresh price when the last pricing failed', async () => {
    const api = fakeApi();
    let failing = false;
    const fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
      failing && String(input).includes('/carts/calculate')
        ? Promise.resolve(new Response('{}', { status: 502 }))
        : api.fetch(input, init)) as typeof globalThis.fetch;
    const { engine } = makeEngine({ fetch });
    vi.spyOn(engine.log, 'info').mockImplementation(() => {});
    await engine.start();
    await engine.cart.addItem(1);
    await engine.cart.addItem(2);
    await engine.cart.settled();
    failing = true;
    await engine.cart.removeItem(2);
    await engine.cart.settled();
    failing = false;
    expect(await engine.cart.applyCoupon('NOPE')).toBe(false);
  });

  it('gives a line whose quantity changed no price until the cart is priced again', async () => {
    const api = fakeApi();
    let failing = false;
    const fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
      failing && String(input).includes('/carts/calculate')
        ? Promise.resolve(new Response('{}', { status: 502 }))
        : api.fetch(input, init)) as typeof globalThis.fetch;
    const { engine } = makeEngine({ fetch });
    vi.spyOn(engine.log, 'info').mockImplementation(() => {});
    await engine.start();
    await engine.cart.addItem(1);
    await engine.cart.settled();
    expect(engine.cart.currentCheckout().cart.lines[0]).toHaveProperty('price');
    failing = true;
    await engine.cart.setQuantity(1, 2);
    await engine.cart.settled();
    expect(engine.cart.currentCheckout().cart.lines[0]).toMatchObject({ package_id: 1, quantity: 2 });
    expect(engine.cart.currentCheckout().cart.lines[0]).not.toHaveProperty('price');
  });

  it('announces an addition before pricing, and never at the campaign’s package price when pricing fails', async () => {
    const api = fakeApi();
    const fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
      String(input).includes('/carts/calculate')
        ? Promise.resolve(new Response('{}', { status: 502 }))
        : api.fetch(input, init)) as typeof globalThis.fetch;
    const { engine } = makeEngine({ fetch });
    vi.spyOn(engine.log, 'info').mockImplementation(() => {});
    await engine.start();
    const seen: unknown[] = [];
    engine.on('cart.added', (e) => seen.push(e.data));
    engine.on('sdk.error', (e) => seen.push(e.name));
    await engine.cart.addItem(1);
    await engine.cart.settled();
    expect(seen).toEqual([
      {
        lines: [
          { package_id: 1, quantity: 1, product_id: 400, product_title: 'Earbuds ×1', image: 'https://cdn.test/1.png' },
        ],
        coupons: [],
        currency: 'USD',
        changes: [{ package_id: 1, product_id: 400, quantity: 1, from: 0, to: 1 }],
      },
      'sdk.error',
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

  it('announces a coupon applied, removed or denied, and why', async () => {
    const { engine } = makeEngine();
    await engine.start();
    await engine.cart.addItem(1);
    const seen: unknown[] = [];
    engine.on('*', (e) => e.name.startsWith('coupon.') && seen.push([e.name, e.data]));
    expect(await engine.cart.applyCoupon('nope')).toBe(false);
    expect(await engine.cart.applyCoupon('save10')).toBe(true);
    expect(await engine.cart.applyCoupon('save10')).toBe(false);
    await engine.cart.removeCoupon('save10');
    await engine.cart.removeCoupon('save10');
    expect(seen).toEqual([
      ['coupon.denied', { code: 'NOPE', reason: 'no_discount' }],
      [
        'coupon.applied',
        {
          code: 'SAVE10',
          amount: 1,
          discounts: [{ name: 'SAVE10', amount: 1, source: 'coupon', code: 'SAVE10', offer_id: 10 }],
        },
      ],
      ['coupon.denied', { code: 'SAVE10', reason: 'duplicate' }],
      ['coupon.removed', { code: 'SAVE10', reason: 'shopper' }],
    ]);
  });

  it('denies a code it cannot check, with the error, and reports the failed check', async () => {
    const api = fakeApi();
    const fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
      String(init?.body ?? '').includes('SAVE10')
        ? Promise.resolve(new Response('{}', { status: 502 }))
        : api.fetch(input, init)) as typeof globalThis.fetch;
    const { engine } = makeEngine({ fetch });
    vi.spyOn(engine.log, 'info').mockImplementation(() => {});
    await engine.start();
    await engine.cart.addItem(1);
    const seen: unknown[] = [];
    engine.on('*', (e) => (e.name === 'sdk.error' || e.name.startsWith('coupon.')) && seen.push([e.name, e.data]));
    expect(await engine.cart.applyCoupon('save10')).toBe(false);
    const [error, denied] = seen as Array<[string, { message: string }]>;
    expect(error).toEqual(['sdk.error', expect.objectContaining({ action: 'coupon.check', status: 502 })]);
    expect(denied).toEqual(['coupon.denied', { code: 'SAVE10', reason: 'check_failed', message: error![1].message }]);
    expect(engine.getState().cart.coupons).toEqual([]);
  });

  it('takes every code off with reason cleared when the cart is cleared', async () => {
    const { engine } = makeEngine();
    await engine.start();
    await engine.cart.addItem(1);
    await engine.cart.applyCoupon('save10');
    const seen: unknown[] = [];
    engine.on('*', (e) => (e.name === 'cart.updated' || e.name.startsWith('coupon.')) && seen.push([e.name, e.data]));
    await engine.cart.clear();
    expect(seen).toEqual([
      ['cart.updated', { lines: [], coupons: [], currency: 'USD' }],
      ['coupon.removed', { code: 'SAVE10', reason: 'cleared' }],
    ]);
  });

  it('sends one change’s events as one block before any listener runs, from a listener too', async () => {
    const { engine } = makeEngine();
    await engine.start();
    await engine.cart.addItem(1);
    await engine.cart.setShipping(1);
    const seen: string[] = [];
    engine.on(
      '*',
      (e) => /^(cart\.(updated|added|removed)|selector|shipping\.selected|coupon)/.test(e.name) && seen.push(e.name),
    );
    const onNextUpdate = (fn: () => void) => {
      const off = engine.on('cart.updated', () => {
        off();
        fn();
      });
    };

    onNextUpdate(() => void engine.cart.setGroup('toggle:9', toggle(9)));
    await engine.cart.setShipping(2);
    await engine.cart.settled();
    expect(seen.splice(0)).toEqual([
      'cart.updated',
      'shipping.selected',
      'selector.selected',
      'cart.updated',
      'cart.added',
    ]);

    onNextUpdate(() => void engine.cart.setGroup('toggle:9', null));
    await engine.cart.applyCoupon('save10');
    onNextUpdate(() => void engine.cart.setGroup('toggle:9', toggle(9)));
    await engine.cart.removeCoupon('save10');
    await engine.cart.settled();
    expect(seen).toEqual([
      ...['cart.updated', 'coupon.applied', 'selector.deselected', 'cart.updated', 'cart.removed'],
      ...['cart.updated', 'coupon.removed', 'selector.selected', 'cart.updated', 'cart.added'],
    ]);
  });

  it('takes no coupon change while the cart is frozen for an order, and takes them again once it thaws', async () => {
    const { engine, api } = makeEngine();
    await engine.start();
    await engine.cart.addItem(1);
    const seen: string[] = [];
    engine.on('*', (e) => e.name.startsWith('coupon.') && seen.push(`${e.name} ${(e.data as { code: string }).code}`));
    const requests = api.calls.length;
    engine.cart.freeze(true);
    expect(await engine.cart.applyCoupon('save10')).toBe(false);
    expect(await engine.cart.applyCoupon('nope')).toBe(false);
    expect(api.calls).toHaveLength(requests);
    engine.cart.freeze(false);
    const checking = engine.cart.applyCoupon('save10');
    engine.cart.freeze(true);
    expect(await checking).toBe(false);
    expect(engine.getState().cart.coupons).toEqual([]);
    engine.cart.freeze(false);
    expect(await engine.cart.applyCoupon('save10')).toBe(true);
    engine.cart.freeze(true);
    await engine.cart.removeCoupon('save10');
    expect(engine.getState().cart.coupons).toEqual(['SAVE10']);
    expect(seen).toEqual(['coupon.applied SAVE10']);
    engine.cart.freeze(false);
    await engine.cart.removeCoupon('save10');
    expect(engine.getState().cart.coupons).toEqual([]);
    expect(seen).toEqual(['coupon.applied SAVE10', 'coupon.removed SAVE10']);
  });

  it('announces no shipping or toggle change while the cart is frozen', async () => {
    const { engine } = makeEngine();
    await engine.start();
    await engine.cart.setShipping(1);
    const seen: string[] = [];
    engine.on('*', (e) => ['shipping.selected', 'selector.selected'].includes(e.name) && seen.push(e.name));
    engine.cart.freeze(true);
    await engine.cart.setShipping(2);
    await engine.cart.addItem(9, 1, 'toggle:9');
    expect(seen).toEqual([]);
    expect(engine.getState().cart).toMatchObject({ shippingId: 1, groups: {} });
    engine.cart.freeze(false);
    await engine.cart.setShipping(2);
    await engine.cart.addItem(9, 1, 'toggle:9');
    expect(seen).toEqual(['shipping.selected', 'selector.selected']);
  });

  it('keeps holding a code entered on an empty cart while the cart is frozen, and checks it at the next price', async () => {
    const { engine } = makeEngine();
    await engine.start();
    const refused: string[] = [];
    engine.on('coupon.denied', (e) => refused.push(e.data.code));
    let applied: boolean | undefined;
    const applying = engine.cart.applyCoupon('nope').then((r) => (applied = r));
    const adding = engine.cart.addItem(1);
    engine.cart.freeze(true);
    await adding;
    await engine.cart.removeCoupon('nope');
    await engine.cart.clear();
    await flush();
    expect(refused).toEqual([]);
    expect(applied).toBeUndefined();
    expect(engine.getState().cart).toMatchObject({ coupons: [], held: ['NOPE'] });
    engine.cart.freeze(false);
    await engine.cart.addItem(1);
    await applying;
    expect(refused).toEqual(['NOPE']);
    expect(applied).toBe(false);
    expect(engine.getState().cart.coupons).toEqual([]);
  });

  it('announces a toggle switched on and off, but not a change of its quantity', async () => {
    const { engine } = makeEngine();
    await engine.start();
    const seen: string[] = [];
    engine.on('*', (e) => e.name.startsWith('selector.') && seen.push(`${e.name} ${JSON.stringify(e.data)}`));
    await engine.cart.setGroup('toggle:9', { lines: [{ packageId: 9, quantity: 1 }], vouchers: [] });
    await engine.cart.setGroup('toggle:9', { lines: [{ packageId: 9, quantity: 2 }], vouchers: [] });
    await engine.cart.setGroup('toggle:9', null);
    const line = (quantity: number) =>
      `[{"package_id":9,"quantity":${quantity},"product_id":900,"product_title":"Protection plan","image":"https://cdn.test/9.png"}]`;
    expect(seen).toEqual([
      `selector.selected {"selector_id":"toggle:9","type":"toggle","lines":${line(1)},"currency":"USD"}`,
      `selector.deselected {"selector_id":"toggle:9","type":"toggle","lines":${line(2)},"currency":"USD"}`,
    ]);
  });

  it('announces a toggle leaving the cart by any path, and entering it by any group write', async () => {
    const { engine } = makeEngine();
    await engine.start();
    const seen: string[] = [];
    engine.on('*', (e) => e.name.startsWith('selector.') && seen.push(`${e.name} ${(e.data as Selector).selector_id}`));
    const on = () => engine.cart.addItem(9, 1, 'toggle:9');
    await on();
    await engine.cart.removeItem(9);
    await on();
    await engine.cart.setQuantity(9, 0);
    await on();
    await engine.cart.clear();
    await engine.cart.setGroups({ 'toggle:9': toggle(9) });
    await engine.cart.setGroup('toggle:9', null);
    await engine.cart.setQuantity(9, 1);
    expect(seen).toEqual([...Array(4).fill(['selector.selected toggle:9', 'selector.deselected toggle:9']).flat()]);
    expect(engine.cart.lines()).toEqual([{ package_id: 9, quantity: 1 }]);
  });

  it('prices a toggle’s line while it is off with selector.calculating and selector.calculated, and carries the price on selector.selected', async () => {
    const { engine } = makeEngine();
    await engine.start();
    const seen: unknown[] = [];
    engine.on('*', (e) => e.name.startsWith('selector.') && seen.push([e.name, e.data]));
    engine.toggles.price(9, 2);
    engine.toggles.price(9, 2);
    await flush();
    const off = { selector_id: 'toggle:9', type: 'toggle', currency: 'USD' };
    const line = expect.objectContaining({ package_id: 9, quantity: 2 });
    expect(seen).toEqual([
      ['selector.calculating', { ...off, lines: [line] }],
      [
        'selector.calculated',
        { ...off, lines: [expect.objectContaining({ package_id: 9, quantity: 2, total: 18 })], total: 18 },
      ],
    ]);
    expect((seen[0] as [string, Selector])[1].lines[0]).not.toHaveProperty('price');
    expect(engine.getState().toggles[9]).toMatchObject({ quantity: 2, line: { package_id: 9, quantity: 2 } });
    seen.length = 0;
    await engine.cart.setGroup('toggle:9', { lines: [{ packageId: 9, quantity: 2 }], vouchers: [] });
    expect(seen).toEqual([
      [
        'selector.selected',
        {
          selector_id: 'toggle:9',
          type: 'toggle',
          lines: [expect.objectContaining({ package_id: 9, quantity: 2, price: 9, total: 18 })],
          currency: 'USD',
          total: 18,
        },
      ],
    ]);
  });

  it('reports a toggle it cannot price as sdk.error after its selector.calculating', async () => {
    const failing = (async () => new Response('{}', { status: 502 })) as typeof fetch;
    const { engine } = makeEngine({ fetch: failing, campaign: Promise.resolve(campaign) });
    vi.spyOn(engine.log, 'error').mockImplementation(() => {});
    await engine.start();
    const seen: string[] = [];
    engine.on('*', (e) => seen.push(e.name));
    engine.toggles.price(9, 1);
    await flush();
    expect(seen).toEqual(['selector.calculating', 'sdk.error']);
  });

  it('names the checkout, and its step from the second step of a multi-step checkout', () => {
    const { engine } = makeEngine();
    expect(engine.cart.currentCheckout()).toMatchObject({ id: '' });
    engine.attach((ctx) => ctx.update('checkout', { id: 'c1', step: 0 }));
    expect(engine.cart.currentCheckout()).toMatchObject({ id: 'c1' });
    expect(engine.cart.currentCheckout()).not.toHaveProperty('step');
    engine.attach((ctx) => ctx.update('checkout', { step: 2 }));
    expect(engine.cart.currentCheckout()).toMatchObject({ id: 'c1', step: 2 });
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

  it('gives no totals after a failed price, for new lines or a new coupon', async () => {
    const api = fakeApi();
    let failing = false;
    const fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
      failing && String(input).includes('/carts/calculate')
        ? Promise.resolve(new Response('{}', { status: 502 }))
        : api.fetch(input, init)) as typeof globalThis.fetch;
    const { engine } = makeEngine({ fetch });
    vi.spyOn(engine.log, 'info').mockImplementation(() => {});
    await engine.start();
    await engine.cart.addItem(1);
    expect(engine.snapshot().cart).toMatchObject({ total: 49 });
    failing = true;
    await engine.cart.addItem(2);
    await engine.cart.settled();
    const cart = engine.snapshot().cart;
    expect(cart.lines).toMatchObject([{ package_id: 1 }, { package_id: 2 }]);
    expect(cart.lines.map((l) => l.price)).toEqual([undefined, undefined]);
    expect(cart).not.toHaveProperty('total');
    expect(engine.cart.currentCheckout().cart).not.toHaveProperty('total');
    failing = false;
    await engine.cart.removeItem(2);
    engine.on('coupon.applied', () => (failing = true));
    expect(await engine.cart.applyCoupon('save10')).toBe(true);
    expect(engine.snapshot().cart).toMatchObject({ coupons: ['SAVE10'] });
    expect(engine.snapshot().cart).not.toHaveProperty('total');
    expect(engine.snapshot().cart.lines[0]).not.toHaveProperty('price');
  });

  it('prices lines and totals only from a price of exactly these lines', async () => {
    const { engine } = makeEngine();
    await engine.start();
    await engine.cart.addItem(1);
    const one = engine.getState().cart.summary;
    await engine.cart.addItem(2);
    const cart = publicCart(engine.getState(), one);
    expect(cart.lines.map((l) => l.price)).toEqual([undefined, undefined]);
    expect(cart).not.toHaveProperty('total');
    expect(cart).not.toHaveProperty('subtotal');
    expect(publicCart(engine.getState(), engine.getState().cart.summary)).toMatchObject({ subtotal: 138, total: 138 });
  });

  it('checks codes one at a time, so two codes that do not stack are not both applied', async () => {
    const api = fakeApi();
    const fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      const stacked = body?.vouchers?.some((v: string) => v === 'A' || v === 'B');
      return api.fetch(input, stacked ? { ...init, body: JSON.stringify({ ...body, vouchers: ['SAVE10'] }) } : init);
    }) as typeof globalThis.fetch;
    const { engine } = makeEngine({ fetch });
    await engine.start();
    await engine.cart.addItem(1);
    const denied: unknown[] = [];
    engine.on('coupon.denied', (e) => denied.push(e.data));
    expect(await Promise.all([engine.cart.applyCoupon('a'), engine.cart.applyCoupon('b')])).toEqual([true, false]);
    expect(engine.getState().cart.coupons).toEqual(['A']);
    expect(denied).toEqual([{ code: 'B', reason: 'no_discount' }]);
  });

  it('checks a code against the codes the cart had when its check began', async () => {
    const api = fakeApi();
    let failing = true;
    let hold: Promise<void> | undefined;
    let reached!: () => void;
    const arrived = new Promise<void>((r) => (reached = r));
    const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!String(input).includes('/carts/calculate')) return api.fetch(input, init);
      if (failing) return new Response('{}', { status: 502 });
      if (hold && !JSON.parse(String(init!.body)).vouchers.length) {
        reached();
        await hold;
      }
      return api.fetch(input, init);
    }) as typeof globalThis.fetch;
    const { engine } = makeEngine({ fetch });
    vi.spyOn(engine.log, 'info').mockImplementation(() => {});
    await engine.start();
    await engine.cart.addItem(1);
    failing = false;
    let release!: () => void;
    hold = new Promise((r) => (release = r));
    const applying = engine.cart.applyCoupon('nope');
    await arrived;
    hold = undefined;
    await engine.cart.setGroup('bundle:main', { lines: [{ packageId: 2, quantity: 1 }], vouchers: ['save10'] });
    release();
    expect(await applying).toBe(false);
    expect(engine.getState().cart.coupons).toEqual([]);
  });

  it('sends nothing for a check that ends after the cart froze, and keeps a held code held', async () => {
    const api = fakeApi();
    let engine!: ReturnType<typeof makeEngine>['engine'];
    let failCheck = false;
    const fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      if (!String(init?.body ?? '').includes('NOPE')) return api.fetch(input, init);
      engine.cart.freeze(true);
      return failCheck ? Promise.resolve(new Response('{}', { status: 502 })) : api.fetch(input, init);
    }) as typeof globalThis.fetch;
    engine = makeEngine({ fetch }).engine;
    await engine.start();
    const seen: string[] = [];
    engine.on('*', (e) => (e.name === 'sdk.error' || e.name.startsWith('coupon.')) && seen.push(e.name));
    let held: boolean | undefined;
    void engine.cart.applyCoupon('nope').then((r) => (held = r));
    await engine.cart.addItem(1);
    await flush();
    expect(engine.getState().cart).toMatchObject({ frozen: true, coupons: [], held: ['NOPE'] });
    expect(held).toBeUndefined();
    engine.cart.freeze(false);
    await engine.cart.removeCoupon('nope');
    await flush();
    expect(held).toBe(false);
    expect(await engine.cart.applyCoupon('nope')).toBe(false);
    engine.cart.freeze(false);
    failCheck = true;
    expect(await engine.cart.applyCoupon('nope')).toBe(false);
    expect(seen).toEqual([]);
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
