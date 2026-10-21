// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { fakeApi, flush, makeEngine, MemoryStorage, wait } from './fixtures';

const toggle = (id: number) => ({ lines: [{ packageId: id, quantity: 1 }], vouchers: [] });

describe('Engine', () => {
  it('runs headless', () => {
    expect(typeof (globalThis as { document?: unknown }).document).toBe('undefined');
  });

  it('adopts the loader’s campaign request', async () => {
    const { engine } = makeEngine();
    const names: string[] = [];
    engine.on('*', (e) => names.push(e.name));
    await engine.load();
    expect(engine.getState().campaign?.name).toBe('Olympus');
    expect(names).toEqual(['campaign.loaded']);
  });

  it('reports a failed campaign request as an error event', async () => {
    const { engine } = makeEngine({ campaign: Promise.reject(new Error('down')) });
    const errors: unknown[] = [];
    engine.on('error', (e) => errors.push(e.data));
    await engine.load();
    expect(errors).toEqual([{ action: 'load', message: 'down' }]);
  });

  it('coalesces changes in one tick into one calculate request with the key header', async () => {
    const { engine, api } = makeEngine();
    await engine.load();
    void engine.addItem(1);
    void engine.setGroup('bundle:main', { lines: [{ packageId: 9, quantity: 1 }], vouchers: ['save10'] });
    await engine.applyCoupon(' save10 ');
    expect(api.calls).toHaveLength(1);
    expect(api.calls[0]!.headers.Authorization).toBe('pk_test');
    expect(api.calls[0]!.body.vouchers).toEqual(['SAVE10']);
    expect(engine.getState().cart.summary?.total).toBe('48.00');
  });

  it('never lets an older response overwrite a newer one', async () => {
    const api = fakeApi({ delays: [40, 5], ignoreAbort: true });
    const { engine } = makeEngine({ fetch: api.fetch });
    await engine.load();
    void engine.addItem(1);
    await flush();
    void engine.addItem(9);
    await wait(60);
    expect(engine.getState().cart.summary?.subtotal).toBe('58.00');
  });

  it('does not bring a summary back when the cart is emptied mid-request', async () => {
    const api = fakeApi({ delays: [20] });
    const { engine } = makeEngine({ fetch: api.fetch });
    await engine.load();
    void engine.setGroup('toggle:9', toggle(9));
    await flush();
    void engine.setGroup('toggle:9', null, { dismiss: true });
    await wait(40);
    expect(engine.getState().cart.summary).toBeUndefined();
    expect(engine.getState().cart.calculating).toBe(false);
  });

  it('reports calculating through cart.updated', async () => {
    const { engine } = makeEngine();
    await engine.load();
    const seen: boolean[] = [];
    engine.on('cart.updated', (e) => seen.push((e.data as { cart: { calculating: boolean } }).cart.calculating));
    await engine.addItem(1);
    expect(seen).toEqual([true, false]);
  });

  it('swaps one group without touching another', async () => {
    const { engine } = makeEngine();
    await engine.load();
    await engine.setGroup('bundle:main', toggle(1));
    await engine.setGroup('toggle:9', toggle(9));
    await engine.setGroup('bundle:main', toggle(2));
    expect(engine.lines()).toEqual([
      { package_id: 2, quantity: 1 },
      { package_id: 9, quantity: 1 },
    ]);
  });

  it('remembers a group the shopper switched off', async () => {
    const { engine } = makeEngine();
    await engine.setGroup('toggle:9', toggle(9));
    await engine.setGroup('toggle:9', null, { dismiss: true });
    expect(engine.getState().cart.dismissed).toEqual(['toggle:9']);
  });

  it('removes package ids the campaign does not have', async () => {
    const { engine } = makeEngine();
    const errors: unknown[] = [];
    engine.on('error', (e) => errors.push(e.data));
    void engine.setGroup('items', { lines: [{ packageId: 1, quantity: 1 }, { packageId: 404, quantity: 1 }], vouchers: [] });
    await engine.load();
    await flush();
    expect(engine.lines()).toEqual([{ package_id: 1, quantity: 1 }]);
    expect(errors).toHaveLength(1);
  });

  it('restores the cart from this tab and the campaign snapshot on the next page', async () => {
    const local = new MemoryStorage();
    const session = new MemoryStorage();
    const first = makeEngine({ local, session }).engine;
    await first.load();
    await first.addItem(2);
    const second = makeEngine({ local, session }).engine;
    expect(second.restore()).toBe(true);
    expect(second.getState().campaign?.name).toBe('Olympus');
    expect(second.lines()).toEqual([{ package_id: 2, quantity: 1 }]);
    expect(second.getState().cart.summary).toBeUndefined();
  });

  it('starts a new tab with an empty cart', async () => {
    const local = new MemoryStorage();
    const first = makeEngine({ local }).engine;
    await first.addItem(2);
    const newTab = makeEngine({ local }).engine;
    newTab.restore();
    expect(newTab.lines()).toEqual([]);
  });

  it('does not restore a campaign snapshot older than 10 minutes', async () => {
    const local = new MemoryStorage();
    let now = 0;
    await makeEngine({ local, now: () => now }).engine.load();
    now = 11 * 60 * 1000;
    expect(makeEngine({ local, now: () => now }).engine.restore()).toBe(false);
  });

  it('keeps the snapshot in sessionStorage when localStorage is full, and reads it back', async () => {
    const local = new MemoryStorage('after-probe');
    const session = new MemoryStorage();
    const first = makeEngine({ local, session });
    const degraded: unknown[] = [];
    first.engine.on('storage.degraded', (e) => degraded.push(e.data));
    await first.engine.load();
    expect(degraded).toEqual([{ reason: 'local: QuotaExceededError' }]);
    expect(makeEngine({ local, session }).engine.restore()).toBe(true);
  });

  it('reports blocked storage at boot to late subscribers', () => {
    const { engine } = makeEngine({ session: new MemoryStorage('always') });
    const degraded: unknown[] = [];
    engine.on('storage.degraded', (e) => degraded.push(e.data), { replay: true });
    expect(degraded).toEqual([{ reason: 'session: unavailable' }, { reason: 'local: unavailable' }]);
  });

  it('keeps URL params for the session but not one-shot ones', () => {
    const session = new MemoryStorage();
    makeEngine({ session, params: { utm_source: 'fb', banner: 'n', reset: '1' } }).engine.restore();
    const next = makeEngine({ session, params: { step: '2' } }).engine;
    next.restore();
    expect(next.getState().params).toEqual({ utm_source: 'fb', banner: 'n', step: '2' });
  });

  it('announces shipping and selection changes with their data', async () => {
    const { engine } = makeEngine();
    const seen: unknown[] = [];
    engine.on('shipping.changed', (e) => seen.push(e.data));
    engine.on('selection.changed', (e) => seen.push(e.data));
    await engine.setShipping(2);
    await engine.setShipping(2);
    engine.select('main', 'two', [{ packageId: 2, quantity: 1 }]);
    expect(seen).toEqual([{ methodId: 2 }, { selectorId: 'main', cardId: 'two', items: [{ packageId: 2, quantity: 1 }] }]);
  });

  it('keeps working in memory when every storage is blocked', async () => {
    const { engine } = makeEngine({ local: new MemoryStorage('always'), session: new MemoryStorage('always') });
    await engine.load();
    await engine.addItem(1);
    expect(engine.getState().cart.summary?.total).toBe('49.00');
  });

  it('keeps the HTTP status when an error body is not JSON', async () => {
    const failing = (async () => new Response('<html>Bad Gateway</html>', { status: 502 })) as typeof fetch;
    const { engine } = makeEngine({ fetch: failing });
    const errors: Array<{ message: string }> = [];
    engine.on('error', (e) => errors.push(e.data as { message: string }));
    await engine.load();
    await engine.addItem(1);
    expect(errors[0]!.message).toContain('502');
    expect(engine.getState().cart.calculating).toBe(false);
  });
});

describe('events', () => {
  it('replays buffered events and survives a throwing subscriber', async () => {
    const { engine } = makeEngine();
    await engine.load();
    const seen: string[] = [];
    engine.on('campaign.loaded', () => { throw new Error('boom'); }, { replay: true });
    engine.on('campaign.loaded', (e) => seen.push(e.name), { replay: true });
    expect(seen).toEqual(['campaign.loaded']);
  });

  it('delivers events emitted inside a listener after the current one', () => {
    const { engine } = makeEngine();
    const order: string[] = [];
    engine.on('selection.changed', () => engine.events.emit('ready', { lines: [] }));
    engine.on('*', (e) => order.push(e.name));
    engine.select('main', 'one', []);
    expect(order).toEqual(['selection.changed', 'ready']);
  });

  it('stops delivering after unsubscribe', () => {
    const { engine } = makeEngine();
    const seen: string[] = [];
    const off = engine.on('ready', (e) => seen.push(e.name));
    off();
    engine.events.emit('ready', { lines: [] });
    expect(seen).toEqual([]);
  });
});

