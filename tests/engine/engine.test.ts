import { describe, expect, it, vi } from 'vitest';
import { fakeApi } from '../fixtures/api';
import { flush, makeEngine, wait } from '../fixtures/engine';
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
  it('restores the cart from this tab and the campaign snapshot on the next page', async () => {
    const local = new MemoryStorage();
    const session = new MemoryStorage();
    const first = makeEngine({ local, session }).engine;
    await first.load();
    await first.cart.addItem(2);
    const second = makeEngine({ local, session }).engine;
    expect(second.restore()).toBe(true);
    expect(second.getState().campaign?.name).toBe('Olympus');
    expect(second.cart.lines()).toEqual([{ package_id: 2, quantity: 1 }]);
    expect(second.getState().cart.summary).toBeUndefined();
  });
  it('starts a new tab with an empty cart', async () => {
    const local = new MemoryStorage();
    const first = makeEngine({ local }).engine;
    await first.cart.addItem(2);
    const newTab = makeEngine({ local }).engine;
    newTab.restore();
    expect(newTab.cart.lines()).toEqual([]);
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
    await makeEngine({ local, now: () => now }).engine.load();
    now = 9 * 60 * 1000;
    expect(makeEngine({ local, now: () => now }).engine.restore()).toBe(true);
    now = 11 * 60 * 1000;
    expect(makeEngine({ local, now: () => now }).engine.restore()).toBe(false);
  });

  it('never keeps ref_id beyond the page that has it', () => {
    const session = new MemoryStorage();
    makeEngine({ session, params: { ref_id: 'R1', utm_source: 'fb' } }).engine.restore();
    const next = makeEngine({ session }).engine;
    next.restore();
    expect(next.getState().visit.params).toEqual({ utm_source: 'fb' });
  });

  it('counts exit-intent popups for the tab', () => {
    const session = new MemoryStorage();
    const first = makeEngine({ session }).engine;
    first.restore();
    first.noteExitIntentShown();
    const next = makeEngine({ session }).engine;
    next.restore();
    expect(next.getState().visit.exitIntentShown).toBe(1);
  });
});
