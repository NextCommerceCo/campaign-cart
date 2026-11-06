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
import type { PageConfigModal } from './config';
import type { PageVisit } from './state';
import { type IconName, icon } from './icons';
import { badge, button, type Child, empty, expandable, h, plural, stamp, tree } from './view';

type Run = AnalyticsTrace & { at: number };
type Reach = { place: Place; name: string; payload: unknown };

const BURST: ReadonlySet<string> = new Set<TrackingName>(['product_added_to_cart', 'product_removed_from_cart']);
const LAYERS: Layer[] = ['NextDataLayer', 'dataLayer'];
const PLACES: Record<Place, [string, IconName]> = {
  NextDataLayer: ['NextDataLayer', 'logo'],
  dataLayer: ['GTM dataLayer', 'gtm'],
  ga4: ['GA4', 'ga4'],
  meta: ['Meta', 'meta'],
  rudderstack: ['RudderStack', 'send'],
};
const FUNNEL: Array<[TrackingName, string]> = [
  ['page_viewed', 'Page'],
  ['product_viewed', 'Product'],
  ['product_added_to_cart', 'Cart'],
  ['checkout_started', 'Checkout'],
  ['checkout_contact_info_submitted', 'Contact'],
  ['checkout_shipping_address_submitted', 'Address'],
  ['checkout_shipping_method_submitted', 'Shipping'],
  ['checkout_payment_info_submitted', 'Payment'],
  ['checkout_completed', 'Purchase'],
];
const UPSELL: Array<[TrackingName, string]> = [
  ['upsell_viewed', 'Upsell'],
  ['upsell_completed', 'Upsell paid'],
];
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

export function analyticsFlow(ui: {
  open: Set<string>;
  config: () => ProviderConfig;
  pageConfig: PageConfigModal;
  /** Every page of this tab, each with the tracking events it sent. */
  pages: () => PageVisit[];
}) {
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

  const logo = (place: Place) => {
    const el = icon(PLACES[place][1]);
    el.title = PLACES[place][0];
    return el;
  };

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

  const row = (run: Run, got: Reach[], layers: Layer[]) => {
    const event = run.id ? events.get(run.id) : undefined;
    const problems = issues(run, layers);
    const line = [
      stamp(run.at),
      ' ',
      h('b', 'aname', dot({ kind: kindOf(run.name) }), run.name),
      ' ',
      h('span', 'asum dim', carried(run)),
      h('span', 'amarks', ...[...new Set(got.map((g) => g.place))].map(logo)),
      problems.length > 0 && h('span', 'aprob red', `⚠ ${problems.join(' · ')}`),
    ];
    if (!event && !got.length) return h('div', 'row aev', ...line);
    const path = `a${run.id}`;
    return expandable(
      line,
      path,
      ui.open,
      () => [
        event && tree(h('span', 'key', 'next.analytics.on'), event, `${path}.event`, ui.open),
        ...got.map((g, i) =>
          tree(
            h('span', 'adest', logo(g.place), PLACES[g.place][0], h('b', {}, g.name)),
            g.payload,
            `${path}.${i}`,
            ui.open,
          ),
        ),
      ],
      'aev',
    );
  };

  const strip = (dests: Destination[], got: Reach[][]) => {
    const n = (place: Place) => got.filter((g) => g.some((r) => r.place === place)).length;
    const live = dests.filter((d) => d.on || n(d.place) > 0);
    const off = dests.filter((d) => !live.includes(d));
    const place = (d: Destination) => {
      const count = n(d.place);
      const label = PLACES[d.place][0];
      const el = h(
        'span',
        'aplace',
        dot({ tone: d.missing ? 'warn' : 'on' }),
        label,
        h('b', {}, d.missing ? `no ${d.missing}` : String(count)),
      );
      el.dataset.place = d.place;
      el.title = [`${plural(count, 'event')} reached ${label} on this page.`, d.on && d.title]
        .filter(Boolean)
        .join(' ');
      return el;
    };
    const edit = button(icon('settings'), () => ui.pageConfig.open('analytics'), { variant: 'ghost', size: 'xs' });
    edit.append('Config');
    edit.title = 'Turn destinations on or off for this tab';
    const offs = h('span', 'aoff', `Off: ${off.map((d) => PLACES[d.place][0]).join(', ')}`);
    offs.title = off
      .map((d) => d.title)
      .filter(Boolean)
      .join(' ');
    return h('div', 'adests', h('span', 'asub', 'Sent to'), ...live.map(place), off.length > 0 && offs, edit);
  };

  const funnel = () => {
    const pages = ui.pages();
    const upsell = pages.some((p) => p.kind === 'upsell' || p.sent.some((s) => s.startsWith('upsell_')));
    const steps = upsell ? [...FUNNEL, ...UPSELL] : FUNNEL;
    const where = (name: string) => [...new Set(pages.filter((p) => p.sent.includes(name)).map((p) => p.path))];
    const done = steps.filter(([name]) => where(name).length).length;
    return h(
      'div',
      'afunnel',
      h('span', 'asub', `Funnel ${done}/${steps.length}`),
      ...steps.map(([name, label]) => {
        const on = where(name);
        const el = h('span', 'astep', label);
        el.dataset.done = String(on.length > 0);
        el.title = `${name}: ${on.length ? `sent on ${on.join(', ')}` : 'not sent on any page of this tab yet'}`;
        return el;
      }),
    );
  };

  const notice = (text: string, warn = false) => {
    const el = h('div', 'anote', icon(warn ? 'warn' : 'power'), text);
    if (warn) el.dataset.tone = 'warn';
    return el;
  };

  const view = (query: string): Child[] => {
    const config = ui.config();
    const off = analyticsOff(config) ?? (!started() && 'Analytics starts once the page is idle.');
    const dests = destinations(config, started());
    const layers = layersOn(dests);
    const sent = runs.filter((r) => r.sent);
    const got = sent.map(reached);
    const shown = sent
      .map((run, i) => ({ run, got: got[i]! }))
      .filter(({ run }) => run.name.includes(query) || carried(run).toLowerCase().includes(query))
      .reverse();
    return [
      off && notice(off),
      ...unsupportedNotes(config).map((text) => notice(text, true)),
      strip(dests, got),
      funnel(),
      !sent.length
        ? empty('Nothing sent yet', 'Each tracking event shows here as next.analytics.on gets it.')
        : !shown.length
          ? empty('Nothing matches', 'No event fits the filter.')
          : h('div', 'summary', `${plural(sent.length, 'event')} sent on this page, newest first`),
      ...shown.map(({ run, got }) => row(run, got, layers)),
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

  return { record, note, view, summary, problems, notes };
}
