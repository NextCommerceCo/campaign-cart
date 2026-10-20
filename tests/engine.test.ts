// @vitest-environment node
// The Engine must run without a DOM: this file has no window or document.
import { describe, expect, it } from 'vitest';
import { campaign, fakeApi, flush, makeEngine, MemoryStorage } from './fixtures';

describe('Engine', () => {
  it('runs headless', () => {
    expect(typeof (globalThis as { document?: unknown }).document).toBe('undefined');
  });

  it('loads the campaign and emits campaign.loaded', async () => {
    const { engine } = makeEngine();
    const names: string[] = [];
    engine.on('*', (e) => names.push(e.name));
    await engine.load();
    expect(engine.getState().campaign?.name).toBe('Olympus');
    expect(names).toContain('campaign.loaded');
  });

  it('requests the same campaign URL the loader prefetches', async () => {
    const { campaignUrl } = await import('../src/config');
    const api = fakeApi();
    const { engine } = makeEngine({ fetch: api.fetch });
    await engine.load();
    expect(api.calls[0]!.url).toBe(campaignUrl('https://api.test'));
  });

  it('adopts the loader’s prefetched request instead of fetching again', async () => {
    const api = fakeApi();
    const { engine } = makeEngine({ fetch: api.fetch, prefetched: Promise.resolve(campaign) });
    await engine.load();
    expect(api.calls.filter((c) => c.url.includes('/campaigns/'))).toHaveLength(0);
  });

  it('coalesces changes in one tick into one calculate request', async () => {
    const { engine, api } = makeEngine();
    await engine.load();
    void engine.addItem(1);
    void engine.addItem(9);
    await engine.applyCoupon(' save10 ');
    expect(api.calculates()).toHaveLength(1);
    expect(api.calculates()[0]!.body.vouchers).toEqual(['SAVE10']);
    expect(engine.getState().cart.summary?.total).toBe('48.00');
  });

  it('ignores a stale calculate response', async () => {
    const slow = fakeApi({ delayMs: 20 });
    const { engine } = makeEngine({ fetch: slow.fetch });
    await engine.load();
    const first = engine.addItem(1);
    await flush();
    const second = engine.addItem(9);
    await Promise.all([first, second]);
    await new Promise((r) => setTimeout(r, 40));
    expect(engine.getState().cart.summary?.subtotal).toBe('58.00');
  });

  it('swaps one group without touching another', async () => {
    const { engine } = makeEngine();
    await engine.load();
    await engine.setGroup('bundle:main', { lines: [{ packageId: 1, quantity: 1 }], vouchers: [] });
    await engine.setGroup('toggle:9', { lines: [{ packageId: 9, quantity: 1 }], vouchers: [] });
    await engine.setGroup('bundle:main', { lines: [{ packageId: 2, quantity: 1 }], vouchers: [] });
    expect(engine.lines()).toEqual([
      { package_id: 2, quantity: 1 },
      { package_id: 9, quantity: 1 },
    ]);
  });

  it('remembers a group the shopper switched off', async () => {
    const { engine } = makeEngine();
    await engine.setGroup('toggle:9', { lines: [{ packageId: 9, quantity: 1 }], vouchers: [] });
    await engine.setGroup('toggle:9', null, { dismiss: true });
    expect(engine.getState().cart.dismissed).toEqual(['toggle:9']);
  });

  it('restores cart and campaign snapshot synchronously on the next page', async () => {
    const local = new MemoryStorage();
    const first = makeEngine({ local });
    await first.engine.load();
    await first.engine.addItem(2);

    const second = makeEngine({ local });
    expect(second.engine.restore()).toBe(true);
    expect(second.engine.getState().campaign?.name).toBe('Olympus');
    expect(second.engine.getState().cart.summary?.total).toBe('89.00');
  });

  it('keeps working in memory when storage throws, and says so', async () => {
    const degraded: string[] = [];
    const broken = new MemoryStorage(true);
    const { StorageAdapter } = await import('../src/engine/storage');
    const storage = new StorageAdapter({ prefix: 'p', version: 1, local: broken, onDegrade: (t) => degraded.push(t) });
    storage.set('cart', { a: 1 }, 'local');
    expect(storage.get('cart', 'local')).toEqual({ a: 1 });
    expect(degraded).toContain('local');
  });

  it('replays boot events to a late subscriber', async () => {
    const { engine } = makeEngine();
    await engine.load();
    const seen: string[] = [];
    engine.on('campaign.loaded', (e) => seen.push(e.name), { replay: true });
    expect(seen).toEqual(['campaign.loaded']);
  });

  it('reports API failures as an error event, never a throw', async () => {
    const failing = (async () => new Response('nope', { status: 500 })) as typeof fetch;
    const { engine } = makeEngine({ fetch: failing });
    const errors: unknown[] = [];
    engine.on('error', (e) => errors.push(e.data));
    await expect(engine.load()).resolves.toBeUndefined();
    expect(errors).toHaveLength(1);
  });
});
