import type { AnalyticsTrace, DestinationTrace, TrackingEvent, TrackingName } from '../engine/events/analytics';
import type { EngineEvent } from '../engine/events/bus';
import { format } from '../engine/format';
import type { LogEntry } from '../engine/log';
import {
  analyticsOff,
  checks,
  type Destination,
  destinations,
  type Layer,
  linesOf,
  type Place,
  pricedOf,
  type ProviderConfig,
  unsupportedNotes,
  type Win,
  WIRING,
} from './providers';
import { type IconName, icon } from './icons';
import { eventModal } from './event-modal';
import { type Child, empty, h, plural, stamp } from './view';

type Run = AnalyticsTrace & { at: number };
type Reach = { place: Place; name: string; payload: unknown };

const BURST: ReadonlySet<string> = new Set<TrackingName>(['product_added_to_cart', 'product_removed_from_cart']);
const LAYERS: Layer[] = ['NextDataLayer', 'dataLayer'];
const PLACES: Record<Place, [string, IconName]> = {
  NextDataLayer: ['NextDataLayer', 'logo'],
  dataLayer: ['GTM', 'gtm'],
  ga4: ['GA4', 'ga4'],
  meta: ['Meta', 'meta'],
  rudderstack: ['RudderStack', 'rudderstack'],
};
const KIND_OF: Record<string, string> = { products: 'product', cart_line: 'cart' };
const KEEP = 300;

const traceOf = (data: unknown) => (data as { trace?: string } | undefined)?.trace;

const pushedTo = (layer: Layer, ids: string[]) =>
  (window as Win)[layer]?.find((p) => ids.includes((p as { event_id?: string } | null)?.event_id ?? ''));

const kindOf = (name: string) => {
  const wire = WIRING.find((w) => (w.tracking ?? w.dl) === name);
  return wire ? (KIND_OF[wire.object!] ?? wire.object ?? wire.from[0]!.split('.')[0]!) : 'page';
};

const dot = (data: Record<string, string>) => {
  const el = h('span', 'adot');
  Object.assign(el.dataset, data);
  return el;
};

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

  const layersOn = (dests = destinations(ui.config(), started())) =>
    dests.filter((d) => d.on && LAYERS.includes(d.place as Layer)).map((d) => d.place as Layer);

  const issues = (run: Run, layers: Layer[]) => {
    if (!run.sent) return [];
    const event = run.id ? events.get(run.id) : undefined;
    return [
      ...(event ? checks(event.event_type, event.data) : []),
      ...layers.filter((l) => !pushedTo(l, burst(run))).map((l) => `not in ${l}`),
    ];
  };

  const reached = (run: Run): Reach[] => [
    ...LAYERS.flatMap((layer) => {
      const push = pushedTo(layer, burst(run)) as { event?: string } | undefined;
      return push ? [{ place: layer, name: push.event ?? '', payload: push as unknown }] : [];
    }),
    ...(sentTo.get(run.id ?? '') ?? []).map((t) => ({ place: t.destination, name: t.name, payload: t.payload })),
  ];

  const carried = (run: Run) => {
    const event = run.id ? events.get(run.id) : undefined;
    if (!event) return '';
    const priced = pricedOf(run.name, event.data);
    const money = (v: unknown) =>
      typeof v === 'number' &&
      format({ type: 'money', value: v }, (priced.currency as string) ?? event.context.campaign?.currency);
    const items = linesOf(run.name, event.data).map((l) => `${l.product_title ?? `#${l.package_id}`} ×${l.quantity}`);
    return [
      priced.number && `#${priced.number}`,
      kindOf(run.name) === 'promotion' && priced.id,
      items.length > 0 && `${items.slice(0, 2).join(', ')}${items.length > 2 ? ` +${items.length - 2}` : ''}`,
      money(priced.total ?? priced.price),
    ]
      .filter(Boolean)
      .join(' · ');
  };

  const money = (run: Run, v: unknown) => {
    const event = run.id ? events.get(run.id) : undefined;
    const currency = (pricedOf(run.name, event?.data).currency as string) ?? event?.context.campaign?.currency;
    return typeof v === 'number' ? format({ type: 'money', value: v }, currency) : '';
  };

  const status = (d: Destination, got: Reach[], layers: Layer[]): ['ok' | 'warn' | 'bad' | 'off', string] => {
    const hit = got.find((g) => g.place === d.place);
    if (!d.on && !hit) return ['off', 'off'];
    if (d.missing) return ['warn', `${hit ? 'received · ' : ''}no ${d.missing} on the page`];
    if (hit) return ['ok', 'received'];
    return layers.includes(d.place as Layer) ? ['bad', 'not pushed'] : ['off', 'nothing for this event'];
  };

  const modal = eventModal(ui.open);

  const open = (run: Run, got: Reach[], layers: Layer[]) => {
    const event = run.id ? events.get(run.id) : undefined;
    const priced = pricedOf(run.name, event?.data);
    const places = destinations(ui.config(), started())
      .filter((d) => d.place !== 'NextDataLayer')
      .map((d) => {
        const [tone, text] = status(d, got, layers);
        const [label, glyph] = PLACES[d.place];
        return { label, icon: glyph, vendor: got.find((g) => g.place === d.place)?.name, tone, text, title: d.title };
      });
    modal.show({
      note:
        run.sent && !places.some((p) => p.text.startsWith('received'))
          ? 'No platform got it: only next.analytics.on listeners and the page’s own forwarder (NextDataLayer).'
          : undefined,
      name: run.name,
      sent: run.sent,
      at: run.at,
      reason: run.reason,
      problems: issues(run, layers),
      places,
      lines: linesOf(run.name, event?.data).map((l) => [
        String(l.product_title ?? `#${l.package_id}`),
        String(l.quantity ?? ''),
        money(run, l.total ?? l.price),
      ]),
      totals: (
        [
          ['Order', priced.number ? `#${priced.number}` : ''],
          ['Total', money(run, priced.total ?? priced.price)],
          ['Currency', (priced.currency as string) ?? ''],
        ] as Array<[string, string]>
      ).filter(([, v]) => v),
      payloads: [
        ...(event ? [['next.analytics.on', event] as [string, unknown]] : []),
        ...got
          .filter((g) => g.place !== 'NextDataLayer')
          .map((g): [string, unknown] => [PLACES[g.place][0], g.payload]),
      ],
    });
  };

  const row = (run: Run, got: Reach[], layers: Layer[]) => {
    const problems = issues(run, layers);
    const el = h(
      'button',
      { type: 'button', className: 'row aev', onclick: () => open(run, got, layers) },
      stamp(run.at),
      h('b', 'aname', dot({ kind: kindOf(run.name) }), run.name),
      h('span', 'asum dim', carried(run)),
      problems.length > 0 && h('span', 'red', `⚠ ${plural(problems.length, 'problem')}`),
    );
    if (problems.length) el.title = problems.join(' · ');
    return el;
  };

  const notice = (text: string, warn = false) => {
    const el = h('div', 'anote', icon(warn ? 'warn' : 'power'), text);
    if (warn) el.dataset.tone = 'warn';
    return el;
  };

  const view = (query: string): Child[] => {
    const config = ui.config();
    const off = analyticsOff(config) ?? (!started() && 'Analytics starts once the page is idle.');
    const layers = layersOn();
    const shown = runs
      .filter((r) => r.sent && (r.name.includes(query) || carried(r).toLowerCase().includes(query)))
      .reverse();
    const sent = runs.filter((r) => r.sent).length;
    return [
      off && notice(off),
      ...unsupportedNotes(config).map((text) => notice(text, true)),
      !sent
        ? empty('Nothing sent yet', 'Each tracking event shows here as next.analytics.on gets it.')
        : !shown.length
          ? empty('Nothing matches', 'No event fits the filter.')
          : h(
              'div',
              'summary',
              `${plural(sent, 'event')} sent on this page, newest first · click one for where it went`,
            ),
      ...shown.map((run) => row(run, reached(run), layers)),
    ];
  };

  const problems = () => {
    const layers = layersOn();
    const byName = new Map<string, Run[]>();
    for (const run of runs)
      if (issues(run, layers).length) byName.set(run.name, [...(byName.get(run.name) ?? []), run]);
    return [...byName].map(([name, list]) => ({
      text: `${name}: ${issues(list.at(-1)!, layers).join(' · ')}${list.length > 1 ? ` (${list.length} events)` : ''}`,
      error: true,
    }));
  };

  const notes = () => {
    if (!started()) return [];
    const config = ui.config();
    return [
      ...destinations(config, true)
        .filter((d) => d.missing && LAYERS.includes(d.place as Layer))
        .map((d) => d.title!),
      ...unsupportedNotes(config),
    ];
  };

  const summary = () => {
    const ga = runs.filter((r) => r.sent && !r.name.startsWith('dl_')).length;
    const n = problems().length;
    return `${ga} sent${n ? ` · ⚠ ${n}` : ''}`;
  };

  return { record, note, view, summary, problems, notes, dialog: modal.dialog };
}
