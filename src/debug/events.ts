import type { EngineEvent } from '../engine/events';
import type { AnalyticsEvent, EventMap, EventName } from '../engine/types';
import { format } from '../engine/values';
import { type Child, empty, expandable, h, time, tree } from './view';

export const EVENTS_CSS = `.flow-head{position:sticky;top:-8px;z-index:1;margin:-8px -12px 12px;padding:10px 12px;background:var(--bg);border-bottom:1px solid var(--line);font-family:var(--sans)}
.caption{font:600 11px var(--sans);letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.funnel{display:flex;align-items:flex-start;overflow-x:auto;scrollbar-width:none;padding:8px 2px 10px}
.step{display:flex;flex-direction:column;align-items:center;gap:4px;min-width:52px;font:11px/1.2 var(--sans);color:var(--muted);text-align:center}
.step i{display:grid;place-items:center;width:20px;height:20px;border:2px solid var(--line);border-radius:50%;background:var(--bg);color:#fff;font:600 10px var(--sans)}
.step.fired{color:var(--fg)}
.step.fired i{background:var(--orange);border-color:var(--orange)}
.step.twice i{background:var(--red);border-color:var(--red)}
.step.focus i{outline:2px solid var(--orange);outline-offset:2px}
.bar{flex:1;min-width:8px;height:2px;margin-top:10px;background:var(--line)}
.bar.fired{background:var(--orange)}
.status{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12px;color:var(--muted)}
.controls{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;margin-top:6px;font-size:12px;color:var(--muted)}
.switch{display:inline-flex;align-items:center;gap:6px;color:var(--fg);cursor:pointer}
.story{margin-bottom:10px;background:var(--raised);border:1px solid var(--line);border-radius:10px;overflow:hidden}
.story.quiet{background:none;border-style:dashed}
.story-head{display:flex;justify-content:space-between;gap:12px;padding:8px 12px;font:600 13px/1.4 var(--sans)}
.quiet .story-head{font-weight:400;color:var(--muted)}
.also{font-weight:400;color:var(--muted)}
.story-head .time{flex:none;font:11px var(--mono)}
.sdk-list{padding:0 8px 6px}
.sdk-name{color:var(--blue)}
.ga-row{border-top:1px solid var(--line)}
.ga-row>summary{display:grid;grid-template-columns:12px 136px minmax(0,1fr) 84px 18px;gap:8px;align-items:baseline;padding:6px 12px;border-radius:0}
.ga-name{overflow:hidden;font-weight:600;color:var(--orange);text-overflow:ellipsis}
.what{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.amount{text-align:right;font-variant-numeric:tabular-nums}
.pass{color:var(--green)}.fail{color:var(--amber)}
.ga-body{padding:2px 12px 10px 32px}
.facts{display:flex;flex-wrap:wrap;gap:2px 14px}
table{width:100%;margin:6px 0;border-collapse:collapse}
th,td{padding:2px 8px 2px 0;text-align:left;border-bottom:1px solid var(--line)}
th{font:600 11px var(--sans);color:var(--muted)}
.route{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}
.push{padding:0 8px;border:1px solid var(--line);border-radius:999px;color:var(--muted)}
.push.ok{color:var(--purple);border-color:var(--purple)}`;

type Item = Record<string, unknown>;
type Layer = (typeof LAYERS)[number];
type Route = Record<Layer, string | undefined>;

const FUNNEL: Array<[string, string[]]> = [
  ['Page view', ['page_view']],
  ['View item', ['view_item', 'view_item_list']],
  ['Add to cart', ['add_to_cart']],
  ['Checkout', ['begin_checkout']],
  ['Shipping', ['add_shipping_info']],
  ['Payment', ['add_payment_info']],
  ['Purchase', ['purchase']],
  ['Upsell view', ['view_upsell']],
  ['Upsell', ['upsell_purchase']],
];
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
const ACTIONS: { [K in EventName]?: string | ((data: EventMap[K]) => string) } = {
  'campaign.loaded': 'Campaign loaded',
  'cart.updated': 'Cart changed',
  'cart.calculated': 'Cart priced',
  'coupon.refused': (d) => `Coupon ${d.code} refused`,
  'selection.changed': (d) => `Picked ${d.cardId}`,
  'shipping.changed': 'Changed the shipping method',
  'storage.degraded': 'Storage unavailable',
  ready: 'Page ready',
  'checkout.started': 'Started checkout',
  'checkout.shipping-added': 'Entered shipping details',
  'checkout.payment-added': (d) => `Chose ${d.method === 'card_token' ? 'card' : d.method} payment`,
  'prospect.saved': 'Saved as a prospect',
  'order.placed': 'Placed the order',
  'order.loaded': (d) => (d.purchase ? 'Order confirmed' : 'Order loaded'),
  'upsell.viewed': 'Saw an upsell',
  'upsell.accepted': 'Accepted the upsell',
  'upsell.skipped': 'Skipped the upsell',
  'exit-intent.shown': 'Exit popup shown',
  'exit-intent.clicked': 'Clicked the exit popup',
  'exit-intent.dismissed': 'Dismissed the exit popup',
  'exit-intent.closed': 'Closed the exit popup',
  'exit-intent.action': 'Used the exit popup offer',
  error: (d) => `Error in ${d.action}`,
};
const QUIET = new Set<EventName>(['campaign.loaded', 'cart.updated', 'cart.calculated']);
const LAYERS = ['NextDataLayer', 'dataLayer'] as const;
const NOT_PUSHED: Record<Layer, string> = {
  NextDataLayer: 'Not in window.NextDataLayer: NextDataLayerTransformFn dropped it, or the page replaced the array',
  dataLayer:
    'Not in window.dataLayer: nextConfig.analytics.providers.gtm.enabled is false, or NextDataLayerTransformFn dropped it',
};
const CATCH_UP = 'Analytics starts once the page is idle and then sends events for what happened before it loaded';
const STEP_GAP_MS = 1500;
const KEEP = 300;
const SHOWN = 60;

const isAnalytics = (e: EngineEvent): e is EngineEvent<'analytics'> => e.name === 'analytics';

const itemsOf = (params: Record<string, unknown>) => (Array.isArray(params.items) ? (params.items as Item[]) : []);

export function checks(name: string, params: Record<string, unknown>): string[] {
  const items = Array.isArray(params.items) ? (params.items as Item[]) : undefined;
  return [
    NEEDS_ITEMS.has(name) && !items?.length && 'items is empty',
    items?.some((i) => !i.item_id && !i.item_name) && 'an item has neither item_id nor item_name',
    params.value !== undefined && !params.currency && 'value is set without currency',
    name.endsWith('purchase') && !params.transaction_id && 'transaction_id is missing',
  ].filter((p): p is string => !!p);
}

function action<K extends EventName>(e: EngineEvent<K>): string {
  const label = ACTIONS[e.name] as string | ((data: EventMap[K]) => string) | undefined;
  return typeof label === 'function' ? label(e.data) : (label ?? e.name);
}

const title = (sdk: EngineEvent[]) => {
  const loud = sdk.filter((e) => !QUIET.has(e.name));
  const labels = [...new Set((loud.length ? loud : sdk).map(action))];
  const ready = sdk.find((e) => e.name === 'ready');
  const main = ready ? action(ready) : labels[0];
  return { main, also: labels.filter((l) => l !== main) };
};

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

function route(id: string): Route {
  const win = window as unknown as Partial<Record<Layer, unknown[]>>;
  const find = (layer: Layer) =>
    (win[layer]?.find((p) => (p as { event_id?: unknown } | null)?.event_id === id) as { event?: string } | undefined)
      ?.event;
  return { NextDataLayer: find('NextDataLayer'), dataLayer: find('dataLayer') };
}

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

export function eventFlow(ui: { open: Set<string>; idOf: (o: object) => number; render: () => void }) {
  const received: EngineEvent[] = [];
  let showSdk = false;
  let focus: number | undefined;

  const record = (e: EngineEvent) => {
    received.push(e);
    if (received.length > KEEP) received.shift();
  };

  const steps = () => {
    const list: EngineEvent[][] = [];
    received.forEach((e, i) => {
      const prev = received[i - 1];
      if (prev && e.at - prev.at <= STEP_GAP_MS) list.at(-1)!.push(e);
      else list.push([e]);
    });
    return list;
  };

  const funnel = (sent: AnalyticsEvent[]) => {
    const track = FUNNEL.flatMap(([label, names], i) => {
      const count = sent.filter((a) => names.includes(a.name)).length;
      const className = [
        'step',
        count && 'fired',
        names[0] === 'purchase' && count > 1 && 'twice',
        focus === i && 'focus',
      ];
      const step = h(
        'button',
        {
          type: 'button',
          className: className.filter(Boolean).join(' '),
          title: `${names.join(' / ')}: ${count ? `sent ${count}×` : 'not sent on this page'}`,
          onclick: () => {
            focus = focus === i ? undefined : i;
            ui.render();
          },
        },
        h('i', {}, count > 1 ? String(count) : ''),
        label,
      );
      return [i > 0 && h('span', count ? 'bar fired' : 'bar'), step];
    });
    return h('div', {}, h('div', 'caption', 'GA4 funnel on this page'), h('div', 'funnel', ...track));
  };

  const status = (sent: AnalyticsEvent[], routes: Map<string, Route>) => {
    if (!sent.length) return h('div', 'status', 'No GA4 events yet');
    const missing = sent.filter((a) => checks(a.name, a.params).length).length;
    const win = window as unknown as Partial<Record<Layer, unknown[]>>;
    return h(
      'div',
      'status',
      `${sent.length} GA4 event${sent.length === 1 ? '' : 's'}`,
      missing
        ? h('span', 'amber', `⚠ ${missing} missing required fields`)
        : h('span', 'green', '✓ required fields present'),
      ...LAYERS.map((layer) => {
        const reached = sent.filter((a) => routes.get(a.id)![layer]).length;
        const all = reached === sent.length;
        return h(
          'span',
          { className: all ? 'green' : reached ? 'amber' : '', title: all ? '' : NOT_PUSHED[layer] },
          `${layer} ${win[layer] ? `${reached}/${sent.length}` : 'not on page'}`,
        );
      }),
    );
  };

  const controls = () => {
    const toggle = h('input', {
      type: 'checkbox',
      checked: showSdk,
      onchange: () => {
        showSdk = toggle.checked;
        ui.render();
      },
    });
    const unfocus = () => {
      focus = undefined;
      ui.render();
    };
    return h(
      'div',
      'controls',
      focus === undefined
        ? h('span', {}, 'Click a step to see only it')
        : h(
            'span',
            {},
            `Only ${FUNNEL[focus]![0]} `,
            h('button', { type: 'button', className: 'link', onclick: unfocus }, 'Show all'),
          ),
      h('label', 'switch', toggle, 'Show SDK events'),
    );
  };

  const sdkRow = (e: EngineEvent) =>
    tree(h('span', e.name === 'error' ? 'red' : 'sdk-name', e.name), e.data, `e${ui.idOf(e)}`, ui.open);

  const gaRow = (e: EngineEvent<'analytics'>, pushed: Route, active: Layer[]) => {
    const { name, id, params, context } = e.data;
    const problems = [...checks(name, params), ...active.filter((l) => !pushed[l]).map((l) => `not in ${l}`)];
    const items = itemsOf(params);
    return expandable(
      [
        h('span', 'ga-name', name),
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
          'ga-body',
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
                { className: pushed[layer] ? 'push ok' : 'push', title: pushed[layer] ? '' : NOT_PUSHED[layer] },
                `${layer} ${pushed[layer] ? `✓ ${pushed[layer]}` : 'not pushed'}`,
              ),
            ),
          ),
          tree(h('span', 'key', 'raw'), { id, params, context }, `r${ui.idOf(e)}`, ui.open),
        ),
      ],
      'ga-row',
    );
  };

  const story = (events: EngineEvent[], routes: Map<string, Route>, active: Layer[], wanted?: string[]) => {
    const sdk = events.filter((e) => !isAnalytics(e));
    const ga = events.filter(isAnalytics).filter((e) => !wanted || wanted.includes(e.data.name));
    const at = events[0]!.at;
    const { main, also } = title(sdk);
    const head = h(
      'div',
      'story-head',
      h(
        'span',
        { title: sdk.length ? '' : CATCH_UP },
        main ?? 'Analytics caught up',
        also.length > 0 && h('span', 'also', ` · ${also.join(' · ')}`),
        !ga.length && ' · no GA4 event',
      ),
      h('span', { className: 'time', title: time(at) }, `+${((at - performance.timeOrigin) / 1000).toFixed(1)}s`),
    );
    return h(
      'div',
      ga.length ? 'story' : 'story quiet',
      head,
      showSdk && sdk.length > 0 && h('div', 'sdk-list', ...sdk.map(sdkRow)),
      ...ga.map((e) => gaRow(e, routes.get(e.data.id)!, active)),
    );
  };

  const view = (query: string): Child[] => {
    const sent = received.filter(isAnalytics).map((e) => e.data);
    const routes = new Map(sent.map((a) => [a.id, route(a.id)]));
    const active = LAYERS.filter((l) => sent.some((a) => routes.get(a.id)![l]));
    const wanted = focus === undefined ? undefined : FUNNEL[focus]![1];
    const stories = steps()
      .filter((s) => !wanted || s.some((e) => isAnalytics(e) && wanted.includes(e.data.name)))
      .filter((s) => !query || s.some((e) => `${e.name} ${JSON.stringify(e.data)}`.toLowerCase().includes(query)))
      .slice(-SHOWN)
      .map((s) => story(s, routes, active, wanted));
    const none = wanted
      ? empty(`No ${FUNNEL[focus!]![0].toLowerCase()} event on this page`, CATCH_UP)
      : empty(query ? 'Nothing matches' : 'No events yet');
    return [
      h('div', 'flow-head', funnel(sent), status(sent, routes), controls()),
      ...(stories.length ? stories : [none]),
    ];
  };

  const summary = () => `${received.length} · ${received.filter(isAnalytics).length} GA4`;

  return { record, view, summary };
}
