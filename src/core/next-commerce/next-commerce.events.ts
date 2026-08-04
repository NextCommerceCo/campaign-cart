/**
 * `NextCommerce`'s Events category — extracted verbatim from
 * `next-commerce.ts`. All five functions read or write instance state (the
 * `EventBus` and the `callbacks` map), so all take a `NextCommerceEventsContext`.
 */

import type { CallbackType, CallbackData, EventMap } from '@/types/global';
import type { EventBus } from '@/core/events';
import type { Logger } from '@/core/logger';

export interface NextCommerceEventsContext {
  eventBus: EventBus;
  callbacks: Map<CallbackType, Set<Function>>;
  logger: Logger;
}

/**
 * Subscribes to an SDK event. Names and payloads are typed via `EventMap`.
 *
 * @example
 * ```ts
 * sdk.on('cart:item-added', ({ packageId, quantity }) => { ... });
 * ```
 * @category Events
 */
export function on<K extends keyof EventMap>(
  ctx: NextCommerceEventsContext,
  event: K,
  handler: (data: EventMap[K]) => void
): void {
  ctx.eventBus.on(event, handler);
}

/**
 * Unsubscribes a handler previously registered with {@link core/next-commerce!NextCommerce.on}.
 * @category Events
 */
export function off<K extends keyof EventMap>(
  ctx: NextCommerceEventsContext,
  event: K,
  handler: Function
): void {
  ctx.eventBus.off(event, handler);
}

/**
 * Registers a callback for a lifecycle callback type (e.g. cart/order hooks).
 * Prefer {@link core/next-commerce!NextCommerce.on} for event-style subscriptions.
 * @category Events
 */
export function registerCallback(
  ctx: NextCommerceEventsContext,
  type: CallbackType,
  callback: (data: CallbackData) => void
): void {
  if (!ctx.callbacks.has(type)) {
    ctx.callbacks.set(type, new Set());
  }
  ctx.callbacks.get(type)!.add(callback);
}

/**
 * Removes a callback registered with {@link core/next-commerce!NextCommerce.registerCallback}.
 * @category Events
 */
export function unregisterCallback(
  ctx: NextCommerceEventsContext,
  type: CallbackType,
  callback: Function
): void {
  ctx.callbacks.get(type)?.delete(callback);
}

/**
 * Invokes all callbacks registered for a type (errors are caught and logged).
 * @category Events
 */
export function triggerCallback(
  ctx: NextCommerceEventsContext,
  type: CallbackType,
  data: CallbackData
): void {
  ctx.callbacks.get(type)?.forEach(callback => {
    try {
      callback(data);
    } catch (error) {
      ctx.logger.error(`Callback error for ${type}:`, error);
    }
  });
}
