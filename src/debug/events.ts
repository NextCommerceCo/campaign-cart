import type { Engine } from '../engine/engine';
import { type EngineEvent, envelope, PUBLIC, type SdkEvent } from '../engine/events/bus';
import { badge, type Child, empty, h, plural, stamp, tree } from './view';

const KEEP = 200;

export function eventsView(engine: Engine, open: Set<string>) {
  const seen: SdkEvent[] = [];

  const record = (e: EngineEvent) => {
    if (!PUBLIC.has(e.name)) return;
    seen.push(envelope(e, engine.sessionId()));
    if (seen.length > KEEP) seen.shift();
  };

  const row = (e: SdkEvent) =>
    tree(
      h('span', {}, stamp(Date.parse(e.created_at)), badge(e.object, 'outline'), ' ', e.event_type),
      e,
      `e${e.event_id}`,
      open,
    );

  const view = (query: string): Child[] => {
    if (!seen.length) return [empty('No events yet', 'Each SDK event shows here as next.on gets it.')];
    const shown = seen.filter((e) => e.event_type.includes(query)).reverse();
    if (!shown.length) return [empty('Nothing matches', 'No event name fits the filter.')];
    return [
      h('div', 'summary', `${plural(seen.length, 'event')} on this page, newest first, as next.on gets them`),
      ...shown.map(row),
    ];
  };

  engine.on('*', record, { replay: true });
  return { view, count: () => seen.length };
}
