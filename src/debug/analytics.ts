import type { EngineEvent } from '../engine/events';
import type { AnalyticsEvent, AnalyticsName, EventName } from '../engine/types';
import { format } from '../engine/values';
import { type Child, expandable, h, time, tree } from './view';

export const ANALYTICS_CSS = `.prov{display:grid;grid-template-columns:16px 168px minmax(0,1fr);gap:8px;align-items:baseline;margin-bottom:6px;padding:7px 10px;background:var(--raised);border:1px solid var(--line);border-radius:8px;font-family:var(--sans)}
.prov.off{background:none}
.prov.warn{border-color:var(--amber)}
.mark{font-weight:700;text-align:center}
.ok .mark{color:var(--green)}.off .mark,.off .pdetail{color:var(--muted)}.warn .mark{color:var(--amber)}.info .mark{color:var(--blue)}
.pname{font-weight:600}
.foot,.why{font:12px/1.5 var(--sans);color:var(--muted)}
.foot{margin:4px 2px 0}
.why{margin:0 0 6px}
.wiring{overflow:hidden;background:var(--raised);border:1px solid var(--line);border-radius:10px}
.cols,.wire>summary{display:grid;grid-template-columns:12px minmax(0,1.2fr) 12px minmax(0,1fr) 12px minmax(0,1fr);gap:6px;align-items:center}
.cols{padding:7px 10px;border-bottom:1px solid var(--line);font:600 11px var(--sans);color:var(--muted)}
.wire+.wire{border-top:1px solid var(--line)}
.wire>summary{padding:7px 10px;border-radius:0}
.idle>summary{opacity:.5}
.from{display:flex;flex-wrap:wrap;gap:4px}
.eng{padding:0 6px;border:1px solid var(--line);border-radius:4px;color:var(--muted);white-space:nowrap}
.eng.fired{border-color:var(--blue);color:var(--blue)}
.to{color:var(--muted);text-align:center}
.ga-name{font-weight:600;color:var(--orange)}
.dl{color:var(--purple);overflow-wrap:anywhere}
.n{margin-left:6px;padding:0 6px;border-radius:999px;background:var(--hover);color:var(--fg);font-size:11px}
.tag{display:inline-block;margin-left:6px;padding:0 5px;border-radius:4px;background:var(--hover);color:var(--muted);font:10px var(--sans);white-space:nowrap}
.fail{margin-left:6px;color:var(--amber)}.pass{color:var(--green)}
.wire-body{padding:2px 10px 10px 28px}
.send{border-top:1px solid var(--line)}
.send>summary{display:grid;grid-template-columns:12px 96px minmax(0,1fr) 84px 18px;gap:8px;align-items:baseline;border-radius:0}
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
.other>summary .desc{margin-left:8px;font-family:var(--sans);color:var(--muted)}
.sdk-name{color:var(--blue)}`;

export interface ProviderConfig {
  enabled: boolean;
  nextCampaign: boolean;
  dataLayer: boolean;
  unsupported: string[];
}

type EngineName = Exclude<EventName, 'analytics'>;
type Item = Record<string, unknown>;
type Layer = 'NextDataLayer' | 'dataLayer';
type Route = Record<Layer, string | undefined>;
type Tone = 'ok' | 'off' | 'warn' | 'info';
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
  { from: ['ready'], ga: 'view_item', dl: 'dl_view_item', why: 'When the page shows exactly one package.' },
  { from: ['ready'], ga: 'view_item_list', dl: 'dl_view_item_list', why: 'When the page shows several packages.' },
  {
    from: ['ready', 'cart.calculated'],
    ga: 'add_to_cart',
    dl: 'dl_add_to_cart',
    why: 'Lines added since the last report. On ready: a cart filled before this page (default bundle, forcePackageId, an earlier page).',
  },
  {
    from: ['ready', 'cart.calculated', 'cart.updated'],
    ga: 'remove_from_cart',
    dl: 'dl_remove_from_cart',
    why: 'Lines removed since the last report, at the price they were added. cart.updated only when the cart empties.',
  },
  {
    from: ['cart.calculated'],
    ga: 'update_cart',
    dl: 'dl_cart_updated',
    why: 'The whole cart, after every server total.',
  },
  { from: ['checkout.started'], ga: 'begin_checkout', dl: 'dl_begin_checkout' },
  { from: ['checkout.shipping-added'], ga: 'add_shipping_info', dl: 'dl_add_shipping_info' },
  { from: ['checkout.payment-added'], ga: 'add_payment_info', dl: 'dl_add_payment_info' },
  { from: ['order.loaded'], ga: 'purchase', dl: 'dl_purchase', why: 'Once per order, only when paid.' },
  { from: ['order.loaded'], ga: 'upsell_purchase', dl: 'dl_upsell_purchase', why: 'Once per accepted upsell.' },
  { from: ['upsell.viewed'], ga: 'view_upsell', dl: 'dl_viewed_upsell' },
  { from: ['upsell.skipped'], ga: 'skip_upsell', dl: 'dl_skipped_upsell' },
  { from: ['exit-intent.shown'], dl: 'dl_exit_intent_shown', why: 'Data layer only: there is no analytics event.' },
  {
    from: ['exit-intent.clicked'],
    dl: 'dl_exit_intent_accepted',
    why: 'Data layer only: there is no analytics event.',
  },
  {
    from: ['exit-intent.dismissed'],
    dl: 'dl_exit_intent_dismissed',
    why: 'Data layer only: there is no analytics event.',
  },
  { from: ['exit-intent.closed'], dl: 'dl_exit_intent_closed', why: 'Data layer only: there is no analytics event.' },
  { from: ['exit-intent.action'], dl: 'dl_exit_intent_action', why: 'Data layer only: there is no analytics event.' },
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
const MARK: Record<Tone, string> = { ok: '✓', off: '○', warn: '⚠', info: 'i' };
const NEXT_SCRIPT = 'script[src^="https://campaigns.apps.29next.com/js/v1/campaign/"]';
const KEEP = 300;

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

export function providers(config: ProviderConfig, started: boolean): Array<[Tone, string, string]> {
  const win = window as Win;
  if (!config.enabled) return [['off', 'Analytics', 'Off: nextConfig.analytics.enabled is false, so nothing is sent']];
  const waiting = 'Starts once the page is idle after ready';
  const containers = Object.keys(win.google_tag_manager ?? {}).filter((k) => k.startsWith('GTM-'));
  const rows: Array<[Tone, string, string] | false> = [
    started
      ? [
          'ok',
          'NextDataLayer',
          `window.NextDataLayer has ${win.NextDataLayer?.length ?? 0} dl_* events (Elevar format)`,
        ]
      : ['off', 'NextDataLayer', waiting],
    !config.dataLayer
      ? ['off', 'GTM dataLayer', 'Off: nextConfig.analytics.providers.gtm.enabled is false']
      : containers.length
        ? ['ok', 'GTM dataLayer', `window.dataLayer, read by ${containers.join(', ')}`]
        : [
            'warn',
            'GTM dataLayer',
            'On, but no GTM container on this page: dl_* events wait in window.dataLayer unless another tool reads them',
          ],
    !config.nextCampaign
      ? ['off', 'NEXT analytics', 'Off: nextConfig.analytics.providers.nextCampaign.enabled is false']
      : typeof win.nextCampaign?.event === 'function'
        ? ['ok', 'NEXT analytics', 'Script loaded; it sends its own page_view']
        : started
          ? [
              'warn',
              'NEXT analytics',
              `On, but its script ${document.querySelector(NEXT_SCRIPT) ? 'has not loaded: blocked or slow' : 'is not on the page'}`,
            ]
          : ['off', 'NEXT analytics', waiting],
    ...config.unsupported.map((name): [Tone, string, string] => [
      'warn',
      UNSUPPORTED[name] ?? name,
      `On in nextConfig (providers.${name}), but no longer built in: add it as a GTM tag`,
    ]),
    typeof win.NextDataLayerTransformFn === 'function' && [
      'info',
      'NextDataLayerTransformFn',
      'Set: it can change or drop each dl_* event before it is pushed',
    ],
  ];
  return rows.filter((r): r is [Tone, string, string] => !!r);
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

  const record = (e: EngineEvent) => {
    received.push(e);
    if (received.length > KEEP) received.shift();
  };

  const sent = () => received.filter(isAnalytics);
  const started = () => sent().length > 0 || !!(window as Win).NextDataLayer;

  const sendRow = (e: EngineEvent<'analytics'>, route: Route, active: Layer[]) => {
    const { name, id, params, context } = e.data;
    const problems = [...checks(name, params), ...active.filter((l) => !route[l]).map((l) => `not in ${l}`)];
    const items = itemsOf(params);
    return expandable(
      [
        h('span', 'time', time(e.at)),
        h('span', 'what', what(e.data)),
        h('span', 'amount', amount(params)),
        problems.length
          ? h('span', { className: 'fail', title: problems.join('\n') }, '⚠')
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
          ...(problems.length
            ? problems.map((p) => h('div', 'amber', `⚠ ${p}`))
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

  const providerList = (config: ProviderConfig) => [
    h('h3', {}, 'Providers'),
    ...providers(config, started()).map(([tone, name, detail]) =>
      h('div', `prov ${tone}`, h('span', 'mark', MARK[tone]), h('span', 'pname', name), h('span', 'pdetail', detail)),
    ),
    h(
      'div',
      'foot',
      'GA4, Meta and other vendors get these through GTM tags or Elevar reading the data layer. Page scripts can forward them with next.on("analytics", fn).',
    ),
  ];

  const wiring = (query: string, config: ProviderConfig) => {
    const fired = new Map<string, number>();
    for (const e of received) fired.set(e.name, (fired.get(e.name) ?? 0) + 1);
    const routes = new Map(sent().map((e) => [e.data.id, pushed(e.data.id)]));
    const active = LAYERS.filter(
      (l) => (l === 'dataLayer' ? config.dataLayer : true) && [...routes.values()].some((r) => r[l]),
    );
    const win = window as Win;
    const rows = WIRING.filter((w) => [...w.from, w.ga ?? '', w.dl].join(' ').toLowerCase().includes(query)).map(
      (w) => {
        const sends = w.ga ? sent().filter((e) => e.data.name === w.ga) : [];
        const pushes = w.ga
          ? sends.filter((e) => routes.get(e.data.id)!.NextDataLayer ?? routes.get(e.data.id)!.dataLayer).length
          : (win.NextDataLayer ?? win.dataLayer ?? []).filter((p) => (p as { event?: unknown } | null)?.event === w.dl)
              .length;
        const missing = active.filter((l) => sends.some((e) => !routes.get(e.data.id)![l]));
        const invalid = sends.filter((e) => checks(e.data.name, e.data.params).length).length;
        const live = w.ga ? sends.length > 0 : pushes > 0;
        const chips = w.from.map((f) =>
          h('span', { className: fired.get(f) ? 'eng fired' : 'eng', title: ENGINE[f] }, f, count(fired.get(f) ?? 0)),
        );
        const ga = w.ga
          ? h(
              'span',
              {},
              h('span', 'ga-name', w.ga),
              count(sends.length),
              CUSTOM.has(w.ga) && h('span', { className: 'tag', title: 'No GA4 equivalent: map it in GTM' }, 'custom'),
              invalid > 0 &&
                h('span', { className: 'fail', title: `${invalid} sent without a field GA4 requires` }, '⚠'),
            )
          : h('span', 'dim', 'none');
        const dl = h(
          'span',
          {},
          h('span', 'dl', w.dl),
          count(pushes),
          missing.length > 0 &&
            h('span', { className: 'fail', title: missing.map((l) => `Some are not in ${l}`).join('\n') }, '⚠'),
        );
        return expandable(
          [h('span', 'from', ...chips), h('span', 'to', '→'), ga, h('span', 'to', '→'), dl],
          `w${w.dl}`,
          ui.open,
          () => [
            h(
              'div',
              'wire-body',
              w.why && h('div', 'why', w.why),
              ...(w.ga
                ? sends.length
                  ? sends.map((e) => sendRow(e, routes.get(e.data.id)!, active))
                  : [h('div', 'why', 'Not sent on this page.')]
                : [h('div', 'why', `${pushes} pushed on this page.`)]),
            ),
          ],
          live ? 'wire' : 'wire idle',
        );
      },
    );
    return [
      h('h3', {}, 'Event wiring'),
      h('div', 'foot', 'Numbers count this page. Hover an engine event for when it fires; click a row for each send.'),
      h(
        'div',
        'wiring',
        h('div', 'cols', h('span'), 'Engine event', h('span'), 'Analytics event', h('span'), 'Data layer'),
        ...rows,
      ),
    ];
  };

  const others = (query: string) => {
    const wired = new Set(WIRING.flatMap((w) => w.from));
    const names = (Object.keys(ENGINE) as EngineName[]).filter((n) => !wired.has(n) && n.includes(query));
    return [
      h('h3', {}, 'Engine events not sent to analytics'),
      ...names.map((name) => {
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
    ];
  };

  const view = (query: string): Child[] => {
    const config = ui.config();
    return [...providerList(config), ...wiring(query, config), ...others(query)];
  };

  const summary = () => {
    const warnings = providers(ui.config(), started()).filter(([tone]) => tone === 'warn').length;
    return `${sent().length} sent${warnings ? ` · ⚠ ${warnings}` : ''}`;
  };

  return { record, view, summary };
}
