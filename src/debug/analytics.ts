import type { EngineEvent } from '../engine/events';
import type { LogEntry } from '../engine/log';
import type { AnalyticsEvent, AnalyticsTrace, EventName } from '../engine/events';
import { format } from '../engine/format';
import { checks, type Item, itemsOf, type Layer, type ProviderConfig, providers, type Win, WIRING } from './providers';
import { type Child, empty, expandable, h, time, tree } from './view';

type State = 'ok' | 'skip' | 'warn' | 'off';
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
const ICON: Record<State, string> = { ok: '✓', skip: '–', warn: '⚠', off: '○' };
const KEEP = 300;

const label = (name: EventName) => LABELS[name] ?? name;
const isAnalytics = (e: EngineEvent): e is EngineEvent<'analytics'> => e.name === 'analytics';
const isTrace = (data: unknown): data is AnalyticsTrace => (data as AnalyticsTrace | undefined)?.trace === 'analytics';
const clock = (at: number) => time(at).slice(0, 8);

const what = ({ name, params }: AnalyticsEvent) => {
  const items = itemsOf(params)
    .map((i) => `${i.item_name ?? i.item_id ?? '?'} ×${i.quantity ?? 1}`)
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

const itemsTable = (items: Item[]) =>
  h(
    'table',
    {},
    h('tr', {}, ...['item', 'id', 'qty', 'price'].map((t) => h('th', {}, t))),
    ...items.map((i) =>
      h(
        'tr',
        {},
        ...[i.item_name, i.item_id, i.quantity, i.price].map((v, col) =>
          h('td', col === 1 ? 'dim' : {}, String(v ?? '')),
        ),
      ),
    ),
  );

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
  let selected: Run | undefined;

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

  const choose = (run: Run) => {
    selected = run;
    ui.render();
  };

  const groups = (list: Run[]) => {
    const out: Array<{ trigger: EventName; at: number; runs: Run[] }> = [];
    for (const run of list) {
      const last = out.at(-1);
      if (last && last.trigger === run.trigger && run.at - last.at <= 5) last.runs.push(run);
      else out.push({ trigger: run.trigger, at: run.at, runs: [run] });
    }
    for (const g of out) g.runs.sort((a, b) => Number(b.sent) - Number(a.sent));
    return out.reverse();
  };

  const runList = (snap: Snapshot, list: Run[]) =>
    h(
      'div',
      'runs',
      ...groups(list).flatMap((g) => [
        h('div', 'rhead', h('span', {}, label(g.trigger)), h('span', {}, clock(g.at))),
        ...g.runs.map((run) => {
          const state: State = !run.sent ? 'skip' : snap.issues(run).length ? 'warn' : 'ok';
          const event = snap.event(run.id);
          const sub = !run.sent
            ? 'not sent'
            : event
              ? [what(event.data), amount(event.data.params)].filter(Boolean).join(' · ') || 'sent'
              : 'data layer only';
          return h(
            'button',
            { type: 'button', className: `run ${state}${run === selected ? ' on' : ''}`, onclick: () => choose(run) },
            h('span', 'ricon', ICON[state]),
            h('span', {}, h('code', {}, run.name), h('small', {}, sub)),
          );
        }),
      ]),
    );

  const step = (
    state: State,
    title: string,
    code: string,
    detail: Child,
    extra?: Child,
    data?: [string, () => Child[]],
  ) =>
    h(
      'div',
      `step ${state}`,
      h('span', 'dot', ICON[state]),
      h(
        'div',
        {},
        h('div', 'stitle', title, code && h('code', {}, code)),
        detail && h('div', 'sdetail', detail),
        extra,
        data && expandable(['Data'], data[0], ui.open, data[1], 'sdata'),
      ),
    );

  const steps = (snap: Snapshot, run: Run) => {
    const wire = WIRING.find((w) => (w.ga ?? w.dl) === run.name);
    const dl = wire?.dl ?? run.name;
    const direct = !wire?.ga;
    const trigger = snap.trigger(run);
    const event = snap.event(run.id);
    const key = ui.idOf(run);
    const fields = event ? checks(event.data.name, event.data.params) : [];
    const notRun = (title: string) => step('skip', title, '', 'Not run');

    const triggered = step(
      'ok',
      'Trigger',
      run.trigger,
      `${label(run.trigger)} at ${clock(run.at)}`,
      undefined,
      trigger && [`t${key}`, () => [tree(h('span', 'key', run.trigger), trigger.data, `td${key}`, ui.open)]],
    );
    const decided = step(run.sent ? 'ok' : 'skip', 'Decide', '', `${run.sent ? 'Send' : 'Stop'}: ${run.reason}`);
    if (!run.sent) return [triggered, decided, notRun('Build'), notRun('Push'), notRun('Deliver')];

    const built = direct
      ? step('off', 'Build', '', 'No analytics event: the data layer gets this directly')
      : step(
          fields.length ? 'warn' : 'ok',
          'Build',
          run.name,
          event && [what(event.data), amount(event.data.params)].filter(Boolean).join(' · '),
          fields.length
            ? h('div', 'amber', ...fields.map((f) => h('div', {}, `⚠ ${f}`)))
            : h('div', 'green', '✓ Has every field GA4 requires'),
          event && [
            `b${key}`,
            () => [
              h(
                'div',
                'facts',
                ...Object.entries(event.data.params)
                  .filter(([, v]) => v === null || typeof v !== 'object')
                  .map(([k, v]) => h('span', {}, h('span', 'key', k), ` ${v}`)),
              ),
              itemsOf(event.data.params).length > 0 && itemsTable(itemsOf(event.data.params)),
              tree(h('span', 'key', 'raw'), event.data, `br${key}`, ui.open),
            ],
          ],
        );

    const layers = (['NextDataLayer', 'dataLayer'] as Layer[]).map((layer) => {
      const name = layer === 'dataLayer' ? 'GTM dataLayer' : layer;
      if (!snap.enabled(layer)) return chip('off', `${name}: off`, snap.provider(layer).detail);
      return pushedTo(layer, run.id) ? chip('ok', name) : chip('warn', `${name}: not pushed`, NOT_PUSHED[layer]);
    });
    const object = pushedTo('NextDataLayer', run.id) ?? pushedTo('dataLayer', run.id);
    const pushed = step(
      layers.some((c) => c.classList.contains('warn')) ? 'warn' : 'ok',
      'Push',
      dl,
      null,
      h('div', 'chips', ...layers),
      object && [`p${key}`, () => [tree(h('span', 'key', dl), object, `pr${key}`, ui.open)]],
    );

    const status = (id: string, ok: string) => {
      const p = snap.provider(id);
      const state: State = p.status === 'ok' || p.status === 'info' ? 'ok' : p.status === 'warn' ? 'warn' : 'off';
      return chip(state, state === 'ok' ? ok : `${p.name}: ${p.short}`, p.detail);
    };
    const receivers = [
      !direct && status('listeners', "Page scripts (next.on('analytics'))"),
      status('dataLayer', `GTM ${snap.provider('dataLayer').short} → GA4, Meta…`),
      run.name === 'page_view' && status('nextCampaign', 'NEXT analytics (own page_view)'),
    ].filter((c): c is HTMLSpanElement => !!c);
    const delivered = step(
      receivers.some((c) => c.classList.contains('warn')) ? 'warn' : 'ok',
      'Deliver',
      '',
      null,
      h('div', 'chips', ...receivers),
    );
    return [triggered, decided, built, pushed, delivered];
  };

  const flows = () =>
    expandable(
      ['All workflows', h('span', 'n', String(WIRING.length))],
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
    const list = runs.filter((r) =>
      `${r.name} ${r.trigger} ${label(r.trigger)} ${r.reason}`.toLowerCase().includes(query),
    );
    const sent = runs.filter((r) => r.sent);
    const ga = sent.filter((r) => !r.name.startsWith('dl_')).length;
    const problems = sent.filter((r) => snap.issues(r).length).length;
    const off = snap.providers.filter((p) => p.status === 'off' && p.id !== 'listeners').length;
    if (!list.includes(selected!)) selected = [...list].reverse().find((r) => r.sent) ?? list.at(-1);
    return [
      h(
        'div',
        'wf-sum',
        h('span', {}, h('b', {}, String(ga)), ` GA4 event${ga === 1 ? '' : 's'} sent`),
        h('span', problems ? 'bad' : '', h('b', {}, String(problems)), ` problem${problems === 1 ? '' : 's'}`),
        off > 0 && h('span', {}, h('b', {}, String(off)), ` provider${off === 1 ? '' : 's'} off`),
      ),
      ...snap.providers.filter((p) => p.status === 'warn').map((p) => h('div', 'alert', `⚠ ${p.detail}`)),
      selected
        ? h('div', 'wf', runList(snap, list), h('div', 'steps', ...steps(snap, selected)))
        : empty(
            query ? 'Nothing matches' : 'Nothing sent yet',
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

  return { record, note, view, summary };
}
