/**
 * Type-safe event bus for SDK communication
 */

import type { EventMap } from '@/types/global';

/**
 * Singleton event bus behind `sdk.on` and `sdk.off`. Typed by {@link EventMap}, so a handler receives the payload its event name declares.
 *
 * @category Events
 */
export class EventBus {
  private static instance: EventBus;
  private listeners = new Map<keyof EventMap, Set<Function>>();

  private constructor() {}

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /**
   * Registers `handler` for `event` and returns a function that removes it again.
   *
   * Prefer the returned function over {@link EventBus.off}: `off` needs the exact
   * handler reference, so an inline arrow passed straight to `on` would otherwise be
   * impossible to remove. Calling the returned function twice is harmless, as is
   * calling it after an equivalent `off`.
   *
   * Inside an enhancer, use `this.on(...)` instead — it keeps this unsubscribe and
   * runs it on `destroy()`. Registering here directly leaks the handler for the
   * lifetime of the page, because the bus is a singleton.
   *
   * Handlers are held in a `Set`, so registering the *same function reference*
   * twice registers it once, and the first unsubscribe removes it for both callers.
   *
   * @example
   * const stop = EventBus.getInstance().on('cart:item-added', ({ packageId }) => {
   *   console.log('added', packageId);
   * });
   * stop(); // handler removed
   */
  public on<K extends keyof EventMap>(
    event: K,
    handler: (data: EventMap[K]) => void
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  public emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          (handler as (data: EventMap[K]) => void)(data);
        } catch (error) {
          console.error(`Event handler error for ${String(event)}:`, error);
        }
      });
    }
  }

  public off<K extends keyof EventMap>(event: K, handler: Function): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  public removeAllListeners<K extends keyof EventMap>(event?: K): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}
