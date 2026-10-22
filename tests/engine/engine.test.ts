import { describe, expect, it, vi } from 'vitest';
import { fakeApi } from '../fixtures/api';
import { flush, makeEngine, wait } from '../fixtures/engine';
import { campaign } from '../fixtures/campaign';
import { MemoryStorage } from '../fixtures/storage';

const toggle = (id: number) => ({ lines: [{ packageId: id, quantity: 1 }], vouchers: [] });

describe('Engine', () => {
  it('runs headless', () => {
    expect(typeof (globalThis as { document?: unknown }).document).toBe('undefined');
  });
  it('adopts the loader’s campaign request', async () => {
    const { engine } = makeEngine();
    const names: string[] = [];
    engine.on('*', (e) => names.push(e.name));
    await engine.start();
    expect(engine.getState().campaign?.name).toBe('Olympus');
    expect(names).toEqual(['campaign.loaded', 'ready']);
  });
  it('is ready once: from the snapshot before the campaign request returns, else after it', async () => {
    const local = new MemoryStorage();
    await makeEngine({ local }).engine.start();
    let answer!: (c: typeof campaign) => void;
    const cached = makeEngine({ local, campaign: new Promise((r) => (answer = r)) }).engine;
    const ready = vi.fn();
    cached.on('ready', ready);
    const started = cached.start();
    expect(ready).toHaveBeenCalledTimes(1);
    answer(campaign);
    await started;
    expect(ready).toHaveBeenCalledTimes(1);

    const failed = makeEngine({ campaign: Promise.reject(new Error('down')) }).engine;
    failed.on('ready', ready);
    await failed.start();
    expect(ready).toHaveBeenCalledTimes(1);
  });
  it('clears saved state on reset and starts the cart from ?forcePackageId', async () => {
    const local = new MemoryStorage();
    const session = new MemoryStorage();
    const first = makeEngine({ local, session }).engine;
    await first.start();
    await first.cart.addItem(1);
    const reset = makeEngine({ local, session, reset: true }).engine;
    expect(reset.getState().campaign).toBeUndefined();
    expect(reset.cart.lines()).toEqual([]);
    await first.cart.addItem(1);
    const forced = makeEngine({ local, session, params: { forcePackageId: '2:3' } }).engine;
    expect(forced.cart.lines()).toEqual([{ package_id: 2, quantity: 3 }]);
  });
  it('reports a failed campaign request as an error event', async () => {
    const { engine } = makeEngine({ campaign: Promise.reject(new Error('down')) });
    const errors: unknown[] = [];
    engine.on('error', (e) => errors.push(e.data));
    await engine.start();
    expect(errors).toEqual([{ action: 'load', message: 'down' }]);
  });
  it('restores the cart from this tab and the campaign snapshot on the next page', async () => {
    const local = new MemoryStorage();
    const session = new MemoryStorage();
    const first = makeEngine({ local, session }).engine;
    await first.start();
    await first.cart.addItem(2);
    const second = makeEngine({ local, session }).engine;
    expect(second.getState().campaign).toBeDefined();
    expect(second.getState().campaign?.name).toBe('Olympus');
    expect(second.cart.lines()).toEqual([{ package_id: 2, quantity: 1 }]);
    expect(second.getState().cart.summary).toBeUndefined();
  });
  it('starts a new tab with an empty cart', async () => {
    const local = new MemoryStorage();
    const first = makeEngine({ local }).engine;
    await first.cart.addItem(2);
    const newTab = makeEngine({ local }).engine;
    expect(newTab.cart.lines()).toEqual([]);
  });
  it('does not restore a campaign snapshot older than 10 minutes', async () => {
    const local = new MemoryStorage();
    let now = 0;
    await makeEngine({ local, now: () => now }).engine.start();
    now = 11 * 60 * 1000;
    expect(makeEngine({ local, now: () => now }).engine.getState().campaign).toBeUndefined();
  });
  it('keeps the snapshot in sessionStorage when localStorage is full, and reads it back', async () => {
    const local = new MemoryStorage('after-probe');
    const session = new MemoryStorage();
    const first = makeEngine({ local, session });
    const degraded: unknown[] = [];
    first.engine.on('storage.degraded', (e) => degraded.push(e.data));
    await first.engine.start();
    expect(degraded).toEqual([{ reason: 'local: QuotaExceededError' }]);
    expect(makeEngine({ local, session }).engine.getState().campaign).toBeDefined();
  });
  it('reports blocked storage at boot to late subscribers', () => {
    const { engine } = makeEngine({ session: new MemoryStorage('always') });
    const degraded: unknown[] = [];
    engine.on('storage.degraded', (e) => degraded.push(e.data), { replay: true });
    expect(degraded).toEqual([{ reason: 'session: unavailable' }, { reason: 'local: unavailable' }]);
  });
  it('keeps URL params for the session but not one-shot ones', () => {
    const session = new MemoryStorage();
    makeEngine({ session, params: { utm_source: 'fb', banner: 'n', reset: '1' } });
    const next = makeEngine({ session, params: { step: '2' } }).engine;
    expect(next.getState().visit.params).toEqual({ utm_source: 'fb', banner: 'n', step: '2' });
  });

  it('notifies subscribers once per tick, after every change', async () => {
    const { engine } = makeEngine();
    const notified = vi.fn();
    engine.subscribe(notified);
    void engine.cart.addItem(1);
    void engine.cart.applyCoupon('SAVE10');
    engine.selectors.register('main', [{ id: 'one', lines: [], vouchers: [] }], 'select');
    expect(notified).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(notified).toHaveBeenCalledTimes(1);
  });

  it('does not extend the snapshot lifetime by restoring it', async () => {
    const local = new MemoryStorage();
    let now = 0;
    await makeEngine({ local, now: () => now }).engine.start();
    now = 9 * 60 * 1000;
    expect(makeEngine({ local, now: () => now }).engine.getState().campaign).toBeDefined();
    now = 11 * 60 * 1000;
    expect(makeEngine({ local, now: () => now }).engine.getState().campaign).toBeUndefined();
  });

  it('never keeps ref_id beyond the page that has it', () => {
    const session = new MemoryStorage();
    makeEngine({ session, params: { ref_id: 'R1', utm_source: 'fb' } });
    const next = makeEngine({ session }).engine;
    expect(next.getState().visit.params).toEqual({ utm_source: 'fb' });
  });

  it('counts exit-intent popups for the tab', () => {
    const session = new MemoryStorage();
    const first = makeEngine({ session }).engine;
    first.noteExitIntentShown();
    const next = makeEngine({ session }).engine;
    expect(next.getState().visit.exitIntentShown).toBe(1);
  });

  it('keeps a countdown running across pages of the tab, and starts it over once it has run out', () => {
    const session = new MemoryStorage();
    let now = 1000;
    expect(makeEngine({ session, now: () => now }).engine.timerStart('offer', 60_000)).toBe(1000);
    now = 31_000;
    expect(makeEngine({ session, now: () => now }).engine.timerStart('offer', 60_000)).toBe(1000);
    now = 61_000;
    expect(makeEngine({ session, now: () => now }).engine.timerStart('offer', 60_000)).toBe(1000);
    expect(makeEngine({ session, now: () => now }).engine.timerStart('offer', 60_000)).toBe(61_000);
  });
});
