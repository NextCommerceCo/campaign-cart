import type { AnalyticsTrace, DestinationTrace, TrackingEvent, TrackingName } from '../engine/events/analytics';
import type { EngineEvent } from '../engine/events/bus';
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
  listed,
  pill,
  type Priced,
  tally,
} from './stream';
import { type Child, empty, h, plural, time, toned } from './view';

type Run = AnalyticsTrace & { at: number };
type Reach = { place: Place; name: string; payload: unknown };

/** What the Analytics tab saw: the tracking events, each run of one, and where each went. */
interface Flow {
  ui: {
    config: () => ProviderConfig;
    detail: DetailModal;
    render: () => void;
    price: (amount: number, currency?: string) => string;
  };
  events: Map<string, TrackingEvent>;
  runs: Run[];
  sentTo: Map<string, DestinationTrace[]>;
  skipped: Map<string, DestinationTrace>;
}

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

/** Keeps the newest `KEEP` of a map in the order they came. */
const capped = <V>(map: Map<string, V>, key: string, value: V) => {
  map.set(key, value);
  if (map.size > KEEP) map.delete(map.keys().next().value!);
};

const eventOf = (f: Flow, run: Run) => (run.id ? f.events.get(run.id) : undefined);

const started = (f: Flow) => f.runs.length > 0 || !!(window as Win).NextDataLayer;

const burst = (f: Flow, run: Run): string[] => {
  const event = eventOf(f, run);
  if (!event || !BURST.has(event.event_type)) return run.id ? [run.id] : [];
  return [...f.events.values()]
    .filter((e) => e.event_type === event.event_type && e.created_at === event.created_at)
    .map((e) => e.event_id);
};

const layersOn = (f: Flow) =>
  destinations(f.ui.config(), started(f))
    .filter((d) => d.on && LAYERS.includes(d.place as Layer))
    .map((d) => d.place as Layer);

const issues = (f: Flow, run: Run, layers: Layer[]) => {
  if (!run.sent) return [];
  const event = eventOf(f, run);
  return [
    ...(event ? checks(event.event_type, event.data) : []),
    ...layers.filter((l) => !pushedTo(l, burst(f, run)) && !f.skipped.has(run.id ?? '')).map((l) => `not in ${l}`),
  ];
};

const reached = (f: Flow, run: Run): Reach[] => [
  ...LAYERS.flatMap((layer) => {
    const push = pushedTo(layer, burst(f, run)) as { event?: string } | undefined;
    return push ? [{ place: layer, name: push.event ?? '', payload: push as unknown }] : [];
  }),
  ...(f.sentTo.get(run.id ?? '') ?? []).map((t) => ({ place: t.destination, name: t.name, payload: t.payload })),
];

const money = (f: Flow, run: Run, v: unknown) => {
  const event = eventOf(f, run);
  const currency = (pricedOf(run.name, event?.data).currency as string) ?? event?.context.campaign?.currency;
  return typeof v === 'number' ? f.ui.price(v, currency) : '';
};

const carried = (f: Flow, run: Run) => {
  const event = eventOf(f, run);
  if (!event) return '';
  const priced = pricedOf(run.name, event.data);
  return [
    priced.number && `#${priced.number}`,
    kindOf(run.name) === 'promotion' && priced.id,
    firstItems(linesOf(run.name, event.data).map(lineText)),
    money(f, run, priced.total ?? priced.price),
  ]
    .filter(Boolean)
    .join(' · ');
};

function status(
  f: Flow,
  run: Run,
  d: Destination,
  got: Reach[],
  layers: Layer[],
): ['ok' | 'warn' | 'bad' | 'off', string] {
  const hit = got.find((g) => g.place === d.place);
  const skip = f.skipped.get(run.id ?? '');
  if (!d.on && !hit) return ['off', 'off'];
  if (d.missing) return ['warn', `${hit ? 'received · ' : ''}no ${d.missing} on the page`];
  if (hit) return ['ok', 'received'];
  if (!layers.includes(d.place as Layer)) return ['off', 'nothing for this event'];
  return skip ? ['off', `${skip.name} ${skip.skipped}`] : ['bad', 'not pushed'];
}

/** Each platform but NextDataLayer, with what it got of the run. */
const places = (f: Flow, run: Run, got: Reach[], layers: Layer[]) =>
  destinations(f.ui.config(), started(f))
    .filter((d) => d.place !== 'NextDataLayer')
    .map((d) => {
      const [tone, text] = status(f, run, d, got, layers);
      const hit = got.find((g) => g.place === d.place);
      const el = h(
        'li',
        {},
        icon(PLACES[d.place][1]),
        h('b', {}, PLACES[d.place][0]),
        hit && h('code', {}, hit.name),
        h('span', 'astate', text),
      );
      el.dataset.tone = tone;
      if (d.title) el.title = d.title;
      return el;
    });

function openRun(f: Flow, run: Run, got: Reach[], layers: Layer[]) {
  const event = eventOf(f, run);
  const priced = pricedOf(run.name, event?.data);
  const problems = issues(f, run, layers);
  const list = places(f, run, got, layers);
  const nowhere = run.sent && !list.some((p) => p.dataset.tone === 'ok' || p.textContent!.includes('received'));
  const lines = linesOf(run.name, event?.data) as Priced['lines'];
  f.ui.detail.show({
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
          h('ul', 'aplaces', ...list),
        ],
      ],
      [
        'What it carried',
        carriedView(
          { ...(priced as Priced), lines, total: (priced.total ?? priced.price) as number | undefined },
          (v) => money(f, run, v),
          priced.number ? [['Order', `#${priced.number}`]] : [],
        ),
      ],
    ],
    payloads: [
      ...(event ? [['next.analytics.on', event] as [string, unknown]] : []),
      ...got.filter((g) => g.place !== 'NextDataLayer').map((g): [string, unknown] => [PLACES[g.place][0], g.payload]),
    ],
  });
}

const runRow = (f: Flow, run: Run, layers: Layer[]) => {
  const problems = issues(f, run, layers);
  return line({
    at: run.at,
    tag: kindOf(run.name),
    name: run.name,
    detail: [h('span', 'dim', carried(f, run))],
    meta: problems.length ? [pill(`⚠ ${plural(problems.length, 'problem')}`, 'bad')] : [],
    level: problems.length ? 'error' : undefined,
    title: problems.join(' · ') || undefined,
    open: () => openRun(f, run, reached(f, run), layers),
  });
};

const notice = (text: string, warn = false) =>
  toned(h('div', 'anote', icon(warn ? 'warn' : 'power'), text), warn && 'warn');

/** One problem per tracking event name, from its latest run. */
const flowProblems = (f: Flow) => {
  const layers = layersOn(f);
  const byName = new Map<string, Run[]>();
  for (const run of f.runs)
    if (issues(f, run, layers).length) byName.set(run.name, [...(byName.get(run.name) ?? []), run]);
  return [...byName].map(([name, list]) => ({
    text: `${name}: ${issues(f, list.at(-1)!, layers).join(' · ')}${list.length > 1 ? ` (${list.length} events)` : ''}`,
    error: true,
    open: () => openRun(f, list.at(-1)!, reached(f, list.at(-1)!), layers),
  }));
};

/** What the page's setup lacks for the platforms it turns on. */
const setupNotes = (f: Flow) => {
  if (!started(f)) return [];
  const config = f.ui.config();
  return [
    ...destinations(config, true)
      .filter((d) => d.missing && LAYERS.includes(d.place as Layer))
      .map((d) => d.title!),
    ...unsupportedNotes(config),
  ];
};

export function analyticsFlow(ui: Flow['ui']) {
  const f: Flow = { ui, events: new Map(), runs: [], sentTo: new Map(), skipped: new Map() };
  const kinds = new Set<string>();

  const record = (e: EngineEvent) => {
    if (e.name !== 'analytics') return;
    const event = (e as EngineEvent<'analytics'>).data;
    capped(f.events, event.event_id, event);
  };

  const note = (entry: LogEntry) => {
    const trace = traceOf(entry.data);
    if (trace === 'destination' && (entry.data as DestinationTrace).skipped) {
      const t = entry.data as DestinationTrace;
      capped(f.skipped, t.event_id, t);
    } else if (trace === 'destination') {
      const t = entry.data as DestinationTrace;
      capped(f.sentTo, t.event_id, [...(f.sentTo.get(t.event_id) ?? []), t]);
    } else if (trace === 'analytics') {
      f.runs.push({ ...(entry.data as AnalyticsTrace), at: entry.at });
      if (f.runs.length > KEEP) f.runs.shift();
    }
  };

  const view = (query: string): Child[] => {
    const config = ui.config();
    const off = analyticsOff(config) ?? (!started(f) && 'Analytics starts once the page is idle.');
    const notices = [off && notice(off), ...unsupportedNotes(config).map((text) => notice(text, true))];
    const sent = f.runs.filter((r) => r.sent);
    if (!sent.length)
      return [...notices, empty('Nothing sent yet', 'Each tracking event shows here as next.analytics.on gets it.')];
    const layers = layersOn(f);
    const shown = sent
      .filter(
        (r) =>
          (!kinds.size || kinds.has(kindOf(r.name))) &&
          (r.name.includes(query) || carried(f, r).toLowerCase().includes(query)),
      )
      .reverse();
    return [
      ...notices,
      ...listed(
        chips(
          tally(sent, (r) => kindOf(r.name)),
          kinds,
          ui.render,
        ),
        shown.map((run) => runRow(f, run, layers)),
        'No event fits the filter.',
      ),
    ];
  };

  const summary = () => {
    const ga = f.runs.filter((r) => r.sent && !r.name.startsWith('dl_')).length;
    const n = flowProblems(f).length;
    return `${ga} sent${n ? ` · ⚠ ${n}` : ''}`;
  };

  return { record, note, view, summary, problems: () => flowProblems(f), notes: () => setupNotes(f) };
}
