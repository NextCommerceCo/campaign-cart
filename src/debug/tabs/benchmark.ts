import type { Engine } from '../../engine/engine';
import { type Child, h, plural } from '../ui/view';

type Resource = PerformanceResourceTiming & { responseStatus?: number };
type Span = { label: string; kind: 'page' | 'file' | 'call'; start: number; end: number };
type Mark = { label: string; at: number; main?: boolean };

const SHOWN = 12;
const CALL = /\/api\/v1\/|\/v1\/(geo|countries|locales|validate|flags)\b/;
const ms = (n: number | undefined) => (n === undefined ? '—' : `${Math.round(n)} ms`);
const kb = (bytes: number) => `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
const VITALS: Array<[name: string, good: number, poor: number, show: (v: number) => string]> = [
  ['LCP', 2500, 4000, (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)} s` : ms(v))],
  ['CLS', 0.1, 0.25, (v) => v.toFixed(2)],
  ['INP', 200, 500, ms],
];

const entries = <T extends PerformanceEntry>(type: string) => {
  try {
    return performance.getEntriesByType(type) as T[];
  } catch {
    return [];
  }
};

/** Watches this load's Web Vitals into `vitals`; returns what stops watching. */
function observeVitals(vitals: Record<string, number>) {
  let observer: PerformanceObserver | undefined;
  try {
    observer = new PerformanceObserver((list) => {
      for (const e of list.getEntries() as Array<PerformanceEntry & Record<string, number>>) {
        if (e.entryType === 'largest-contentful-paint') vitals.LCP = e.startTime;
        else if (e.entryType === 'layout-shift') {
          if (!e.hadRecentInput) vitals.CLS = (vitals.CLS ?? 0) + Number(e.value);
        } else if (e.interactionId) vitals.INP = Math.max(vitals.INP ?? 0, e.duration);
      }
    });
  } catch {}
  for (const type of ['largest-contentful-paint', 'layout-shift', 'event'])
    try {
      observer?.observe({ type, buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
    } catch {}
  return () => observer?.disconnect();
}

function read() {
  const nav = entries<PerformanceNavigationTiming>('navigation')[0];
  const loader = document.querySelector<HTMLScriptElement>('script[src*="loader"]')?.src;
  const base = loader ? new URL('.', loader).href : undefined;
  const resources = entries<Resource>('resource');
  const files = resources.filter((r) => base && r.name.startsWith(base) && !CALL.test(r.name));
  const calls = resources.filter((r) => CALL.test(r.name));
  const shown = entries('mark').find((m) => m.name === 'next:ready')?.startTime;
  return { nav, files, calls, shown };
}

const name = (url: string) => {
  const u = new URL(url);
  return u.pathname.split('/').pop() || u.pathname;
};
const path = (url: string) => {
  const u = new URL(url);
  return u.origin === location.origin ? u.pathname : `${u.host}${u.pathname}`;
};

const tile = (label: string, value: string, note = '') =>
  h('div', 'bmtile', h('small', {}, label), h('b', {}, value), note && h('small', {}, note));

const legend = () =>
  h(
    'p',
    'bmlegend',
    ...(['file', 'call'] as const).map((kind) => {
      const key = h('span', 'bmbar');
      key.dataset.kind = kind;
      return h('span', {}, key, kind === 'file' ? 'SDK file' : 'API call');
    }),
    h('span', {}, h('span', { className: 'bmdot' }), 'milestone'),
  );

function waterfall(spans: Span[], marks: Mark[]) {
  const end = Math.max(1, ...spans.map((s) => s.end), ...marks.map((m) => m.at)) * 1.04;
  const at = (n: number) => `${((n / end) * 100).toFixed(2)}%`;
  const bar = (s: Span) => {
    const el = h('span', 'bmbar');
    el.dataset.kind = s.kind;
    el.style.left = at(s.start);
    el.style.width = at(Math.max(s.end - s.start, end / 400));
    return el;
  };
  const dot = (m: Mark) => {
    const el = h('span', 'bmdot');
    if (m.main) el.dataset.main = '';
    el.style.left = at(m.at);
    return el;
  };
  return [
    h(
      'div',
      'bmwf',
      ...spans
        .slice(0, SHOWN)
        .flatMap((s) => [
          h('span', { className: s.kind === 'page' ? '' : 'bmname', title: s.label }, s.label),
          h('span', 'bmtrack', bar(s)),
          h('span', 'bmms', ms(s.end - s.start)),
        ]),
      ...marks.flatMap((m) => [
        h('span', m.main ? '' : 'dim', m.main ? h('b', {}, m.label) : m.label),
        h('span', 'bmtrack', dot(m)),
        h('span', 'bmms', ms(m.at)),
      ]),
    ),
    spans.length > SHOWN && h('p', 'bmnote', `+${plural(spans.length - SHOWN, 'more file')} and calls, not drawn`),
    legend(),
  ];
}

const vitalTiles = (vitals: Record<string, number>) =>
  VITALS.map(([label, good, poor, show]) => {
    const v = vitals[label];
    const el = tile(
      label,
      v === undefined ? '—' : show(v),
      v === undefined ? 'not measured yet' : v <= good ? 'good' : v <= poor ? 'needs work' : 'poor',
    );
    el.dataset.tone = v === undefined ? '' : v <= good ? 'good' : v <= poor ? 'work' : 'poor';
    return el;
  });

/** The developer Benchmark tab: this page load's timings, from the browser's own performance entries. */
export function benchmarkView(engine: Engine) {
  let ready: number | undefined;
  const vitals: Record<string, number> = {};
  const stops = [
    engine.on('sdk.ready', (e) => (ready = e.at - performance.timeOrigin), { replay: true }),
    observeVitals(vitals),
  ];

  const view = (): Child[] => {
    const { nav, files, calls, shown } = read();
    const campaign = calls.find((c) => c.name.includes('/api/v1/campaigns'));
    const bytes = files.reduce((n, f) => n + (f.transferSize || f.encodedBodySize || 0), 0);
    const spans: Span[] = [
      ...(nav ? [{ label: 'HTML', kind: 'page' as const, start: 0, end: nav.responseEnd }] : []),
      ...files.map((f) => ({ label: name(f.name), kind: 'file' as const, start: f.startTime, end: f.responseEnd })),
      ...calls.map((c) => ({ label: path(c.name), kind: 'call' as const, start: c.startTime, end: c.responseEnd })),
    ].sort((a, b) => a.start - b.start);
    const marks: Mark[] = [
      ...(ready !== undefined ? [{ label: 'sdk.ready', at: ready, main: true }] : []),
      ...(shown !== undefined ? [{ label: 'Page shown', at: shown, main: true }] : []),
      ...(nav?.domContentLoadedEventStart ? [{ label: 'DOMContentLoaded', at: nav.domContentLoadedEventStart }] : []),
      ...(nav?.loadEventStart ? [{ label: 'window load', at: nav.loadEventStart }] : []),
    ];
    const slowest = [...calls].sort((a, b) => b.duration - a.duration);
    const loaded = marks.length ? Math.max(...marks.map((m) => m.at)) : Infinity;
    return [
      h(
        'div',
        'bmtiles',
        tile('SDK ready', ms(ready)),
        tile('Page shown', ms(shown)),
        tile('Campaign API', ms(campaign?.duration), campaign ? '' : 'cached or not timed'),
        tile('SDK JS', kb(bytes), `${plural(files.length, 'file')}, as sent`),
      ),
      h('h3', 'bmhead', 'Load waterfall · from navigation start'),
      ...waterfall(
        spans.filter((sp) => sp.start <= loaded),
        marks,
      ),
      spans.some((sp) => sp.start > loaded) && h('p', 'bmnote', 'Calls after the page loaded are in the table below.'),
      h('h3', 'bmhead', `API calls on this page · ${calls.length} · slowest first`),
      calls.length
        ? h(
            'table',
            'bmcalls',
            h('tr', {}, h('th', {}, 'Call'), h('th', {}, 'Status'), h('th', {}, 'Time')),
            ...slowest.map((c) =>
              h(
                'tr',
                {},
                h('td', {}, path(c.name)),
                h('td', {}, String(c.responseStatus || '—')),
                h('td', {}, ms(c.duration)),
              ),
            ),
          )
        : h('p', 'bmnote', 'No API call on this page yet.'),
      h('h3', 'bmhead', 'Web Vitals · this load, this browser'),
      h('div', 'bmtiles', ...vitalTiles(vitals)),
      h('p', 'bmnote', 'One load in this browser: compare before and after a change, not across machines.'),
    ];
  };

  return { view, stop: () => stops.forEach((stop) => stop()) };
}
