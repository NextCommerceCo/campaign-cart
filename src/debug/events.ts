import type { Engine } from '../engine/engine';
import type { EngineEvent } from '../engine/events';
import type { AnalyticsEvent } from '../engine/types';
import { format } from '../engine/values';
import { type Child, empty, expandable, h, time, tree } from './view';

export const EVENTS_CSS = `.top{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px;font-family:var(--sans)}
.caption{font:600 11px var(--sans);letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.funnel{display:flex;align-items:flex-start;overflow-x:auto;scrollbar-width:none;padding:8px 2px 12px}
.step{display:flex;flex-direction:column;align-items:center;gap:4px;min-width:52px;font:11px/1.2 var(--sans);color:var(--muted);text-align:center}
.step i{display:grid;place-items:center;width:20px;height:20px;border:2px solid var(--line);border-radius:50%;background:var(--bg);color:#fff;font:600 10px var(--sans)}
.step.fired{color:var(--fg)}
.step.fired i{background:var(--orange);border-color:var(--orange)}
.step.twice i{background:var(--red);border-color:var(--red)}
.step.focus i{outline:2px solid var(--orange);outline-offset:2px}
.bar{flex:1;min-width:8px;height:2px;margin-top:10px;background:var(--line)}
.bar.fired{background:var(--orange)}
.legend{display:flex;flex-wrap:wrap;align-items:center;gap:6px;color:var(--muted)}
.dot{display:inline-block;width:8px;height:8px;margin-right:5px;border-radius:50%}
.dot.sdk{background:var(--blue)}.dot.ga{background:var(--orange)}.dot.dl{background:var(--purple)}
.modes{display:inline-flex;gap:2px;padding:2px;border:1px solid var(--line);border-radius:8px}
.modes button{padding:2px 10px;border-radius:6px;color:var(--muted)}
.modes .on{background:var(--hover);color:var(--fg)}
.moment{position:relative;margin-left:6px;padding:0 0 12px 16px;border-left:2px solid var(--line)}
.moment::before{content:'';position:absolute;left:-7px;top:3px;width:8px;height:8px;border:2px solid var(--muted);border-radius:50%;background:var(--bg)}
.when{font-size:11px;color:var(--muted)}
.sdk-name{color:var(--blue)}
.ga-row{margin:3px 0 3px 14px;background:var(--raised);border-left:2px solid var(--orange);border-radius:0 6px 6px 0}
.ga-name{font-weight:600;color:var(--orange)}
.dl{margin-left:8px;color:var(--purple)}
.pass,.fail{margin-left:8px;font-size:11px}.pass{color:var(--green)}.fail{color:var(--amber)}
.ga-body{padding:4px 10px 10px 22px}
.kv{display:flex;gap:8px}
table{width:100%;margin:6px 0;border-collapse:collapse}
th,td{padding:2px 8px 2px 0;text-align:left;border-bottom:1px solid var(--line)}
th{font:600 11px var(--sans);color:var(--muted)}
.route{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}
.push{padding:0 8px;border:1px solid var(--line);border-radius:999px;color:var(--muted)}
.push.ok{color:var(--purple);border-color:var(--purple)}`;

type Mode = 'all' | 'sdk' | 'analytics';
type Item = Record<string, unknown>;

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
const LAYERS = ['NextDataLayer', 'dataLayer'] as const;
const NOT_PUSHED = {
  NextDataLayer: 'Not in window.NextDataLayer: NextDataLayerTransformFn dropped it, or the page replaced the array',
  dataLayer:
    'Not in window.dataLayer: nextConfig.analytics.providers.gtm.enabled is false, or NextDataLayerTransformFn dropped it',
};
const CATCH_UP =
  'Usually analytics catching up: it starts once the page is idle and sends events for what happened before it loaded';
const SAME_MOMENT_MS = 5;
const KEEP = 300;

const isAnalytics = (e: EngineEvent): e is EngineEvent<'analytics'> => e.name === 'analytics';

export function checks(name: string, params: Record<string, unknown>): string[] {
  const items = Array.isArray(params.items) ? (params.items as Item[]) : undefined;
  return [
    NEEDS_ITEMS.has(name) && !items?.length && 'items is empty',
    items?.some((i) => !i.item_id && !i.item_name) && 'an item has neither item_id nor item_name',
    params.value !== undefined && !params.currency && 'value is set without currency',
    name.endsWith('purchase') && !params.transaction_id && 'transaction_id is missing',
  ].filter((p): p is string => !!p);
}

function pushes(id: string) {
  const win = window as unknown as Partial<Record<(typeof LAYERS)[number], unknown[]>>;
  return LAYERS.map((layer) => {
    const hit = win[layer]?.find((p) => (p as { event_id?: unknown } | null)?.event_id === id);
    return { layer, event: (hit as { event?: string } | undefined)?.event, present: !!win[layer] };
  });
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

export function eventFlow(engine: Engine, ui: { open: Set<string>; idOf: (o: object) => number; render: () => void }) {
  const received: Array<{ e: EngineEvent; tick: number }> = [];
  let tick = 0;
  let ticking = false;
  let mode: Mode = 'all';
  let focus: number | undefined;

  const record = (e: EngineEvent) => {
    if (!ticking) {
      tick++;
      ticking = true;
      queueMicrotask(() => (ticking = false));
    }
    received.push({ e, tick });
    if (received.length > KEEP) received.shift();
  };

  const analytics = () => received.map((r) => r.e).filter(isAnalytics);

  const moments = () => {
    const list: EngineEvent[][] = [];
    received.forEach((r, i) => {
      const prev = received[i - 1];
      if (prev && prev.tick === r.tick && r.e.at - prev.e.at <= SAME_MOMENT_MS) list.at(-1)!.push(r.e);
      else list.push([r.e]);
    });
    return list;
  };

  const funnel = () => {
    const sent = analytics().map((e) => e.data.name as string);
    const steps = FUNNEL.flatMap(([label, names], i) => {
      const count = sent.filter((n) => names.includes(n)).length;
      const className = [
        'step',
        count && 'fired',
        names[0] === 'purchase' && count > 1 && 'twice',
        focus === i && 'focus',
      ].filter(Boolean);
      const step = h(
        'button',
        {
          type: 'button',
          className: className.join(' '),
          title: `${names.join(' / ')}: ${count ? `sent ${count}×` : 'not sent on this page'}`,
          onclick: () => {
            focus = focus === i ? undefined : i;
            if (mode === 'sdk') mode = 'all';
            ui.render();
          },
        },
        h('i', {}, count > 1 ? String(count) : ''),
        label,
      );
      return [i > 0 && h('span', count ? 'bar fired' : 'bar'), step];
    });
    return h('div', {}, h('div', 'caption', 'GA4 funnel on this page'), h('div', 'funnel', ...steps));
  };

  const top = () => {
    const legend = h(
      'div',
      'legend',
      h('span', {}, h('i', 'dot sdk'), 'SDK event'),
      '→',
      h('span', {}, h('i', 'dot ga'), 'Analytics (GA4)'),
      '→',
      h('span', {}, h('i', 'dot dl'), 'Data layer'),
    );
    const modes = (['all', 'sdk', 'analytics'] as Mode[]).map((m) =>
      h(
        'button',
        {
          type: 'button',
          className: m === mode ? 'on' : '',
          onclick: () => {
            mode = m;
            focus = undefined;
            ui.render();
          },
        },
        { all: 'All', sdk: 'SDK', analytics: 'Analytics' }[m],
      ),
    );
    return h('div', 'top', legend, h('div', 'modes', ...modes));
  };

  const sdkRow = (e: EngineEvent) =>
    tree(h('span', e.name === 'error' ? 'red' : 'sdk-name', e.name), e.data, `e${ui.idOf(e)}`, ui.open);

  const gaRow = (e: EngineEvent<'analytics'>) => {
    const { name, id, params, context } = e.data;
    const problems = checks(name, params);
    const items = Array.isArray(params.items) ? (params.items as Item[]) : [];
    const value =
      typeof params.value === 'number' &&
      format({ type: 'money', value: params.value }, params.currency ? String(params.currency) : undefined);
    const facts = [value, items.length && `${items.length} item${items.length === 1 ? '' : 's'}`].filter(Boolean);
    const route = pushes(id);
    const pushed = route.find((r) => r.event)?.event;
    return expandable(
      [
        h('span', 'ga-name', name),
        facts.length > 0 && h('span', 'dim', ` ${facts.join(' · ')}`),
        pushed && h('span', 'dl', `→ ${pushed}`),
        problems.length ? h('span', 'fail', `⚠ ${problems.length}`) : h('span', 'pass', '✓ GA4'),
      ],
      `a${ui.idOf(e)}`,
      ui.open,
      () => [
        h(
          'div',
          'ga-body',
          ...Object.entries(params)
            .filter(([, v]) => v === null || typeof v !== 'object')
            .map(([k, v]) => h('div', 'kv', h('span', 'key', k), String(v))),
          items.length > 0 && itemsTable(items),
          ...(problems.length
            ? problems.map((p) => h('div', 'amber', `⚠ ${p}`))
            : [h('div', 'green', '✓ Required GA4 fields are present')]),
          h(
            'div',
            'route',
            ...route.map((r) =>
              h(
                'span',
                {
                  className: r.event ? 'push ok' : 'push',
                  title: r.event ? `window.${r.layer} has it` : NOT_PUSHED[r.layer],
                },
                `${r.layer} `,
                r.event ? `✓ ${r.event}` : r.present ? 'not pushed' : 'not on page',
              ),
            ),
          ),
          tree(h('span', 'key', 'raw'), { id, params, context }, `r${ui.idOf(e)}`, ui.open),
        ),
      ],
      'ga-row',
    );
  };

  const view = (query: string): Child[] => {
    const wanted = focus === undefined ? undefined : FUNNEL[focus]![1];
    const onlyAnalytics = mode === 'analytics' || !!wanted;
    const keep = (e: EngineEvent) =>
      isAnalytics(e) ? mode !== 'sdk' && (!wanted || wanted.includes(e.data.name)) : true;
    const rows = moments()
      .map((m) => m.filter(keep))
      .filter((m) => m.length > 0 && (!onlyAnalytics || m.some(isAnalytics)))
      .filter((m) => !query || m.some((e) => `${e.name} ${JSON.stringify(e.data)}`.toLowerCase().includes(query)))
      .slice(-80)
      .reverse()
      .map((m) => {
        const when = h('div', 'when', time(m[0]!.at));
        if (m.every(isAnalytics)) when.append(h('span', { title: CATCH_UP }, ' · no SDK event alongside'));
        return h('div', 'moment', when, ...m.map((e) => (isAnalytics(e) ? gaRow(e) : sdkRow(e))));
      });
    const none = onlyAnalytics
      ? empty(
          'No analytics events here yet',
          'They start once the page is idle after ready, unless nextConfig.analytics.enabled is false.',
        )
      : empty(query ? 'Nothing matches' : 'No events yet');
    return [funnel(), top(), ...(rows.length ? rows : [none])];
  };

  const summary = () => `${received.length} · ${analytics().length} analytics`;

  return { record, view, summary };
}
