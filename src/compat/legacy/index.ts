import type { Engine } from '../../engine/engine';
import type { EngineEvent, EventName } from '../../engine/events/bus';
import { LATER, LEGACY_EVENTS } from './events';
import { type From, legacyRegistry, type LegacyState } from './registry';

/** @deprecated One 0.4.x `next.on` listener: `handle` calls it for each event its name is made from, and says when it is done. */
export interface LegacyHandler {
  replay?: boolean;
  handle(event: EngineEvent): boolean;
}

/** @deprecated The listener for a 0.4.x name made from the events; undefined for any other name. */
export function legacyHandler(
  engine: Engine,
  name: string,
  fn: (data: unknown, event?: EngineEvent) => void,
): LegacyHandler | undefined {
  const boot = Object.prototype.hasOwnProperty.call(LEGACY_EVENTS, name) ? LEGACY_EVENTS[name] : undefined;
  if (!boot && !LATER.includes(name)) return undefined;
  const r = legacyRegistry(engine);
  return {
    replay: boot?.replay,
    handle(event) {
      const e = event as From<EventName>;
      const alias = boot ?? r.added[name];
      if (!alias?.from.includes(e.name)) return false;
      const state: LegacyState = { ...engine.getState(), previousPick: (id) => r.previousPick!(e, id) };
      if (alias.when && !alias.when(e, state)) return false;
      const data = alias.data(e, state);
      (alias.each ? (data as unknown[]) : [data]).forEach((payload) => fn(payload, e));
      return !!alias.once;
    },
  };
}
