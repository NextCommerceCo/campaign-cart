import type { Engine } from '../engine/engine';
import {
  OBJECTS,
  type AnalyticsTrace,
  type TrackingEvent,
  type TrackingMap,
  type TrackingName,
} from '../engine/events/analytics';
import { envelope, type EngineEvent, type EventMap, type EventName } from '../engine/events/bus';
import { newId } from '../engine/id';

export interface Why {
  trigger: EventName;
  reason: string;
  id?: string;
}

/** What one event group sends for the engine events it handles. */
export type Handlers = { [K in EventName]?: (data: EventMap[K], name: K) => void };

export function createReport(engine: Engine) {
  const trace = (trigger: EventName, name: string, sent: boolean, reason: string, id?: string) => {
    const data: AnalyticsTrace = { trace: 'analytics', trigger, name, sent, reason, ...(id && { id }) };
    engine.log.debug(`analytics ${name} ${sent ? 'sent' : 'not sent'}: ${reason}`, data);
  };
  const skip = (trigger: EventName, name: TrackingName, reason: string) => trace(trigger, name, false, reason);

  const emit = <K extends TrackingName>(name: K, data: TrackingMap[K], why: Why) => {
    const sealed = envelope({ id: why.id ?? newId(), name, data, at: Date.now() }, engine.sessionId(), OBJECTS[name]);
    const event = { ...sealed, context: engine.eventContext() } as TrackingEvent;
    engine.events.emit('analytics', event);
    trace(why.trigger, name, true, why.reason, event.event_id);
  };

  return { engine, skip, emit };
}

export type Report = ReturnType<typeof createReport>;

export function dispatch(groups: Handlers[], e: EngineEvent): void {
  for (const handlers of groups)
    (handlers[e.name] as ((data: unknown, name: EventName) => void) | undefined)?.(e.data, e.name);
}
