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

export function on<K extends keyof EventMap>(
  ctx: NextCommerceEventsContext,
  event: K,
  handler: (data: EventMap[K]) => void
): void {
  ctx.eventBus.on(event, handler);
}

export function off<K extends keyof EventMap>(
  ctx: NextCommerceEventsContext,
  event: K,
  handler: Function
): void {
  ctx.eventBus.off(event, handler);
}

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

export function unregisterCallback(
  ctx: NextCommerceEventsContext,
  type: CallbackType,
  callback: Function
): void {
  ctx.callbacks.get(type)?.delete(callback);
}

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
