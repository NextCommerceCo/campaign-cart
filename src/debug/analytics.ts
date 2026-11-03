import type { EngineEvent } from '../engine/events';
import type { AnalyticsEvent, AnalyticsName, EventName } from '../engine/types';
import { format } from '../engine/values';
import { drawGraph, GRAPH_CSS, type GraphEdge, type GraphNode } from './graph';
import { type Child, empty, expandable, h, time, tree } from './view';

export const ANALYTICS_CSS = `.headline{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px 12px;margin:2px 0 8px;font:13px var(--sans)}
.switch{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);cursor:pointer}
.alert{margin:0 0 8px;padding:6px 10px;border:1px solid var(--amber);border-radius:8px;color:var(--amber);font:12px/1.4 var(--sans)}
.cols{display:grid;grid-template-columns:172fr 230fr 138fr;margin-top:4px;font:600 11px var(--sans);color:var(--muted)}
.tip,.why{font:12px/1.5 var(--sans);color:var(--muted)}
.why{margin:0 0 6px}
.detail{margin:4px 0 12px;padding:10px 12px;background:var(--raised);border:1px solid var(--line);border-radius:10px}
.dhead{display:flex;align-items:baseline;gap:8px;margin-bottom:4px;font:600 13px var(--sans)}
.dhead .code{font:400 11px var(--mono);color:var(--muted)}
.dhead .link{margin-left:auto;font-weight:400}
.line{margin:3px 0}
.ga-name{font-weight:600;color:var(--orange)}
.dl{color:var(--purple);overflow-wrap:anywhere}
.sdk-name{color:var(--blue)}
.n{margin-left:6px;padding:0 6px;border-radius:999px;background:var(--hover);color:var(--fg);font-size:11px}
.fail{margin-left:8px;color:var(--amber)}.pass{margin-left:8px;color:var(--green)}
.send{border-top:1px solid var(--line)}
.send>summary{display:grid;grid-template-columns:12px 96px minmax(0,1fr) 84px 18px;gap:8px;align-items:baseline;border-radius:0}
.send .fail,.send .pass{margin:0}
.what{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.amount{text-align:right;font-variant-numeric:tabular-nums}
.send-body{padding:2px 8px 10px 24px}
.facts{display:flex;flex-wrap:wrap;gap:2px 14px}
table{width:100%;margin:6px 0;border-collapse:collapse}
th,td{padding:2px 8px 2px 0;text-align:left;border-bottom:1px solid var(--line)}
th{font:600 11px var(--sans);color:var(--muted)}
.route{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}
.push{padding:0 8px;border:1px solid var(--line);border-radius:999px;color:var(--muted)}
.push.ok{color:var(--purple);border-color:var(--purple)}
.more{margin-top:10px}
.more>summary{font:12px var(--sans);color:var(--muted)}
.other>summary .desc{margin-left:8px;font-family:var(--sans);color:var(--muted)}
.idle>summary{opacity:.5}
${GRAPH_CSS}`;

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
type Route = Record<Layer, string | undefined>;
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
  why?: string;
}

export const WIRING: Wire[] = [
  { from: ['ready'], ga: 'page_view', dl: 'dl_user_data' },
  { from: ['ready'], ga: 'view_item', dl: 'dl_view_item', why: 'Only when the page shows one package.' },
  { from: ['ready'], ga: 'view_item_list', dl: 'dl_view_item_list', why: 'Only when the page shows several packages.' },
  {
    from: ['ready', 'cart.calculated'],
    ga: 'add_to_cart',
    dl: 'dl_add_to_cart',
    why: 'What was added since the last report, at the cart price.',
  },
  {
    from: ['ready', 'cart.calculated', 'cart.updated'],
    ga: 'remove_from_cart',
    dl: 'dl_remove_from_cart',
    why: 'What was removed since the last report. From a cart change only when the cart empties.',
  },
  {
    from: ['cart.calculated'],
    ga: 'update_cart',
    dl: 'dl_cart_updated',
    why: 'The whole cart, after each price update.',
  },
  { from: ['checkout.started'], ga: 'begin_checkout', dl: 'dl_begin_checkout' },
  { from: ['checkout.shipping-added'], ga: 'add_shipping_info', dl: 'dl_add_shipping_info' },
  { from: ['checkout.payment-added'], ga: 'add_payment_info', dl: 'dl_add_payment_info' },
  { from: ['order.loaded'], ga: 'purchase', dl: 'dl_purchase', why: 'Once per order, only when paid.' },
  { from: ['order.loaded'], ga: 'upsell_purchase', dl: 'dl_upsell_purchase', why: 'Once per accepted upsell.' },
  { from: ['upsell.viewed'], ga: 'view_upsell', dl: 'dl_viewed_upsell' },
  { from: ['upsell.skipped'], ga: 'skip_upsell', dl: 'dl_skipped_upsell' },
  { from: ['exit-intent.shown'], dl: 'dl_exit_intent_shown' },
  { from: ['exit-intent.clicked'], dl: 'dl_exit_intent_accepted' },
  { from: ['exit-intent.dismissed'], dl: 'dl_exit_intent_dismissed' },
  { from: ['exit-intent.closed'], dl: 'dl_exit_intent_closed' },
  { from: ['exit-intent.action'], dl: 'dl_exit_intent_action' },
];

export const ENGINE: Record<EngineName, string> = {
  ready: 'Once, when the campaign and the page’s values are in',
  'campaign.loaded': 'Snapshot, then the fresh campaign',
  'cart.updated': 'The shopper changed lines, coupons or shipping',
  'cart.calculated': 'Server totals arrived',
  'coupon.refused': 'The server gives no discount for a code',
  'selection.changed': 'A bundle pick, quantity or slot changed',
  'shipping.changed': 'The shipping method changed',
  'storage.degraded': 'Browser storage is blocked or full',
  'checkout.started': 'Once, when the checkout form is bound',
  'checkout.shipping-added': 'Once, when the address is complete',
  'checkout.payment-added': 'Once, when payment details are complete',
  'prospect.saved': 'Once per tab, when the prospect cart is saved',
  'order.placed': 'The order was created',
  'order.loaded': 'On post-purchase pages',
  'upsell.viewed': 'An upsell offer was shown',
  'upsell.accepted': 'An upsell was accepted',
  'upsell.skipped': 'An upsell was skipped',
  'exit-intent.shown': 'The exit popup opened',
  'exit-intent.clicked': 'The exit popup was clicked',
  'exit-intent.dismissed': 'The exit popup was dismissed',
  'exit-intent.closed': 'The exit popup closed',
  'exit-intent.action': 'The exit popup offer was used',
  error: 'An SDK action failed',
};

const LABELS: Partial<Record<EngineName, string>> = {
  ready: 'Page loaded',
  'cart.calculated': 'Cart priced',
  'cart.updated': 'Cart changed',
  'checkout.started': 'Checkout opened',
  'checkout.shipping-added': 'Shipping filled in',
  'checkout.payment-added': 'Payment chosen',
  'order.loaded': 'Order loaded',
  'upsell.viewed': 'Upsell shown',
  'upsell.skipped': 'Upsell skipped',
};

const CUSTOM = new Set<string>(['update_cart', 'upsell_purchase', 'view_upsell', 'skip_upsell']);
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
const LAYERS: Layer[] = ['NextDataLayer', 'dataLayer'];
const NEXT_SCRIPT = 'script[src^="https://campaigns.apps.29next.com/js/v1/campaign/"]';
const KEEP = 300;
const GA_WIRES = WIRING.filter((w): w is Wire & { ga: AnalyticsName } => !!w.ga);
const EXITS = WIRING.filter((w) => !w.ga);
const TRIGGERS = [...new Set(GA_WIRES.flatMap((w) => w.from))];
const EXIT_NODE = 'e:exit-intent.*';
const FROM_GA = ['NextDataLayer', 'dataLayer', 'listeners'];

const isAnalytics = (e: EngineEvent): e is EngineEvent<'analytics'> => e.name === 'analytics';
const itemsOf = (params: Record<string, unknown>) => (Array.isArray(params.items) ? (params.items as Item[]) : []);
const count = (n: number) => n > 0 && h('span', 'n', String(n));

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

const pushed = (id: string): Route => {
  const win = window as Win;
  const find = (layer: Layer) =>
    (win[layer]?.find((p) => (p as { event_id?: unknown } | null)?.event_id === id) as { event?: string } | undefined)
      ?.event;
  return { NextDataLayer: find('NextDataLayer'), dataLayer: find('dataLayer') };
};

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

export function analyticsFlow(ui: {
  open: Set<string>;
  idOf: (o: object) => number;
  render: () => void;
  config: () => ProviderConfig;
}) {
  const received: EngineEvent[] = [];
  let selected: string | undefined;
  let everything = false;
  let reveal = false;

  const record = (e: EngineEvent) => {
    received.push(e);
    if (received.length > KEEP) received.shift();
  };

  const sent = () => received.filter(isAnalytics);
  const started = () => sent().length > 0 || !!(window as Win).NextDataLayer;
  const select = (id: string | undefined) => {
    selected = id;
    reveal = !!id;
    ui.render();
  };

  const snapshot = (config: ProviderConfig) => {
    const win = window as Win;
    const fired = new Map<string, number>();
    for (const e of received) fired.set(e.name, (fired.get(e.name) ?? 0) + 1);
    const routes = new Map(sent().map((e) => [e.data.id, pushed(e.data.id)]));
    const active = LAYERS.filter(
      (l) => (l === 'dataLayer' ? config.dataLayer : true) && [...routes.values()].some((r) => r[l]),
    );
    return {
      fired: (name: string) => fired.get(name) ?? 0,
      sends: (ga: string) => sent().filter((e) => e.data.name === ga),
      route: (e: EngineEvent<'analytics'>) => routes.get(e.data.id)!,
      active,
      pushes: (layer: Layer, dl: string) =>
        (win[layer] ?? []).filter((p) => (p as { event?: unknown } | null)?.event === dl).length,
      providers: providers(config, started()),
    };
  };
  type Snapshot = ReturnType<typeof snapshot>;

  const problems = (e: EngineEvent<'analytics'>, route: Route, active: Layer[]) => [
    ...checks(e.data.name, e.data.params),
    ...active.filter((l) => !route[l]).map((l) => `not in ${l}`),
  ];

  const sendRow = (e: EngineEvent<'analytics'>, route: Route, active: Layer[]) => {
    const { id, params, context } = e.data;
    const found = problems(e, route, active);
    const items = itemsOf(params);
    return expandable(
      [
        h('span', 'time', time(e.at)),
        h('span', 'what', what(e.data)),
        h('span', 'amount', amount(params)),
        found.length
          ? h('span', { className: 'fail', title: found.join('\n') }, '⚠')
          : h('span', { className: 'pass', title: 'Required GA4 fields present, and pushed' }, '✓'),
      ],
      `a${ui.idOf(e)}`,
      ui.open,
      () => [
        h(
          'div',
          'send-body',
          h(
            'div',
            'facts',
            ...Object.entries(params)
              .filter(([, v]) => v === null || typeof v !== 'object')
              .map(([k, v]) => h('span', {}, h('span', 'key', k), ` ${v}`)),
          ),
          items.length > 0 && itemsTable(items),
          ...(found.length
            ? found.map((p) => h('div', 'amber', `⚠ ${p}`))
            : [h('div', 'green', '✓ Required GA4 fields are present')]),
          h(
            'div',
            'route',
            ...LAYERS.map((layer) =>
              h(
                'span',
                route[layer] ? 'push ok' : 'push',
                `${layer} ${route[layer] ? `✓ ${route[layer]}` : 'not pushed'}`,
              ),
            ),
          ),
          tree(h('span', 'key', 'raw'), { id, params, context }, `r${ui.idOf(e)}`, ui.open),
        ),
      ],
      'send',
    );
  };

  const model = (snap: Snapshot) => {
    const status = (id: string) => snap.providers.find((p) => p.id === id)?.status;
    const sends = (ga: string) => snap.sends(ga).length;
    const shownGa = GA_WIRES.filter((w) => everything || sends(w.ga) > 0);
    const shown = new Set<string>(shownGa.map((w) => w.ga));
    const exits = EXITS.reduce((n, w) => n + snap.fired(w.from[0]!), 0);
    const engines = TRIGGERS.filter(
      (t) => everything || (snap.fired(t) > 0 && GA_WIRES.some((w) => w.from.includes(t) && shown.has(w.ga))),
    );
    const nodes: GraphNode[] = [
      ...engines.map((name): GraphNode => ({
        id: `e:${name}`,
        col: 0,
        label: LABELS[name] ?? name,
        keys: name,
        tone: snap.fired(name) ? 'engine' : 'idle',
        count: snap.fired(name),
        title: `${name}: ${ENGINE[name]}`,
      })),
      ...(everything || exits
        ? [
            {
              id: EXIT_NODE,
              col: 0 as const,
              label: 'Exit popup',
              keys: 'exit-intent',
              tone: exits ? ('engine' as const) : ('idle' as const),
              count: exits,
              title: 'exit-intent.*: data layer only, no GA4 event',
            },
          ]
        : []),
      ...shownGa.map((w): GraphNode => ({
        id: `a:${w.ga}`,
        col: 1,
        label: w.ga,
        keys: w.dl,
        tone: sends(w.ga) ? 'ga' : 'idle',
        count: sends(w.ga),
        flag: snap.sends(w.ga).some((e) => problems(e, snap.route(e), snap.active).length > 0),
        title: `${w.ga} → ${w.dl}${w.why ? `. ${w.why}` : ''}`,
      })),
      ...(shownGa.length
        ? [
            {
              id: 'bus',
              col: 'bus' as const,
              label: '',
              tone: sent().length ? ('ga' as const) : ('idle' as const),
              title: '',
            },
          ]
        : []),
      ...snap.providers
        .filter((p) => p.id !== 'transform')
        .map((p): GraphNode => ({
          id: `d:${p.id}`,
          col: 2,
          label: p.name,
          keys: p.id === 'listeners' ? "next.on('analytics')" : p.id,
          sub: p.short,
          tone: p.status,
          title: p.detail,
        })),
    ];
    const edges: GraphEdge[] = [
      ...shownGa.flatMap((w) =>
        w.from
          .filter((f) => engines.includes(f))
          .map((f) => ({ from: `e:${f}`, to: `a:${w.ga}`, lit: snap.fired(f) > 0 && sends(w.ga) > 0 })),
      ),
      ...shownGa.map((w) => ({ from: `a:${w.ga}`, to: 'bus', lit: sends(w.ga) > 0 })),
      ...(shownGa.length
        ? FROM_GA.map((d) => ({
            from: 'bus',
            to: `d:${d}`,
            off: status(d) === 'off',
            lit:
              d === 'listeners'
                ? status(d) !== 'off' && sent().length > 0
                : sent().some((e) => snap.route(e)[d as Layer]),
          }))
        : []),
      ...(everything || exits
        ? LAYERS.map((d) => ({
            from: EXIT_NODE,
            to: `d:${d}`,
            off: status(d) === 'off',
            lit: EXITS.some((w) => snap.pushes(d, w.dl) > 0),
          }))
        : []),
      ...(engines.includes('ready')
        ? [
            {
              from: 'e:ready',
              to: 'd:nextCampaign',
              off: status('nextCampaign') === 'off',
              lit: status('nextCampaign') === 'ok',
            },
          ]
        : []),
    ];
    return { nodes, edges };
  };

  const chip = (name: EngineName) => h('span', { className: 'sdk-name', title: ENGINE[name] }, LABELS[name] ?? name);

  const detail = (snap: Snapshot): HTMLElement => {
    if (!selected) return h('div', 'tip', 'Click a node to see what it sent.');
    const head = (...children: Child[]) =>
      h(
        'div',
        'dhead',
        ...children,
        h('button', { type: 'button', className: 'link', onclick: () => select(undefined) }, 'Close'),
      );
    const ga = GA_WIRES.find((w) => `a:${w.ga}` === selected);
    if (ga) {
      const sends = snap.sends(ga.ga);
      return h(
        'div',
        'detail',
        head(
          h('span', 'ga-name', ga.ga),
          h('span', 'code', `→ ${ga.dl}${CUSTOM.has(ga.ga) ? ' · not a GA4 standard event' : ''}`),
        ),
        h(
          'div',
          'why',
          'From ',
          ...ga.from.flatMap((f, i) => [i > 0 && ' or ', chip(f)]),
          ga.why ? `. ${ga.why}` : '.',
        ),
        ...(sends.length
          ? sends.map((e) => sendRow(e, snap.route(e), snap.active))
          : [h('div', 'why', 'Not sent on this page.')]),
      );
    }
    if (selected === EXIT_NODE)
      return h(
        'div',
        'detail',
        head('Exit popup', h('span', 'code', 'exit-intent.* · data layer only')),
        ...EXITS.map((w) =>
          h(
            'div',
            'line',
            h('span', 'sdk-name', w.from[0]!),
            count(snap.fired(w.from[0]!)),
            ' → ',
            h('span', 'dl', w.dl),
          ),
        ),
      );
    if (selected.startsWith('e:')) {
      const engine = selected.slice(2) as EngineName;
      const seen = received.filter((e) => e.name === engine);
      return h(
        'div',
        'detail',
        head(LABELS[engine] ?? engine, h('span', 'code', engine)),
        h('div', 'why', `${ENGINE[engine]}.`),
        ...GA_WIRES.filter((w) => w.from.includes(engine)).map((w) =>
          h('div', 'line', '→ ', h('span', 'ga-name', w.ga), count(snap.sends(w.ga).length)),
        ),
        ...seen.slice(-5).map((e) => tree(h('span', 'time', time(e.at)), e.data, `e${ui.idOf(e)}`, ui.open)),
      );
    }
    const provider = snap.providers.find((p) => `d:${p.id}` === selected)!;
    const win = window as Win;
    const layer = LAYERS.find((l) => l === provider.id);
    const events = layer
      ? [...new Set((win[layer] ?? []).map((p) => (p as { event?: unknown } | null)?.event))].filter(
          (e): e is string => typeof e === 'string' && e.startsWith('dl_'),
        )
      : [];
    return h(
      'div',
      'detail',
      head(provider.name, provider.id === 'listeners' && h('span', 'code', "next.on('analytics', fn)")),
      h('div', 'why', provider.detail),
      ...events.map((dl) => h('div', 'line', h('span', 'dl', dl), count(snap.pushes(layer!, dl)))),
    );
  };

  const others = (query: string) => {
    const wired = new Set(WIRING.flatMap((w) => w.from));
    const names = (Object.keys(ENGINE) as EngineName[]).filter((n) => !wired.has(n) && n.includes(query));
    return expandable(
      ['Other SDK events, not sent to analytics', count(names.length)],
      'others',
      ui.open,
      () =>
        names.map((name) => {
          const seen = received.filter((e) => e.name === name);
          return expandable(
            [h('span', 'sdk-name', name), count(seen.length), h('span', 'desc', ENGINE[name])],
            `o${name}`,
            ui.open,
            () =>
              seen.length
                ? seen.map((e) => tree(h('span', 'time', time(e.at)), e.data, `e${ui.idOf(e)}`, ui.open))
                : [h('div', 'why', 'Not fired on this page.')],
            seen.length ? 'other' : 'other idle',
          );
        }),
      'more',
    );
  };

  const view = (query: string): Child[] => {
    const config = ui.config();
    const snap = snapshot(config);
    const { nodes, edges } = model(snap);
    const total = sent().length;
    const missing = sent().filter((e) => checks(e.data.name, e.data.params).length).length;
    const toggle = h('input', {
      type: 'checkbox',
      checked: everything,
      onchange: () => {
        everything = toggle.checked;
        ui.render();
      },
    });
    const card = detail(snap);
    if (reveal) {
      reveal = false;
      requestAnimationFrame(() => card.scrollIntoView?.({ block: 'nearest' }));
    }
    const graph = nodes.some((n) => n.col === 1 || n.col === 0);
    return [
      h(
        'div',
        'headline',
        h(
          'span',
          {},
          total ? `${total} GA4 event${total === 1 ? '' : 's'} sent` : 'No GA4 events yet',
          total > 0 &&
            (missing ? h('span', 'fail', `⚠ ${missing} missing GA4 fields`) : h('span', 'pass', '✓ GA4 fields OK')),
        ),
        h('label', 'switch', toggle, 'Show every route'),
      ),
      ...snap.providers.filter((p) => p.status === 'warn').map((p) => h('div', 'alert', `⚠ ${p.detail}`)),
      ...(graph
        ? [
            h('div', 'cols', h('span', {}, 'On the page'), h('span', {}, 'GA4 event'), h('span', {}, 'Sent to')),
            drawGraph(nodes, edges, { selected, query, select }),
            card,
          ]
        : [empty('Nothing sent yet', 'Analytics starts once the page is idle.')]),
      others(query),
    ];
  };

  const summary = () => {
    const warnings = providers(ui.config(), started()).filter((p) => p.status === 'warn').length;
    return `${sent().length} sent${warnings ? ` · ⚠ ${warnings}` : ''}`;
  };

  return { record, view, summary };
}
