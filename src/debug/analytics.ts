import type { AnalyticsTrace, DestinationTrace, TrackingEvent, TrackingName } from '../engine/events/analytics';
import type { EngineEvent } from '../engine/events/bus';
import type { LogEntry } from '../engine/log';
import { checks, type Layer, type ProviderConfig, setupNotes, type Win } from './providers';
import { type IconName, icon } from './icons';
import { type Child, empty, expandable, h, plural, stamp, tree } from './view';

type Run = AnalyticsTrace & { at: number };

const BURST: ReadonlySet<string> = new Set<TrackingName>(['product_added_to_cart', 'product_removed_from_cart']);
const LAYERS: Layer[] = ['NextDataLayer', 'dataLayer'];
const PLACES: Record<Layer | DestinationTrace['destination'], [string, IconName]> = {
  NextDataLayer: ['NextDataLayer', 'logo'],
  dataLayer: ['GTM dataLayer', 'gtm'],
  ga4: ['GA4', 'ga4'],
  meta: ['Meta', 'meta'],
  rudderstack: ['RudderStack', 'send'],
};
const KEEP = 300;

const traceOf = (data: unknown) => (data as { trace?: string } | undefined)?.trace;

const pushedTo = (layer: Layer, ids: string[]) =>
  (window as Win)[layer]?.find((p) => ids.includes((p as { event_id?: string } | null)?.event_id ?? ''));

export function analyticsFlow(ui: { open: Set<string>; config: () => ProviderConfig }) {
  const events = new Map<string, TrackingEvent>();
  const runs: Run[] = [];
  const sentTo = new Map<string, DestinationTrace[]>();

  const record = (e: EngineEvent) => {
    if (e.name !== 'analytics') return;
    const event = (e as EngineEvent<'analytics'>).data;
    events.set(event.event_id, event);
    if (events.size > KEEP) events.delete(events.keys().next().value!);
  };

  const note = (entry: LogEntry) => {
    if (traceOf(entry.data) === 'destination') {
      const trace = entry.data as DestinationTrace;
      sentTo.set(trace.event_id, [...(sentTo.get(trace.event_id) ?? []), trace]);
      if (sentTo.size > KEEP) sentTo.delete(sentTo.keys().next().value!);
    } else if (traceOf(entry.data) === 'analytics') {
      runs.push({ ...(entry.data as AnalyticsTrace), at: entry.at });
      if (runs.length > KEEP) runs.shift();
    }
  };

  const started = () => runs.length > 0 || !!(window as Win).NextDataLayer;

  const burst = (run: Run): string[] => {
    const event = run.id ? events.get(run.id) : undefined;
    if (!event || !BURST.has(event.event_type)) return run.id ? [run.id] : [];
    return [...events.values()]
      .filter((e) => e.event_type === event.event_type && e.created_at === event.created_at)
      .map((e) => e.event_id);
  };

  const issues = (run: Run, config = ui.config()) => {
    if (!run.sent) return [];
    const event = run.id ? events.get(run.id) : undefined;
    const enabled = (layer: Layer) => (layer === 'dataLayer' ? config.dataLayer : config.enabled);
    return [
      ...(event ? checks(event.event_type, event.data) : []),
      ...LAYERS.filter((l) => enabled(l) && !pushedTo(l, burst(run))).map((l) => `not in ${l}`),
    ];
  };

  const reached = (run: Run) => [
    ...LAYERS.flatMap((layer) => {
      const push = pushedTo(layer, burst(run)) as { event?: string } | undefined;
      return push ? [{ place: layer, name: push.event ?? '', payload: push as unknown }] : [];
    }),
    ...(sentTo.get(run.id ?? '') ?? []).map((t) => ({ place: t.destination, name: t.name, payload: t.payload })),
  ];

  const logo = (place: keyof typeof PLACES) => {
    const el = icon(PLACES[place][1]);
    el.title = PLACES[place][0];
    return el;
  };

  const row = (run: Run, config: ProviderConfig) => {
    const event = run.id ? events.get(run.id) : undefined;
    const problems = issues(run, config);
    const got = reached(run);
    const summary = [
      stamp(run.at),
      ' ',
      run.name,
      got.length > 0 && h('span', 'reach', ...[...new Set(got.map((g) => g.place))].map(logo)),
      problems.length > 0 && h('span', 'red', ` ⚠ ${problems.join(' · ')}`),
    ];
    if (!event && !got.length) return h('div', 'row', ...summary);
    const path = `a${run.id}`;
    return expandable(summary, path, ui.open, () => [
      event && tree(h('span', 'key', 'next.analytics.on'), event, `${path}.event`, ui.open),
      ...got.map((g, i) =>
        tree(
          h('span', 'dest', logo(g.place), PLACES[g.place][0], h('b', {}, g.name)),
          g.payload,
          `${path}.${i}`,
          ui.open,
        ),
      ),
    ]);
  };

  const view = (query: string): Child[] => {
    const config = ui.config();
    const notes = setupNotes(config, started()).map((n) => n.text);
    const sent = runs.filter((r) => r.sent && r.name.includes(query)).reverse();
    return [
      ...notes.map((text) => h('div', 'summary', text)),
      sent.length
        ? h('div', 'summary', `${plural(sent.length, 'event')} sent on this page, newest first`)
        : query
          ? empty('Nothing matches', 'No event name fits the filter.')
          : empty('Nothing sent yet', 'Each tracking event shows here as next.analytics.on gets it.'),
      ...sent.map((run) => row(run, config)),
    ];
  };

  const problems = () => {
    const byName = new Map<string, Run[]>();
    for (const run of runs) if (issues(run).length) byName.set(run.name, [...(byName.get(run.name) ?? []), run]);
    return [...byName].map(([name, list]) => ({
      text: `${name}: ${issues(list.at(-1)!).join(' · ')}${list.length > 1 ? ` (${list.length} events)` : ''}`,
      error: true,
    }));
  };

  const notes = () =>
    started()
      ? setupNotes(ui.config(), true)
          .filter((n) => n.warn)
          .map((n) => n.text)
      : [];

  const summary = () => {
    const ga = runs.filter((r) => r.sent && !r.name.startsWith('dl_')).length;
    const n = problems().length;
    return `${ga} sent${n ? ` · ⚠ ${n}` : ''}`;
  };

  return { record, note, view, summary, problems, notes };
}
