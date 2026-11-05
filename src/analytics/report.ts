import type { Engine } from '../engine/engine';
import type { AnalyticsEvent, AnalyticsMap, AnalyticsName, AnalyticsTrace } from '../engine/events/analytics';
import type { EngineEvent, EventMap, EventName } from '../engine/events/bus';
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
  const skip = (trigger: EventName, name: AnalyticsName, reason: string) => trace(trigger, name, false, reason);

  const emit = <K extends AnalyticsName>(name: K, params: AnalyticsMap[K], why: Why) => {
    const id = why.id ?? newId();
    const event = { name, id, time: new Date().toISOString(), params, context: engine.eventContext() };
    engine.events.emit('analytics', event as AnalyticsEvent);
    trace(why.trigger, name, true, why.reason, id);
  };

  return { engine, skip, emit };
}

export type Report = ReturnType<typeof createReport>;

export function dispatch(groups: Handlers[], e: EngineEvent): void {
  for (const handlers of groups)
    (handlers[e.name] as ((data: unknown, name: EventName) => void) | undefined)?.(e.data, e.name);
}
