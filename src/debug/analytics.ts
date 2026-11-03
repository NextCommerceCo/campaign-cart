import type { EngineEvent } from '../engine/events';
import type { LogEntry } from '../engine/log';
import type { AnalyticsEvent, AnalyticsTrace, EventName } from '../engine/events';
import { format } from '../engine/format';
import { checks, type Item, itemsOf, type Layer, type ProviderConfig, providers, type Win, WIRING } from './providers';
import { icon } from './icons';
import { type Child, empty, expandable, h, nodes, time, tree, tsugi } from './view';

type State = 'ok' | 'skip' | 'warn' | 'off' | 'info';
type Show = 'sent' | 'skipped' | 'problems';
type Run = AnalyticsTrace & { at: number };

const LABELS: Partial<Record<EventName, string>> = {
  ready: 'Page loaded',
  'cart.calculated': 'Cart priced',
  'cart.updated': 'Cart emptied',
  'checkout.started': 'Checkout opened',
  'checkout.shipping-added': 'Shipping filled in',
  'checkout.payment-added': 'Payment chosen',
  'order.loaded': 'Order loaded',
  'upsell.viewed': 'Upsell shown',
  'upsell.skipped': 'Upsell skipped',
  'exit-intent.shown': 'Exit popup shown',
  'exit-intent.clicked': 'Exit popup clicked',
  'exit-intent.dismissed': 'Exit popup dismissed',
  'exit-intent.closed': 'Exit popup closed',
  'exit-intent.action': 'Exit popup offer used',
};

const NOT_PUSHED: Record<Layer, string> = {
  NextDataLayer: 'NextDataLayerTransformFn dropped it, or the page replaced window.NextDataLayer',
  dataLayer: 'NextDataLayerTransformFn dropped it, or the page replaced window.dataLayer',
};
const ICON: Record<State, string> = { ok: '✓', skip: '–', warn: '⚠', off: '○', info: '•' };
const MARK = { ok: 'check', warn: 'warn', skip: 'wait', off: 'wait', info: 'wait' } as const;
const SHOWS: Array<[Show, string]> = [
  ['sent', 'Sent'],
  ['skipped', 'Not sent'],
  ['problems', 'Problems'],
];
const STATED: Record<State, string> = { ok: 'Sent', warn: 'Sent with problems', skip: 'Not sent', off: '', info: '' };
const NONE: Record<Show, string> = {
  sent: 'Nothing sent yet: every decision so far stopped its event.',
  skipped: 'Every decision so far sent its event.',
  problems: 'No problems: every sent event has the fields GA4 requires and reached each data layer.',
};
const KEEP = 300;

const label = (name: EventName) => LABELS[name] ?? name;
const isAnalytics = (e: EngineEvent): e is EngineEvent<'analytics'> => e.name === 'analytics';
const isTrace = (data: unknown): data is AnalyticsTrace => (data as AnalyticsTrace | undefined)?.trace === 'analytics';
const clock = (at: number) => time(at).slice(0, 8);

const what = ({ name, params }: AnalyticsEvent) => {
  const items = itemsOf(params)
    .map((i) => {
      const name = i.item_name ?? i.item_id ?? '?';
      return `${name}${i.item_variant && i.item_variant !== name ? ` (${i.item_variant})` : ''} ×${i.quantity ?? 1}`;
    })
    .join(', ');
  if (name === 'add_to_cart') return `+ ${items}`;
  if (name === 'remove_from_cart') return `− ${items}`;
  if (items) return items;
  if (name === 'page_view') return String(params.page_title ?? '');
  return params.order_id ? `order ${params.order_id}` : '';
};

const amount = (params: Record<string, unknown>) =>
  typeof params.value === 'number'
    ? format({ type: 'money', value: params.value }, params.currency ? String(params.currency) : undefined)
    : '';

const pushedTo = (layer: Layer, id: string | undefined) =>
  id
    ? ((window as Win)[layer]?.find((p) => (p as { event_id?: unknown } | null)?.event_id === id) as
        (Record<string, unknown> & { event?: string }) | undefined)
    : undefined;

const COLUMNS = { item_name: 'item', item_variant: 'variant', item_id: 'id', quantity: 'qty', price: 'price' };

const itemsTable = (items: Item[]) => {
  const columns = (Object.keys(COLUMNS) as Array<keyof typeof COLUMNS>).filter(
    (c) => c !== 'item_variant' || items.some((i) => i.item_variant && i.item_variant !== i.item_name),
  );
  return h(
    'table',
    {},
    h('tr', {}, ...columns.map((c) => h('th', {}, COLUMNS[c]))),
    ...items.map((i) => h('tr', {}, ...columns.map((c) => h('td', c === 'item_id' ? 'dim' : {}, String(i[c] ?? ''))))),
  );
};

const chip = (state: State, text: string, title = '') =>
  h('span', { className: `chip ${state}`, title }, `${ICON[state]} ${text}`);

export function analyticsFlow(ui: {
  open: Set<string>;
  idOf: (o: object) => number;
  render: () => void;
  config: () => ProviderConfig;
}) {
  const received: EngineEvent[] = [];
  const runs: Run[] = [];

  const record = (e: EngineEvent) => {
    received.push(e);
    if (received.length > KEEP) received.shift();
  };

  const note = (entry: LogEntry) => {
    if (!isTrace(entry.data)) return;
    runs.push({ ...entry.data, at: entry.at });
    if (runs.length > KEEP) runs.shift();
  };

  const started = () => runs.length > 0 || !!(window as Win).NextDataLayer;

  const snapshot = (config: ProviderConfig) => {
    const events = new Map(received.filter(isAnalytics).map((e) => [e.data.id, e]));
    const list = providers(config, started());
    const enabled = (layer: Layer) => (layer === 'dataLayer' ? config.dataLayer : config.enabled);
    const issues = (run: Run) => {
      if (!run.sent) return [];
      const event = run.id ? events.get(run.id) : undefined;
      return [
        ...(event ? checks(event.data.name, event.data.params) : []),
        ...(['NextDataLayer', 'dataLayer'] as Layer[])
          .filter((l) => enabled(l) && !pushedTo(l, run.id))
          .map((l) => `not in ${l}`),
      ];
    };
    return {
      config,
      providers: list,
      provider: (id: string) => list.find((p) => p.id === id)!,
      event: (id?: string) => (id ? events.get(id) : undefined),
      trigger: (run: Run) => received.filter((e) => e.name === run.trigger && e.at <= run.at + 5).at(-1),
      enabled,
      issues,
    };
  };
  type Snapshot = ReturnType<typeof snapshot>;
  let show: Show = 'sent';

  const stateOf = (snap: Snapshot, run: Run): State => (!run.sent ? 'skip' : snap.issues(run).length ? 'warn' : 'ok');

  const params = (event: AnalyticsEvent) =>
    h(
      'div',
      'aparams',
      ...Object.entries(event.params)
        .filter(([, v]) => v === null || typeof v !== 'object')
        .map(([k, v]) => h('span', {}, h('i', {}, k), ` ${v}`)),
    );

  const detail = (snap: Snapshot, run: Run): Child[] => {
    const wire = WIRING.find((w) => (w.ga ?? w.dl) === run.name);
    const dl = wire?.dl ?? run.name;
    const event = snap.event(run.id)?.data;
    const trigger = snap.trigger(run);
    const pushed = pushedTo('NextDataLayer', run.id) ?? pushedTo('dataLayer', run.id);
    const key = ui.idOf(run);
    const problems = event ? checks(event.name, event.params) : [];
    const items = event ? itemsOf(event.params) : [];
    const layers = (['NextDataLayer', 'dataLayer'] as Layer[]).filter(snap.enabled).map((layer) => {
      const name = layer === 'dataLayer' ? 'GTM dataLayer' : layer;
      return pushedTo(layer, run.id) ? chip('ok', name) : chip('warn', `${name}: not pushed`, NOT_PUSHED[layer]);
    });
    const raw = [
      event && tree(h('span', 'key', 'event'), event, `ae${key}`, ui.open),
      pushed && tree(h('span', 'key', dl), pushed, `ap${key}`, ui.open),
      trigger && tree(h('span', 'key', run.trigger), trigger.data, `at${key}`, ui.open),
    ].filter(Boolean);
    const rows: Array<[string, ...Child[]]> = [
      ['Why', h('span', {}, run.reason), h('small', {}, `${label(run.trigger)}: `, h('code', {}, run.trigger))],
      ...(problems.length
        ? [['Problems', ...problems.map((p) => h('span', 'amber', `⚠ ${p}`))] as [string, ...Child[]]]
        : []),
      ...(run.sent ? [['Pushed as', h('div', 'chips', h('code', {}, dl), ...layers)] as [string, ...Child[]]] : []),
      ...(event ? [['Params', params(event)] as [string, ...Child[]]] : []),
      ...(items.length ? [['Items', h('div', 'aitems', itemsTable(items))] as [string, ...Child[]]] : []),
      ...(raw.length ? [['Raw', h('div', 'araw', ...raw)] as [string, ...Child[]]] : []),
    ];
    return [h('dl', 'adetail', ...rows.flatMap(([title, ...value]) => [h('dt', {}, title), h('dd', {}, ...value)]))];
  };

  const sub = (snap: Snapshot, run: Run) => {
    const event = snap.event(run.id)?.data;
    return !run.sent ? `Not sent: ${run.reason}` : event ? what(event) || 'sent' : 'data layer only';
  };

  const row = (snap: Snapshot, run: Run) => {
    const event = snap.event(run.id)?.data;
    return h(
      'button',
      { type: 'button', className: `arun ${stateOf(snap, run)}`, onclick: () => inspect(run) },
      icon(MARK[stateOf(snap, run)]),
      h('span', 'amain', h('code', {}, run.name), h('small', {}, `${label(run.trigger)} · ${sub(snap, run)}`)),
      h('span', 'aend', event && amount(event.params) && h('b', {}, amount(event.params)), clock(run.at)),
      icon('chevron'),
    );
  };

  let shown: Run[] = [];
  let current: Run | undefined;
  const heading = h('h2', {});
  const subtitle = h('p', {});
  const body = h('section', 'scrollbar-sm');
  const button = (text: Child, onclick: () => void, data: Record<string, string> = {}) =>
    tsugi(h('button', { type: 'button', className: 'btn', onclick }, text), data);
  const newer = button('Newer', () => move(-1), { variant: 'outline', size: 'sm' });
  const older = button('Older', () => move(1), { variant: 'outline', size: 'sm' });
  const close = button(icon('close'), () => dialog.close(), { variant: 'ghost', size: 'icon-sm' });
  close.setAttribute('aria-label', 'Close dialog');
  const dialog = tsugi(
    h(
      'dialog',
      'dialog aevent',
      h(
        'div',
        {},
        h('header', {}, heading, subtitle),
        body,
        h(
          'footer',
          {},
          newer,
          older,
          button('Done', () => dialog.close()),
        ),
        close,
      ),
    ),
    { size: 'lg' },
  );
  dialog.addEventListener('click', (e) => e.target === dialog && dialog.close());
  dialog.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    move(e.key === 'ArrowUp' ? -1 : 1);
  });

  const fill = (snap: Snapshot) => {
    if (!current || !dialog.open) return;
    const run = current;
    const state = stateOf(snap, run);
    const event = snap.event(run.id)?.data;
    const at = shown.indexOf(run);
    heading.replaceChildren(icon(MARK[state]), h('code', {}, run.name));
    heading.className = `ahead ${state}`;
    subtitle.replaceChildren(
      [label(run.trigger), clock(run.at), event && amount(event.params), STATED[state]].filter(Boolean).join(' · '),
    );
    body.replaceChildren(...nodes(detail(snap, run)));
    newer.disabled = at <= 0;
    older.disabled = at < 0 || at >= shown.length - 1;
  };

  const inspect = (run: Run) => {
    current = run;
    if (!dialog.open) dialog.showModal();
    body.scrollTop = 0;
    fill(snapshot(ui.config()));
  };

  const move = (by: number) => {
    const next = shown[shown.indexOf(current!) + by];
    if (next) inspect(next);
  };

  const filters = (counts: Record<Show, number>) => {
    const group = h(
      'div',
      'button-group',
      ...SHOWS.map(([value, text]) => {
        const el = tsugi(
          h(
            'button',
            {
              type: 'button',
              className: 'btn',
              onclick: () => {
                show = value;
                ui.render();
              },
            },
            `${text} ${counts[value]}`,
          ),
          { variant: 'outline', size: 'sm' },
        );
        el.setAttribute('aria-pressed', String(value === show));
        return el;
      }),
    );
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', 'Show events');
    return group;
  };

  const goesTo = (snap: Snapshot) =>
    h(
      'div',
      'agoes',
      h('span', {}, 'Goes to'),
      ...snap.providers
        .filter((p) => p.id !== 'listeners')
        .map((p) => chip(p.status, `${p.name} · ${p.short}`, p.detail)),
    );

  const flows = () =>
    expandable(
      [`All workflows · ${WIRING.length}`],
      'flows',
      ui.open,
      () =>
        WIRING.map((w) =>
          h(
            'div',
            'flow',
            w.from.map(label).join(' or '),
            ' → ',
            w.ga ? h('code', 'ga-name', w.ga) : h('span', 'dim', 'no analytics event'),
            ' → ',
            h('code', 'dl', w.dl),
          ),
        ),
      'more',
    );

  const view = (query: string): Child[] => {
    const snap = snapshot(ui.config());
    const matching = runs.filter((r) =>
      `${r.name} ${r.trigger} ${label(r.trigger)} ${r.reason}`.toLowerCase().includes(query),
    );
    const of: Record<Show, Run[]> = {
      sent: matching.filter((r) => r.sent),
      skipped: matching.filter((r) => !r.sent),
      problems: matching.filter((r) => stateOf(snap, r) === 'warn'),
    };
    const list = [...of[show]].reverse();
    shown = list;
    fill(snap);
    return [
      h('div', 'vhead', filters({ sent: of.sent.length, skipped: of.skipped.length, problems: of.problems.length })),
      goesTo(snap),
      ...snap.providers.filter((p) => p.status === 'warn').map((p) => h('div', 'alert', `⚠ ${p.detail}`)),
      list.length
        ? h('div', 'alog', ...list.map((run) => row(snap, run)))
        : runs.length
          ? h('p', 'anone', query ? 'Nothing matches the filter.' : NONE[show])
          : empty(
              'Nothing sent yet',
              snap.config.enabled ? 'Analytics starts once the page is idle.' : snap.provider('NextDataLayer').detail,
            ),
      flows(),
    ];
  };

  const summary = () => {
    const snap = snapshot(ui.config());
    const ga = runs.filter((r) => r.sent && !r.name.startsWith('dl_')).length;
    const problems =
      runs.filter((r) => snap.issues(r).length).length + snap.providers.filter((p) => p.status === 'warn').length;
    return `${ga} sent${problems ? ` · ⚠ ${problems}` : ''}`;
  };

  return { record, note, view, summary, dialog };
}
