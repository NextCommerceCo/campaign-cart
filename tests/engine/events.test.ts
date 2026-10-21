import { describe, expect, it, vi } from 'vitest';
import { makeEngine } from '../fixtures/engine';

describe('events', () => {
  it('replays buffered events and survives a throwing subscriber', async () => {
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
  });

  it('delivers events emitted inside a listener after the current one', () => {
    const { engine } = makeEngine();
    const order: string[] = [];
    engine.on('selection.changed', () => engine.events.emit('ready', { lines: [] }));
    engine.on('*', (e) => order.push(e.name));
    engine.selectors.register('main', [{ id: 'one', lines: [], vouchers: [] }], 'select');
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
  it('runs a ready listener added during ready once, and keeps ready for late listeners', () => {
    const { engine } = makeEngine();
    const late = vi.fn();
    engine.on('ready', () => engine.on('ready', late, { replay: true }));
    engine.events.emit('ready', { lines: [] });
    expect(late).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 150; i++) engine.events.emit('cart.calculated', { summary: {} as never });
    const later = vi.fn();
    engine.on('ready', later, { replay: true });
    expect(later).toHaveBeenCalledTimes(1);
  });
});
