import type { EngineEvent } from '../engine/events';
import type { LogEntry } from '../engine/log';
import type { AnalyticsEvent, AnalyticsName, AnalyticsTrace, EventName } from '../engine/types';
import { format } from '../engine/format';
import { type Child, empty, expandable, h, time, tree } from './view';

export const ANALYTICS_CSS = `.wf-sum{display:flex;flex-wrap:wrap;gap:4px 14px;margin:2px 0 8px;font:13px var(--sans);color:var(--muted)}
.wf-sum b{font-weight:600;color:var(--fg)}
.wf-sum .bad b{color:var(--amber)}
.alert{margin:0 0 8px;padding:6px 10px;border:1px solid var(--amber);border-radius:8px;color:var(--amber);font:12px/1.4 var(--sans)}
.wf{display:grid;grid-template-columns:minmax(0,210px) minmax(0,1fr);gap:10px;align-items:start;font-family:var(--sans)}
@media (max-width:520px){.wf{grid-template-columns:minmax(0,1fr)}}
.runs{overflow:hidden;border:1px solid var(--line);border-radius:10px}
.rhead{display:flex;justify-content:space-between;gap:8px;padding:8px 10px 2px;font:600 11px var(--sans);color:var(--muted)}
.rhead+.run,.run+.run{border-top:0}
.run{display:grid;grid-template-columns:16px minmax(0,1fr);gap:6px;width:100%;padding:5px 10px;border-radius:0;text-align:left}
.run:hover{background:var(--hover)}
.run.on{background:var(--hover);box-shadow:inset 3px 0 var(--blue)}
.run code{font:600 12px var(--mono);color:var(--orange)}
.run small{display:block;overflow:hidden;font:11px var(--sans);color:var(--muted);white-space:nowrap;text-overflow:ellipsis}
.run.skip code,.run.skip .ricon{color:var(--muted);font-weight:400}
.ricon{text-align:center}.run.ok .ricon{color:var(--green)}.run.warn .ricon{color:var(--amber)}
.steps{position:sticky;top:0;padding:12px 12px 2px;background:var(--raised);border:1px solid var(--line);border-radius:10px}
.step{position:relative;display:grid;grid-template-columns:22px minmax(0,1fr);gap:10px;padding-bottom:12px}
.step:not(:last-child)::after{content:'';position:absolute;left:10px;top:24px;bottom:0;border-left:1px solid var(--line)}
.dot{display:grid;place-items:center;width:22px;height:22px;border:1px solid var(--line);border-radius:50%;background:var(--bg);font-size:12px}
.step.ok .dot{color:var(--green);border-color:var(--green)}
.step.warn .dot{color:var(--amber);border-color:var(--amber)}
.step.off .dot{color:var(--muted);border-style:dashed}
.step.skip .dot,.step.skip .stitle,.step.skip .sdetail{color:var(--muted)}
.stitle{font:600 13px var(--sans)}
.stitle code{margin-left:8px;font:400 12px var(--mono);color:var(--muted)}
.sdetail{font:12px/1.5 var(--sans)}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}
.chip{padding:0 8px;border:1px solid var(--line);border-radius:999px;font:12px var(--sans)}
.chip.ok{color:var(--green);border-color:var(--green)}
.chip.warn{color:var(--amber);border-color:var(--amber)}
.chip.off{color:var(--muted);border-style:dashed}
.sdata>summary{padding:2px 0;font:12px var(--sans);color:var(--blue)}
.sdata[open]{font:12px/1.6 var(--mono)}
.facts{display:flex;flex-wrap:wrap;gap:2px 14px}
table{width:100%;margin:6px 0;border-collapse:collapse}
th,td{padding:2px 8px 2px 0;text-align:left;border-bottom:1px solid var(--line)}
th{font:600 11px var(--sans);color:var(--muted)}
.more{margin-top:12px}
.more>summary{font:12px var(--sans);color:var(--muted)}
.flow{margin:3px 0 3px 14px;font:12px var(--sans)}
.flow code{font:12px var(--mono)}`;

export interface ProviderConfig {
  enabled: boolean;
  nextCampaign: boolean;
  dataLayer: boolean;
  unsupported: string[];
}

export interface Provider {
  id: string;
  status: 'ok' | 'off' | 'warn' | 'info';
  name: string;
  short: string;
  detail: string;
}

type EngineName = Exclude<EventName, 'analytics'>;
type Item = Record<string, unknown>;
type Layer = 'NextDataLayer' | 'dataLayer';
type State = 'ok' | 'skip' | 'warn' | 'off';
type Run = AnalyticsTrace & { at: number };
type Win = Window &
  Partial<Record<Layer, unknown[]>> & {
    google_tag_manager?: Record<string, unknown>;
    nextCampaign?: { event?: unknown };
    NextDataLayerTransformFn?: unknown;
  };

export interface Wire {
  from: EngineName[];
  ga?: AnalyticsName;
  dl: string;
}

export const WIRING: Wire[] = [
  { from: ['ready'], ga: 'page_view', dl: 'dl_user_data' },
  { from: ['ready'], ga: 'view_item', dl: 'dl_view_item' },
  { from: ['ready'], ga: 'view_item_list', dl: 'dl_view_item_list' },
  { from: ['ready', 'cart.calculated'], ga: 'add_to_cart', dl: 'dl_add_to_cart' },
  { from: ['ready', 'cart.calculated', 'cart.updated'], ga: 'remove_from_cart', dl: 'dl_remove_from_cart' },
  { from: ['cart.calculated'], ga: 'update_cart', dl: 'dl_cart_updated' },
  { from: ['checkout.started'], ga: 'begin_checkout', dl: 'dl_begin_checkout' },
  { from: ['checkout.shipping-added'], ga: 'add_shipping_info', dl: 'dl_add_shipping_info' },
  { from: ['checkout.payment-added'], ga: 'add_payment_info', dl: 'dl_add_payment_info' },
  { from: ['order.loaded'], ga: 'purchase', dl: 'dl_purchase' },
  { from: ['order.loaded'], ga: 'upsell_purchase', dl: 'dl_upsell_purchase' },
  { from: ['upsell.viewed'], ga: 'view_upsell', dl: 'dl_viewed_upsell' },
  { from: ['upsell.skipped'], ga: 'skip_upsell', dl: 'dl_skipped_upsell' },
  { from: ['exit-intent.shown'], dl: 'dl_exit_intent_shown' },
  { from: ['exit-intent.clicked'], dl: 'dl_exit_intent_accepted' },
  { from: ['exit-intent.dismissed'], dl: 'dl_exit_intent_dismissed' },
  { from: ['exit-intent.closed'], dl: 'dl_exit_intent_closed' },
  { from: ['exit-intent.action'], dl: 'dl_exit_intent_action' },
];

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

const NEEDS_ITEMS = new Set([
  'view_item',
  'view_item_list',
  'add_to_cart',
  'remove_from_cart',
  'begin_checkout',
  'add_shipping_info',
  'add_payment_info',
  'purchase',
  'upsell_purchase',
]);
const UNSUPPORTED: Record<string, string> = {
  facebook: 'Meta Pixel',
  rudderstack: 'RudderStack',
  custom: 'Custom endpoint',
};
const NOT_PUSHED: Record<Layer, string> = {
  NextDataLayer: 'NextDataLayerTransformFn dropped it, or the page replaced window.NextDataLayer',
  dataLayer: 'NextDataLayerTransformFn dropped it, or the page replaced window.dataLayer',
};
const ICON: Record<State, string> = { ok: '✓', skip: '–', warn: '⚠', off: '○' };
const NEXT_SCRIPT = 'script[src^="https://campaigns.apps.29next.com/js/v1/campaign/"]';
const KEEP = 300;

const label = (name: EventName) => LABELS[name] ?? name;
const isAnalytics = (e: EngineEvent): e is EngineEvent<'analytics'> => e.name === 'analytics';
const isTrace = (data: unknown): data is AnalyticsTrace => (data as AnalyticsTrace | undefined)?.trace === 'analytics';
const itemsOf = (params: Record<string, unknown>) => (Array.isArray(params.items) ? (params.items as Item[]) : []);
const clock = (at: number) => time(at).slice(0, 8);

export function checks(name: string, params: Record<string, unknown>): string[] {
  const items = Array.isArray(params.items) ? (params.items as Item[]) : undefined;
  return [
    NEEDS_ITEMS.has(name) && !items?.length && 'items is empty',
    items?.some((i) => !i.item_id && !i.item_name) && 'an item has neither item_id nor item_name',
    params.value !== undefined && !params.currency && 'value is set without currency',
    name.endsWith('purchase') && !params.transaction_id && 'transaction_id is missing',
  ].filter((p): p is string => !!p);
}

export function providers(config: ProviderConfig, started: boolean): Provider[] {
  const win = window as Win;
  const p = (id: string, status: Provider['status'], name: string, short: string, detail: string): Provider => ({
    id,
    status,
    name,
    short,
    detail,
  });
  const extra = [
    ...config.unsupported.map((id) => {
      const name = UNSUPPORTED[id] ?? id;
      return p(
        id,
        'warn',
        name,
        'not built in',
        `${name} is on in nextConfig, but the SDK no longer sends to it. Add it as a GTM tag.`,
      );
    }),
    ...(typeof win.NextDataLayerTransformFn === 'function'
      ? [
          p(
            'transform',
            'info',
            'NextDataLayerTransformFn',
            'set',
            'NextDataLayerTransformFn can change or drop each dl_* event.',
          ),
        ]
      : []),
  ];
  if (!config.enabled) {
    const off = 'Analytics is off: nextConfig.analytics.enabled is false.';
    return [
      p('NextDataLayer', 'off', 'NextDataLayer', 'off', off),
      p('dataLayer', 'off', 'GTM dataLayer', 'off', off),
      p('listeners', 'off', 'Page scripts', 'off', off),
      p('nextCampaign', 'off', 'NEXT analytics', 'off', off),
      ...extra,
    ];
  }
  const idle = 'Starts once the page is idle.';
  const events = win.NextDataLayer?.length ?? 0;
  const containers = Object.keys(win.google_tag_manager ?? {}).filter((k) => k.startsWith('GTM-'));
  return [
    started
      ? p('NextDataLayer', 'ok', 'NextDataLayer', `${events} events`, `window.NextDataLayer has ${events} dl_* events.`)
      : p('NextDataLayer', 'off', 'NextDataLayer', 'waits for idle', idle),
    !config.dataLayer
      ? p('dataLayer', 'off', 'GTM dataLayer', 'off', 'Off in nextConfig: analytics.providers.gtm.enabled is false.')
      : containers.length
        ? p('dataLayer', 'ok', 'GTM dataLayer', containers[0]!, `window.dataLayer, read by ${containers.join(', ')}.`)
        : p(
            'dataLayer',
            'warn',
            'GTM dataLayer',
            'no GTM container',
            'GTM dataLayer is on, but this page has no GTM container.',
          ),
    p(
      'listeners',
      'info',
      'Page scripts',
      "next.on('analytics')",
      "Page scripts get every event with next.on('analytics', fn).",
    ),
    !config.nextCampaign
      ? p(
          'nextCampaign',
          'off',
          'NEXT analytics',
          'off',
          'Off in nextConfig: analytics.providers.nextCampaign.enabled is false.',
        )
      : typeof win.nextCampaign?.event === 'function'
        ? p('nextCampaign', 'ok', 'NEXT analytics', 'own page_view', 'Its own script sends page_view.')
        : started
          ? p(
              'nextCampaign',
              'warn',
              'NEXT analytics',
              'not loaded',
              `NEXT analytics is on, but its script ${document.querySelector(NEXT_SCRIPT) ? 'did not load' : 'is not on the page'}.`,
            )
          : p('nextCampaign', 'off', 'NEXT analytics', 'waits for idle', idle),
    ...extra,
  ];
}

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
