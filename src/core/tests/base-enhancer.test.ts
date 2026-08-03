import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseEnhancer } from '@/core/base/base-enhancer';
import { EventBus } from '@/core/events';

const bus = EventBus.getInstance();

beforeEach(() => {
  bus.removeAllListeners();
});

/** Minimal store shape `BaseEnhancer.subscribe()` accepts. */
function makeStore() {
  const listeners = new Set<(state: { n: number }) => void>();
  return {
    subscribe(listener: (state: { n: number }) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit(state: { n: number }) {
      listeners.forEach(l => l(state));
    },
    get listenerCount() {
      return listeners.size;
    },
  };
}

/** Uses only the auto-cleaning helpers — the shape every enhancer should use. */
class AutoEnhancer extends BaseEnhancer {
  public initialize(): void {}
  public update(): void {}

  public listen(handler: () => void): void {
    this.on('sdk:url-parameters-processed', handler);
  }

  public watch(
    store: { subscribe: (l: (state: { n: number }) => void) => () => void },
    listener: (state: { n: number }) => void
  ): void {
    this.subscribe(store, listener);
  }
}

/**
 * Mirrors the six features that hand-roll bus cleanup: a stored handler
 * reference plus an explicit `off()` in `cleanupEventListeners()`. Registering
 * through `this.on()` now also unsubscribes automatically, so this class
 * exercises the double-unsubscribe those call sites will do until they collapse.
 */
class HandRolledEnhancer extends BaseEnhancer {
  private boundHandler = (): void => {
    this.hits += 1;
  };
  public hits = 0;

  public initialize(): void {
    this.on('sdk:url-parameters-processed', this.boundHandler);
  }

  public update(): void {}

  protected override cleanupEventListeners(): void {
    this.eventBus.off('sdk:url-parameters-processed', this.boundHandler);
  }
}

describe('BaseEnhancer.on() cleanup', () => {
  it('stops firing a bus handler after destroy()', () => {
    const enhancer = new AutoEnhancer(document.createElement('div'));
    const handler = vi.fn();
    enhancer.listen(handler);

    bus.emit('sdk:url-parameters-processed', {});
    expect(handler).toHaveBeenCalledTimes(1);

    enhancer.destroy();
    bus.emit('sdk:url-parameters-processed', {});

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('leaves another instance’s handler for the same event attached', () => {
    const a = new AutoEnhancer(document.createElement('div'));
    const b = new AutoEnhancer(document.createElement('div'));
    const handlerA = vi.fn();
    const handlerB = vi.fn();
    a.listen(handlerA);
    b.listen(handlerB);

    a.destroy();
    bus.emit('sdk:url-parameters-processed', {});

    expect(handlerA).not.toHaveBeenCalled();
    expect(handlerB).toHaveBeenCalledTimes(1);
  });

  it('cleans up several handlers registered on one instance', () => {
    const enhancer = new AutoEnhancer(document.createElement('div'));
    const first = vi.fn();
    const second = vi.fn();
    enhancer.listen(first);
    enhancer.listen(second);

    enhancer.destroy();
    bus.emit('sdk:url-parameters-processed', {});

    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
  });

  it('is safe to call destroy() twice', () => {
    const enhancer = new AutoEnhancer(document.createElement('div'));
    const handler = vi.fn();
    enhancer.listen(handler);

    enhancer.destroy();
    expect(() => enhancer.destroy()).not.toThrow();

    bus.emit('sdk:url-parameters-processed', {});
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('BaseEnhancer.subscribe() cleanup is unchanged', () => {
  it('drops the store subscription on destroy()', () => {
    const store = makeStore();
    const enhancer = new AutoEnhancer(document.createElement('div'));
    const listener = vi.fn();
    enhancer.watch(store, listener);

    store.emit({ n: 1 });
    expect(listener).toHaveBeenCalledTimes(1);

    enhancer.destroy();
    expect(store.listenerCount).toBe(0);

    store.emit({ n: 2 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('cleans up store and bus subscriptions in the same destroy()', () => {
    const store = makeStore();
    const enhancer = new AutoEnhancer(document.createElement('div'));
    const storeListener = vi.fn();
    const busHandler = vi.fn();
    enhancer.watch(store, storeListener);
    enhancer.listen(busHandler);

    enhancer.destroy();
    store.emit({ n: 1 });
    bus.emit('sdk:url-parameters-processed', {});

    expect(storeListener).not.toHaveBeenCalled();
    expect(busHandler).not.toHaveBeenCalled();
  });
});

describe('hand-rolled off() call sites keep working', () => {
  it('double unsubscribe (automatic + explicit off) is harmless', () => {
    const enhancer = new HandRolledEnhancer(document.createElement('div'));
    const survivor = vi.fn();
    enhancer.initialize();
    bus.on('sdk:url-parameters-processed', survivor);

    bus.emit('sdk:url-parameters-processed', {});
    expect(enhancer.hits).toBe(1);

    expect(() => enhancer.destroy()).not.toThrow();
    bus.emit('sdk:url-parameters-processed', {});

    expect(enhancer.hits).toBe(1);
    // The explicit off() must not remove an unrelated handler as collateral.
    expect(survivor).toHaveBeenCalledTimes(2);
  });
});
