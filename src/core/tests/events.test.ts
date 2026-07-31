import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '@/core/events';

// EventBus is a singleton, so every test shares one instance. Clearing all
// listeners between tests is what keeps them isolated.
const bus = EventBus.getInstance();

beforeEach(() => {
  bus.removeAllListeners();
});

describe('EventBus.on() unsubscribe contract', () => {
  it('returns a function that removes the handler', () => {
    const handler = vi.fn();
    const unsubscribe = bus.on('sdk:url-parameters-processed', handler);

    expect(typeof unsubscribe).toBe('function');

    bus.emit('sdk:url-parameters-processed', {});
    expect(handler).toHaveBeenCalledTimes(1);

    unsubscribe();
    bus.emit('sdk:url-parameters-processed', {});
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('only removes the handler it was returned for', () => {
    const kept = vi.fn();
    const dropped = vi.fn();
    bus.on('sdk:url-parameters-processed', kept);
    const unsubscribe = bus.on('sdk:url-parameters-processed', dropped);

    unsubscribe();
    bus.emit('sdk:url-parameters-processed', {});

    expect(dropped).not.toHaveBeenCalled();
    expect(kept).toHaveBeenCalledTimes(1);
  });

  it('is idempotent — calling it twice is harmless', () => {
    const handler = vi.fn();
    const unsubscribe = bus.on('sdk:url-parameters-processed', handler);

    unsubscribe();
    expect(() => unsubscribe()).not.toThrow();

    bus.emit('sdk:url-parameters-processed', {});
    expect(handler).not.toHaveBeenCalled();
  });

  it('still delivers the typed payload to the handler', () => {
    const handler = vi.fn();
    bus.on('upsell:quantity-changed', handler);

    bus.emit('upsell:quantity-changed', { quantity: 3, packageId: 12 });

    expect(handler).toHaveBeenCalledWith({ quantity: 3, packageId: 12 });
  });
});

describe('EventBus.off() keeps working alongside the returned unsubscribe', () => {
  it('removes a handler by reference, as the hand-rolled call sites expect', () => {
    const handler = vi.fn();
    bus.on('sdk:url-parameters-processed', handler);

    bus.off('sdk:url-parameters-processed', handler);
    bus.emit('sdk:url-parameters-processed', {});

    expect(handler).not.toHaveBeenCalled();
  });

  it('tolerates a double unsubscribe: explicit off() then the returned function', () => {
    const handler = vi.fn();
    const other = vi.fn();
    const unsubscribe = bus.on('sdk:url-parameters-processed', handler);
    bus.on('sdk:url-parameters-processed', other);

    bus.off('sdk:url-parameters-processed', handler);
    expect(() => unsubscribe()).not.toThrow();

    bus.emit('sdk:url-parameters-processed', {});
    expect(handler).not.toHaveBeenCalled();
    // The second removal must not take an unrelated handler with it.
    expect(other).toHaveBeenCalledTimes(1);
  });

  it('tolerates the reverse order: the returned function then explicit off()', () => {
    const handler = vi.fn();
    const unsubscribe = bus.on('sdk:url-parameters-processed', handler);

    unsubscribe();
    expect(() =>
      bus.off('sdk:url-parameters-processed', handler)
    ).not.toThrow();

    bus.emit('sdk:url-parameters-processed', {});
    expect(handler).not.toHaveBeenCalled();
  });

  it('off() for an event that was never registered is harmless', () => {
    expect(() =>
      bus.off('sdk:url-parameters-processed', vi.fn())
    ).not.toThrow();
  });
});

describe('EventBus listener identity', () => {
  // Listeners live in a Set, so the same function reference registered twice is
  // one entry — and one unsubscribe removes it for both registrations. Every
  // caller today passes a per-instance closure or bound method, so this only
  // bites a shared module-level handler.
  it('treats the same function reference as a single listener', () => {
    const handler = vi.fn();
    const first = bus.on('sdk:url-parameters-processed', handler);
    bus.on('sdk:url-parameters-processed', handler);

    bus.emit('sdk:url-parameters-processed', {});
    expect(handler).toHaveBeenCalledTimes(1);

    first();
    bus.emit('sdk:url-parameters-processed', {});
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('keeps distinct closures independent', () => {
    const calls: string[] = [];
    const unsubscribeA = bus.on('sdk:url-parameters-processed', () =>
      calls.push('a')
    );
    bus.on('sdk:url-parameters-processed', () => calls.push('b'));

    unsubscribeA();
    bus.emit('sdk:url-parameters-processed', {});

    expect(calls).toEqual(['b']);
  });

  it('unsubscribing from inside a handler does not break the emit in progress', () => {
    const second = vi.fn();
    const unsubscribeSelf = bus.on('sdk:url-parameters-processed', () => {
      unsubscribeSelf();
    });
    bus.on('sdk:url-parameters-processed', second);

    expect(() => bus.emit('sdk:url-parameters-processed', {})).not.toThrow();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
