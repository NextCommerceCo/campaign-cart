import { describe, expect, it, vi } from 'vitest';
import type { Engine } from '../../src/engine/engine';
import type { AnalyticsEvent, EngineEvent, EventContext, EventName, Snapshot } from '../../src/engine/events';
import { makeEngine } from '../fixtures/engine';

const READY: Snapshot = { cart: { lines: [], coupons: [] }, selectors: [] };
const ANALYTICS: AnalyticsEvent = { name: 'page_view', id: 'a1', time: '', params: {}, context: {} as EventContext };

const replayed = (engine: Engine, name: EventName | '*') => {
  const seen: string[] = [];
  engine.on(name, (e) => seen.push(e.name), { replay: true })();
  return seen;
};

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

  it('replays to a late listener in order, and an event its handler sends reaches the others at once', () => {
    const { engine } = makeEngine();
    const seen: string[] = [];
    const code = (e: EngineEvent) => (e.data as { code: string }).code;
    engine.events.emit('coupon.removed', { code: 'A', reason: 'shopper' });
    engine.events.emit('coupon.removed', { code: 'B', reason: 'shopper' });
    engine.on('coupon.removed', (e) => seen.push(`other ${code(e)}`));
    engine.on(
      'coupon.removed',
      (e) => {
        seen.push(`late ${code(e)}`);
        if (code(e) === 'A') engine.events.emit('coupon.removed', { code: 'C', reason: 'shopper' });
      },
      { replay: true },
    );
    expect(seen).toEqual(['late A', 'other C', 'late B', 'late C']);
  });

  it('keeps selector.updated and analytics events while state updates flood the buffer', () => {
    const { engine } = makeEngine();
    engine.events.emit('sdk.ready', READY);
    engine.events.emit('selector.updated', { selector_id: 's', type: 'bundle', lines: [] });
    engine.events.emit('analytics', ANALYTICS);
    for (let i = 0; i < 150; i++) engine.events.emit('cart.calculated', { lines: [], coupons: [] });
    expect(replayed(engine, 'selector.updated')).toEqual(['selector.updated']);
    expect(replayed(engine, 'analytics')).toEqual(['analytics']);
  });

  it('never drops the event just sent, and drops internal events before public ones', () => {
    const { engine } = makeEngine();
    engine.events.emit('sdk.ready', READY);
    for (let i = 0; i < 99; i++) engine.events.emit('coupon.denied', { code: `C${i}`, reason: 'no_discount' });
    engine.events.emit('cart.calculated', { lines: [], coupons: [] });
    expect(replayed(engine, 'cart.calculated')).toEqual(['cart.calculated']);
    for (let i = 0; i < 150; i++) engine.events.emit('analytics', ANALYTICS);
    expect(replayed(engine, '*')).toEqual(['sdk.ready', ...Array<string>(98).fill('coupon.denied'), 'analytics']);
  });
});
