import type {
  AnalyticsTrace,
  DataLayerTrace,
  DestinationTrace,
  TrackingEvent,
  TrackingName,
} from '../engine/events/analytics';
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
import {
  carried as carriedView,
  chips,
  type DetailModal,
  firstItems,
  line,
  lineText,
  pill,
  type Priced,
} from './stream';
import { type Child, empty, h, plural, time } from './view';

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

export function analyticsFlow(ui: { config: () => ProviderConfig; detail: DetailModal; render: () => void }) {
  const events = new Map<string, TrackingEvent>();
  const kinds = new Set<string>();
  const runs: Run[] = [];
  const sentTo = new Map<string, DestinationTrace[]>();
  const skipped = new Map<string, DataLayerTrace>();

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
    } else if (traceOf(entry.data) === 'data_layer') {
      const trace = entry.data as DataLayerTrace;
      skipped.set(trace.event_id, trace);
      if (skipped.size > KEEP) skipped.delete(skipped.keys().next().value!);
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
      ...layers.filter((l) => !pushedTo(l, burst(run)) && !skipped.has(run.id ?? '')).map((l) => `not in ${l}`),
    ];
  };

  const reached = (run: Run): Reach[] => [
    ...LAYERS.flatMap((layer) => {
      const push = pushedTo(layer, burst(run)) as { event?: string } | undefined;
      return push ? [{ place: layer, name: push.event ?? '', payload: push as unknown }] : [];
    }),
    ...(sentTo.get(run.id ?? '') ?? []).map((t) => ({ place: t.destination, name: t.name, payload: t.payload })),
  ];

  const money = (run: Run, v: unknown) => {
    const event = run.id ? events.get(run.id) : undefined;
    const currency = (pricedOf(run.name, event?.data).currency as string) ?? event?.context.campaign?.currency;
    return typeof v === 'number' ? format({ type: 'money', value: v }, currency) : '';
  };

  const carried = (run: Run) => {
    const event = run.id ? events.get(run.id) : undefined;
    if (!event) return '';
    const priced = pricedOf(run.name, event.data);
    return [
      priced.number && `#${priced.number}`,
      kindOf(run.name) === 'promotion' && priced.id,
      firstItems(linesOf(run.name, event.data).map(lineText)),
      money(run, priced.total ?? priced.price),
    ]
      .filter(Boolean)
      .join(' · ');
  };

  const status = (run: Run, d: Destination, got: Reach[], layers: Layer[]): ['ok' | 'warn' | 'bad' | 'off', string] => {
    const hit = got.find((g) => g.place === d.place);
    const skip = skipped.get(run.id ?? '');
    if (!d.on && !hit) return ['off', 'off'];
    if (d.missing) return ['warn', `${hit ? 'received · ' : ''}no ${d.missing} on the page`];
    if (hit) return ['ok', 'received'];
    if (!layers.includes(d.place as Layer)) return ['off', 'nothing for this event'];
    return skip ? ['off', `${skip.name} ${skip.skipped}`] : ['bad', 'not pushed'];
  };

  const open = (run: Run, got: Reach[], layers: Layer[]) => {
    const event = run.id ? events.get(run.id) : undefined;
    const priced = pricedOf(run.name, event?.data);
    const problems = issues(run, layers);
    const places = destinations(ui.config(), started())
      .filter((d) => d.place !== 'NextDataLayer')
      .map((d) => {
        const [tone, text] = status(run, d, got, layers);
        const el = h(
          'li',
          {},
          icon(PLACES[d.place][1]),
          h('b', {}, PLACES[d.place][0]),
          got.find((g) => g.place === d.place) && h('code', {}, got.find((g) => g.place === d.place)!.name),
          h('span', 'astate', text),
        );
        el.dataset.tone = tone;
        if (d.title) el.title = d.title;
        return el;
      });
    const nowhere = run.sent && !places.some((p) => p.dataset.tone === 'ok' || p.textContent!.includes('received'));
    ui.detail.show({
      title: run.name,
      badge: run.sent ? ['Sent', 'success'] : ['Not sent', 'secondary'],
      subtitle: [time(run.at), location.pathname, run.reason, priced.currency as string | undefined]
        .filter(Boolean)
        .join(' · '),
      sections: [
        ...(problems.length
          ? [['Problems', [h('ul', 'aprobs', ...problems.map((p) => h('li', {}, p)))]] as [string, Child[]]]
          : []),
        [
          'Sent to',
          [
            nowhere &&
              h(
                'p',
                'anoted',
                'No platform got it: only next.analytics.on listeners and the page’s own forwarder (NextDataLayer).',
              ),
            h('ul', 'aplaces', ...places),
          ],
        ],
        [
          'What it carried',
          carriedView(
            {
              ...(priced as Priced),
              lines: linesOf(run.name, event?.data) as Priced['lines'],
              total: (priced.total ?? priced.price) as number | undefined,
            },
            (v) => money(run, v),
            priced.number ? [['Order', `#${priced.number}`]] : [],
          ),
        ],
      ],
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
    return line({
      at: run.at,
      tag: kindOf(run.name),
      name: run.name,
      detail: [h('span', 'dim', carried(run))],
      meta: problems.length ? [pill(`⚠ ${plural(problems.length, 'problem')}`, 'bad')] : [],
      level: problems.length ? 'error' : undefined,
      title: problems.join(' · ') || undefined,
      open: () => open(run, got, layers),
    });
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
    const sent = runs.filter((r) => r.sent);
    const counts = sent.reduce<Record<string, number>>(
      (n, r) => ({ ...n, [kindOf(r.name)]: (n[kindOf(r.name)] ?? 0) + 1 }),
      {},
    );
    const shown = sent
      .filter(
        (r) =>
          (!kinds.size || kinds.has(kindOf(r.name))) &&
          (r.name.includes(query) || carried(r).toLowerCase().includes(query)),
      )
      .reverse();
    return [
      off && notice(off),
      ...unsupportedNotes(config).map((text) => notice(text, true)),
      sent.length > 0 && chips(Object.entries(counts), kinds, ui.render),
      ...(!sent.length
        ? [empty('Nothing sent yet', 'Each tracking event shows here as next.analytics.on gets it.')]
        : !shown.length
          ? [empty('Nothing matches', 'No event fits the filter.')]
          : shown.map((run) => row(run, reached(run), layers))),
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
      open: () => open(list.at(-1)!, reached(list.at(-1)!), layers),
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

  return { record, note, view, summary, problems, notes };
}
