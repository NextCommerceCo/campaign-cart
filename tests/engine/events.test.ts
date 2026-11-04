import { describe, expect, it, vi } from 'vitest';
import type { EngineEvent, Snapshot } from '../../src/engine/events';
import { makeEngine } from '../fixtures/engine';

const READY: Snapshot = { cart: { lines: [], coupons: [] }, selectors: [] };

describe('events', () => {
  it('replays buffered events and survives a throwing subscriber', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { engine } = makeEngine();
    await engine.start();
    const seen: string[] = [];
    engine.on(
      'campaign.loaded',
      () => {
        throw new Error('boom');
      },
      { replay: true },
    );
    engine.on('campaign.loaded', (e) => seen.push(e.name), { replay: true });
    expect(seen).toEqual(['campaign.loaded']);
    expect(engine.log.entries()).toContainEqual(
      expect.objectContaining({ level: 'error', message: 'subscriber failed on campaign.loaded' }),
    );
  });

  it('delivers events emitted inside a listener after the current one', () => {
    const { engine } = makeEngine();
    const order: string[] = [];
    engine.on('coupon.removed', () => engine.events.emit('sdk.ready', READY));
    engine.on('*', (e) => order.push(e.name));
    engine.events.emit('coupon.removed', { code: 'A', reason: 'shopper' });
    expect(order).toEqual(['coupon.removed', 'sdk.ready']);
  });

  it('stops delivering after unsubscribe', () => {
    const { engine } = makeEngine();
    const seen: string[] = [];
    const off = engine.on('sdk.ready', (e) => seen.push(e.name));
    off();
    engine.events.emit('sdk.ready', READY);
    expect(seen).toEqual([]);
  });
  it('runs a ready listener added during ready once, and keeps ready for late listeners', () => {
    const { engine } = makeEngine();
    const late = vi.fn();
    engine.on('sdk.ready', () => engine.on('sdk.ready', late, { replay: true }));
    engine.events.emit('sdk.ready', READY);
    expect(late).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 150; i++) engine.events.emit('cart.calculated', { lines: [], coupons: [] });
    const later = vi.fn();
    engine.on('sdk.ready', later, { replay: true });
    expect(later).toHaveBeenCalledTimes(1);
  });

  it('replays to a listener added mid-delivery each event once, in order', () => {
    const { engine } = makeEngine();
    const seen: string[] = [];
    engine.on('sdk.ready', () => engine.events.emit('coupon.removed', { code: 'A', reason: 'shopper' }));
    engine.on('sdk.ready', () => engine.on('*', (e) => seen.push(e.name), { replay: true }));
    engine.events.emit('sdk.ready', READY);
    expect(seen).toEqual(['sdk.ready', 'coupon.removed']);
  });

  it('keeps the events that matter for late listeners when pricing floods the buffer', () => {
    const { engine } = makeEngine();
    const replayed = () => {
      const seen: EngineEvent[] = [];
      const off = engine.on('*', (e) => seen.push(e), { replay: true });
      off();
      return seen;
    };
    engine.events.emit('sdk.ready', READY);
    engine.events.emit('coupon.removed', { code: 'A', reason: 'shopper' });
    for (let i = 0; i < 150; i++) engine.events.emit('cart.calculated', { lines: [], coupons: [] });
    expect(replayed().map((e) => e.name)).toEqual([
      'sdk.ready',
      'coupon.removed',
      ...Array<string>(98).fill('cart.calculated'),
    ]);
    for (let i = 0; i < 150; i++) engine.events.emit('coupon.denied', { code: `C${i}`, reason: 'no_discount' });
    const kept = replayed();
    expect(kept.map((e) => e.name)).toEqual(['sdk.ready', ...Array<string>(99).fill('coupon.denied')]);
    expect(kept[1]!.data).toMatchObject({ code: 'C51' });
  });
});
