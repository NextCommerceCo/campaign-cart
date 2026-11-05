import type { AnalyticsTrace, TrackingEvent, TrackingName } from '../engine/events/analytics';
import type { EngineEvent } from '../engine/events/bus';
import type { LogEntry } from '../engine/log';
import { checks, type Layer, type ProviderConfig, setupNotes, type Win } from './providers';
import { badge, type Child, empty, h, plural, stamp, tree } from './view';

type Run = AnalyticsTrace & { at: number };

const BURST: ReadonlySet<string> = new Set<TrackingName>(['product_added_to_cart', 'product_removed_from_cart']);
const LAYERS: Layer[] = ['NextDataLayer', 'dataLayer'];
const KEEP = 300;

const isTrace = (data: unknown): data is AnalyticsTrace => (data as AnalyticsTrace | undefined)?.trace === 'analytics';

const pushedTo = (layer: Layer, ids: string[]) =>
  (window as Win)[layer]?.find((p) => ids.includes((p as { event_id?: string } | null)?.event_id ?? ''));

export function analyticsFlow(ui: { open: Set<string>; config: () => ProviderConfig }) {
  const events = new Map<string, TrackingEvent>();
  const runs: Run[] = [];

  const record = (e: EngineEvent) => {
    if (e.name !== 'analytics') return;
    const event = (e as EngineEvent<'analytics'>).data;
    events.set(event.event_id, event);
    if (events.size > KEEP) events.delete(events.keys().next().value!);
  };

  const note = (entry: LogEntry) => {
    if (!isTrace(entry.data)) return;
    runs.push({ ...entry.data, at: entry.at });
    if (runs.length > KEEP) runs.shift();
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

  const row = (run: Run, config: ProviderConfig) => {
    const event = run.id ? events.get(run.id) : undefined;
    const problems = issues(run, config);
    const label = h(
      'span',
      {},
      stamp(run.at),
      badge(event?.object ?? 'data layer', 'outline'),
      ' ',
      run.name,
      problems.length > 0 && h('span', 'red', ` ⚠ ${problems.join(' · ')}`),
    );
    const value = event ?? (run.id && pushedTo('NextDataLayer', [run.id]));
    return value ? tree(label, value, `a${run.id}`, ui.open) : h('div', 'row', label);
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
