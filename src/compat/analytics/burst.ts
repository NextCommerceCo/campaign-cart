import type { TrackingEvent } from '../../engine/events/analytics';

export type LineEvent = TrackingEvent<'product_added_to_cart' | 'product_removed_from_cart'>;

export const isLineEvent = (e: TrackingEvent): e is LineEvent =>
  e.event_type === 'product_added_to_cart' || e.event_type === 'product_removed_from_cart';

/**
 * The lines one change added or removed come as one tracking event each, in one tick; 0.4.x sent
 * them as one `dl_add_to_cart` / `dl_remove_from_cart`. Collects a run of one kind and hands it to
 * `send` on a microtask, or before anything else is pushed.
 */
export function lineBurst(send: (lines: LineEvent[]) => void) {
  let burst: LineEvent[] = [];
  const flush = () => {
    if (!burst.length) return;
    const lines = burst;
    burst = [];
    send(lines);
  };
  const collect = (e: LineEvent) => {
    if (burst[0] && burst[0].event_type !== e.event_type) flush();
    if (!burst.length) queueMicrotask(flush);
    burst.push(e);
  };
  return { collect, flush };
}
