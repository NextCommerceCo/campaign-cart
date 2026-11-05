import type { EngineEvent } from '../engine/events';
import type { LogEntry } from '../engine/log';
import type { AnalyticsEvent, AnalyticsTrace, EventMap, EventName } from '../engine/events';
import { format } from '../engine/format';
import { checks, dlOf, type Item, itemsOf, type Layer, type ProviderConfig, providers, type Win } from './providers';
import { type IconName, icon } from './icons';
import { KINDS } from './journey';
import type { PageVisit } from './state';
import { button, type Child, clock, h, iconButton, nodes, plural, tab as tabButton, tablist, tsugi } from './view';

type State = 'ok' | 'skip' | 'warn' | 'off' | 'info';
type Run = AnalyticsTrace & { at: number };
type Hit = { id: string; name: string; at: number; host: string; params: Array<[string, string]> };
type Tab = { id: string; label: string; logo?: IconName; body: () => Child[] };
type Sum = { ok: boolean; text: string };

const LABELS: Partial<Record<EventName, string>> = {
  'sdk.ready': 'Page loaded',
  'cart.updated': 'Cart changed',
  'cart.calculated': 'Cart priced',
  'cart.added': 'Added to the cart',
  'cart.removed': 'Removed from the cart',
  'checkout.started': 'Checkout started',
  'user.created': 'User created',
  'address.entered': 'Address entered',
  'shipping.settled': 'Shipping picked',
  'checkout.submitted': 'Order submitted',
  'order.loaded': 'Order loaded',
  'order.paid': 'Order paid',
  'upsell.viewed': 'Upsell shown',
  'upsell.skipped': 'Upsell skipped',
  'promotion.viewed': 'Promotion shown',
  'promotion.clicked': 'Promotion clicked',
  'promotion.closed': 'Promotion closed',
};

const NOT_PUSHED: Record<Layer, string> = {
  NextDataLayer: 'NextDataLayerTransformFn dropped it, or the page replaced window.NextDataLayer',
  dataLayer: 'NextDataLayerTransformFn dropped it, or the page replaced window.dataLayer',
};
const ICON: Record<State, string> = { ok: '✓', skip: '–', warn: '⚠', off: '○', info: '•' };
const MARK = { ok: 'check', warn: 'warn', skip: 'wait', off: 'wait', info: 'wait' } as const;
const STATED: Record<State, string> = { ok: 'Sent', warn: 'Sent with problems', skip: 'Not sent', off: '', info: '' };
const STEP = { done: 'check', warn: 'warn', todo: 'wait' } as const;
const FUNNEL: Array<[string, string]> = [
  ['page_view', 'every page load'],
  ['view_item', 'a page showing one package'],
  ['view_item_list', 'a page showing packages'],
  ['add_to_cart', 'something is added to the cart'],
  ['begin_checkout', 'once per checkout, when its form is ready'],
  ['add_shipping_info', 'once per checkout, when the shipping address is valid or a shipping method is picked'],
  ['add_payment_info', 'once per checkout, when a submit passes its checks'],
  ['purchase', 'once per order, when it is paid'],
  ['view_upsell', 'each upsell page, when half of an offer is on screen'],
  ['upsell_purchase', 'each accepted upsell, when the order loads'],
];
const VIEWS = ['view_item', 'view_item_list'];
const UPSELLS = ['view_upsell', 'upsell_purchase'];
const KEEP = 300;

const label = (name: EventName) => LABELS[name] ?? name;
const isAnalytics = (e: EngineEvent): e is EngineEvent<'analytics'> => e.name === 'analytics';
const isTrace = (data: unknown): data is AnalyticsTrace => (data as AnalyticsTrace | undefined)?.trace === 'analytics';

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

const money = (value: number, currency: unknown) =>
  format({ type: 'money', value }, currency ? String(currency) : undefined);
const amount = (params: Record<string, unknown>) =>
  typeof params.value === 'number' ? money(params.value, params.currency) : '';
const near = (a: number, b: number) => Math.abs(a - b) <= Math.max(0.01, Math.abs(b) * 0.005);
const total = (amounts: Array<string | number | undefined>) => amounts.reduce((n: number, v) => n + Number(v ?? 0), 0);

const addsUp = (event: AnalyticsEvent, trigger: EngineEvent): Sum | undefined => {
  const { value, currency } = event.params;
  if (typeof value !== 'number') return undefined;
  const m = (n: number) => money(n, currency);
  if (event.name === 'update_cart' && trigger.name === 'cart.calculated') {
    const cart = trigger.data as EventMap['cart.calculated'];
    if (cart.total === undefined) return undefined;
    const lines = total(cart.lines.map((l) => l.total));
    const voucher = total((cart.discounts ?? []).filter((d) => d.source === 'coupon').map((d) => d.amount));
    if (near(value, lines)) return { ok: true, text: `value ${m(value)} = the cart lines ${m(lines)}` };
    if (voucher && near(value, lines + voucher))
      return {
        ok: true,
        text: `value ${m(value)} = the cart lines ${m(lines)} before the ${m(voucher)} voucher, sent as coupon`,
      };
    return { ok: false, text: `value ${m(value)}, but the cart lines come to ${m(lines)}` };
  }
  if (event.name === 'purchase' && trigger.name === 'order.paid') {
    const order = trigger.data as EventMap['order.paid'];
    if (!order.total) return undefined;
    const due = order.total - total(order.lines.filter((l) => l.upsell).map((l) => l.total));
    const shipping = Number(event.params.shipping ?? 0);
    const tax = Number(event.params.tax ?? 0);
    if (near(value + shipping, due))
      return {
        ok: true,
        text: `value ${m(value)} + shipping ${m(shipping)} = ${m(due)}, the order total (prices include tax)`,
      };
    const sum = `value ${m(value)} + shipping ${m(shipping)} + tax ${m(tax)} = ${m(value + shipping + tax)}`;
    return near(value + shipping + tax, due)
      ? { ok: true, text: `${sum}, the order total` }
      : { ok: false, text: `${sum}, but the order total is ${m(due)}` };
  }
  return undefined;
};

const ga4Hits = (): Hit[] =>
  (typeof performance.getEntriesByType === 'function' ? performance.getEntriesByType('resource') : []).flatMap(
    (entry) => {
      try {
        const url = new URL(entry.name);
        const id = url.searchParams.get('tid') ?? '';
        return url.pathname.endsWith('/g/collect') && id.startsWith('G-')
          ? [
              {
                id,
                name: url.searchParams.get('en') ?? '',
                at: performance.timeOrigin + entry.startTime,
                host: url.host,
                params: [...url.searchParams],
              },
            ]
          : [];
      } catch {
        return [];
      }
    },
  );

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

const LOGOS: Record<string, IconName> = { NextDataLayer: 'logo', dataLayer: 'gtm', nextCampaign: 'logo', ga4: 'ga4' };

const chip = (state: State, text: string, title = '', logo?: IconName) =>
  h('span', { className: `chip ${state}`, title }, logo ? icon(logo) : `${ICON[state]} `, text);

export function analyticsFlow(ui: {
  open: Set<string>;
  idOf: (o: object) => number;
  render: () => void;
  config: () => ProviderConfig;
  pages?: () => PageVisit[];
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
    const trigger = (run: Run) => received.filter((e) => e.name === run.trigger && e.at <= run.at + 5).at(-1);
    const sum = (run: Run): Sum | undefined => {
      const event = run.id ? events.get(run.id)?.data : undefined;
      const cause = trigger(run);
      return event && cause ? addsUp(event, cause) : undefined;
    };
    const hits = ga4Hits();
    const seen = new Map<Run, Hit>();
    for (const hit of [...hits].sort((a, b) => a.at - b.at)) {
      const run = [...runs].reverse().find((r) => r.sent && r.name === hit.name && r.at <= hit.at + 50 && !seen.has(r));
      if (run) seen.set(run, hit);
    }
    const issues = (run: Run) => {
      if (!run.sent) return [];
      const event = run.id ? events.get(run.id) : undefined;
      const adds = sum(run);
      return [
        ...(event ? checks(event.data.name, event.data.params) : []),
        ...(adds && !adds.ok ? [adds.text] : []),
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
      trigger,
      sum,
      ga4: [...new Set(hits.map((h) => h.id))],
      seen: (run: Run) => seen.get(run),
      enabled,
      issues,
    };
  };
  type Snapshot = ReturnType<typeof snapshot>;
  let skipped = false;

  const stateOf = (snap: Snapshot, run: Run): State => (!run.sent ? 'skip' : snap.issues(run).length ? 'warn' : 'ok');

  const params = (event: AnalyticsEvent) =>
    h(
      'div',
      'aparams',
      ...Object.entries(event.params)
        .filter(([, v]) => v === null || typeof v !== 'object')
        .map(([k, v]) => h('span', {}, h('i', {}, k), ` ${v}`)),
    );

  const json = (title: string, note: string, value: unknown) => {
    const text = JSON.stringify(value, null, 2);
    const copy = button(
      'Copy',
      () => {
        void navigator.clipboard?.writeText(text);
        copy.textContent = 'Copied';
      },
      { variant: 'ghost', size: 'sm' },
    );
    return h(
      'div',
      'ajson',
      h('div', 'ajhead', h('div', {}, h('b', {}, title), h('small', {}, note)), copy),
      h('pre', {}, text),
    );
  };

  const overview = (snap: Snapshot, run: Run): Child[] => {
    const dl = dlOf(run.name);
    const event = snap.event(run.id)?.data;
    const problems = event ? checks(event.name, event.params) : [];
    const items = event ? itemsOf(event.params) : [];
    const layers = (['NextDataLayer', 'dataLayer'] as Layer[]).filter(snap.enabled).map((layer) => {
      const name = layer === 'dataLayer' ? 'GTM dataLayer' : layer;
      const push = pushedTo(layer, run.id);
      if (!push) return chip('warn', `${name}: not pushed`, NOT_PUSHED[layer], LOGOS[layer]);
      return push['gtm.uniqueEventId'] !== undefined
        ? chip('ok', `${name} · read by GTM`, 'GTM marked this push with gtm.uniqueEventId.', LOGOS[layer])
        : chip('ok', name, '', LOGOS[layer]);
    });
    const hit = snap.seen(run);
    const reached = [
      ...layers,
      hit && chip('ok', `GA4 ${hit.id}`, `A Google Analytics request named ${hit.name} left the page after it.`, 'ga4'),
    ];
    const adds = snap.sum(run);
    const rows: Array<[string, ...Child[]]> = [
      ['Why', h('span', {}, run.reason), h('small', {}, `${label(run.trigger)}: `, h('code', {}, run.trigger))],
      ...(problems.length
        ? [['Problems', ...problems.map((p) => h('span', 'amber', `⚠ ${p}`))] as [string, ...Child[]]]
        : []),
      ...(run.sent ? [['Reached', h('div', 'chips', h('code', {}, dl), ...reached)] as [string, ...Child[]]] : []),
      ...(event ? [['Params', params(event)] as [string, ...Child[]]] : []),
      ...(adds
        ? [
            ['Adds up', h('span', adds.ok ? 'green' : 'amber', `${adds.ok ? '✓' : '⚠'} ${adds.text}`)] as [
              string,
              ...Child[],
            ],
          ]
        : []),
    ];
    return [
      h('dl', 'adetail', ...rows.flatMap(([title, ...value]) => [h('dt', {}, title), h('dd', {}, ...value)])),
      items.length > 0 && h('div', 'aitems', h('p', {}, `Items · ${items.length}`), itemsTable(items)),
    ];
  };

  const tabsOf = (snap: Snapshot, run: Run): Tab[] => {
    const dl = dlOf(run.name);
    const event = snap.event(run.id)?.data;
    const trigger = snap.trigger(run);
    const next = pushedTo('NextDataLayer', run.id);
    const gtm = pushedTo('dataLayer', run.id);
    const hit = snap.seen(run);
    const tabs: Array<Tab | false | undefined> = [
      { id: 'summary', label: 'Summary', body: () => overview(snap, run) },
      (event || trigger) && {
        id: 'event',
        label: 'Event',
        body: () => [
          event && json('analytics', "The SDK's event, as page scripts get it with next.analytics.on", event),
          trigger && json(run.trigger, `What triggered it: ${label(run.trigger)}`, trigger.data),
        ],
      },
      next && {
        id: 'next',
        label: 'NextDataLayer',
        logo: 'logo',
        body: () => [json(dl, 'The push in window.NextDataLayer', next)],
      },
      gtm && {
        id: 'gtm',
        label: 'GTM dataLayer',
        logo: 'gtm',
        body: () => [
          json(
            dl,
            gtm['gtm.uniqueEventId'] !== undefined
              ? 'The push in window.dataLayer, read by GTM'
              : 'The push in window.dataLayer, for GTM tags',
            gtm,
          ),
        ],
      },
      hit && {
        id: 'ga4',
        label: 'GA4',
        logo: 'ga4',
        body: () => [
          h(
            'div',
            'aga4',
            h(
              'p',
              {},
              `The request to ${hit.host} for ${hit.id} that left the page after it. A request that batches several events names only the first in its URL.`,
            ),
            h('table', {}, ...hit.params.map(([k, v]) => h('tr', {}, h('td', 'dim', k), h('td', {}, v)))),
          ),
        ],
      },
    ];
    return tabs.filter((t): t is Tab => !!t);
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
      h(
        'span',
        'amain',
        h('code', {}, run.name),
        h(
          'small',
          {},
          label(run.trigger),
          ' · ',
          snap
            .issues(run)
            .map((i) => `⚠ ${i}`)
            .join(' · ') || sub(snap, run),
        ),
      ),
      h('span', 'aend', event && amount(event.params) && h('b', {}, amount(event.params)), clock(run.at)),
      icon('chevron'),
    );
  };

  let shown: Run[] = [];
  let current: Run | undefined;
  const heading = h('h2', {});
  const subtitle = h('p', {});
  const body = h('section', 'scrollbar-sm');
  const strip = tablist({ variant: 'line', size: 'sm' });
  let tab = 'summary';
  const newer = button('Newer', () => move(-1), { variant: 'outline', size: 'sm' });
  const older = button('Older', () => move(1), { variant: 'outline', size: 'sm' });
  const close = iconButton('close', 'Close dialog', () => dialog.close(), 'icon-sm');
  const dialog = tsugi(
    h(
      'dialog',
      'dialog aevent',
      h(
        'div',
        {},
        h('header', {}, heading, subtitle),
        h('div', 'tabs atabs', strip),
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
    const tabs = tabsOf(snap, run);
    if (!tabs.some((t) => t.id === tab)) tab = 'summary';
    strip.replaceChildren(
      ...tabs.map((t) =>
        tabButton(t.id === tab, () => ((tab = t.id), fill(snapshot(ui.config()))), t.logo && icon(t.logo), t.label),
      ),
    );
    body.replaceChildren(...nodes(tabs.find((t) => t.id === tab)!.body()));
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

  const verdict = (snap: Snapshot) => {
    if (!snap.config.enabled) return h('span', 'dim', snap.provider('NextDataLayer').detail);
    if (!runs.some((r) => r.sent)) return h('span', 'dim', 'Nothing sent yet: analytics starts once the page is idle.');
    const bad = runs.filter((r) => r.sent && snap.issues(r).length);
    const last = bad.at(-1);
    if (last)
      return h('span', 'red', `${plural(bad.length, 'event')} with problems: ${last.name} ${snap.issues(last)[0]}`);
    const warn = snap.providers.find((p) => p.status === 'warn');
    if (warn) return h('span', 'amber', warn.detail);
    if (!snap.config.dataLayer) return h('span', 'amber', 'GTM tags get none of these events: GTM dataLayer is off');
    return h('span', 'green', 'Every event so far was pushed with the fields GA4 requires');
  };

  const funnel = (snap: Snapshot) => {
    const before = (ui.pages?.() ?? []).slice(0, -1);
    const sentAnywhere = (name: string) =>
      runs.some((r) => r.sent && r.name === name) || before.some((p) => p.sent.includes(name));
    const views = VIEWS.filter(sentAnywhere);
    const upsell =
      (ui.pages?.() ?? []).some((p) => p.kind === 'upsell') ||
      runs.some((r) => UPSELLS.includes(r.name) || r.trigger === 'upsell.viewed');
    return FUNNEL.filter(([name]) =>
      VIEWS.includes(name)
        ? views.length
          ? views.includes(name)
          : name === 'view_item_list'
        : !UPSELLS.includes(name) || upsell,
    ).map(([name, when]) => {
      const here = runs.filter((r) => r.name === name);
      const sent = here.filter((r) => r.sent);
      const counts = new Map<string, number>();
      for (const page of before) {
        const n = page.sent.filter((s) => s === name).length;
        if (n) counts.set(KINDS[page.kind], (counts.get(KINDS[page.kind]) ?? 0) + n);
      }
      if (sent.length) counts.set('this page', sent.length);
      const where = [...counts].map(([page, n]) => (n > 1 ? `${page} ×${n}` : page)).join(' · ');
      const problem = sent.flatMap(snap.issues)[0];
      const last = here.at(-1);
      const tone = problem ? 'warn' : counts.size ? 'done' : 'todo';
      const ga4 = sent.some((r) => snap.seen(r)) ? ' · reached GA4' : '';
      const detail = problem
        ? `${where} · ${problem}`
        : where
          ? `${where}${ga4}`
          : last && !last.sent
            ? `Not sent: ${last.reason}`
            : `Not yet: ${when}`;
      const parts = [
        icon(STEP[tone]),
        h('b', {}, h('code', {}, name)),
        h('small', {}, detail.charAt(0).toUpperCase() + detail.slice(1)),
      ];
      const latest = sent.at(-1);
      return latest
        ? h('button', { type: 'button', className: `kstep ${tone}`, onclick: () => inspect(latest) }, ...parts)
        : h('div', `kstep ${tone}`, ...parts);
    });
  };

  const destinations = (snap: Snapshot) => {
    const list = snap.providers.filter((p) => p.id !== 'listeners');
    const notes = snap.config.enabled
      ? [...new Set(list.filter((p) => p.status === 'off' || p.status === 'warn').map((p) => p.detail))]
      : [];
    return h(
      'div',
      'adest devonly',
      h(
        'div',
        'chips',
        'Pushed to',
        ...list.map((p) => chip(p.status, `${p.name} · ${p.short}`, p.detail, LOGOS[p.id])),
        snap.ga4.length > 0 &&
          chip(
            'ok',
            `GA4 · ${snap.ga4.join(', ')}`,
            'Google Analytics requests seen leaving this page. An event batched into another request does not show by name.',
            'ga4',
          ),
      ),
      ...notes.map((note) => h('p', {}, note)),
    );
  };

  const events = (snap: Snapshot, query: string) => {
    const matching = runs.filter((r) =>
      `${r.name} ${r.trigger} ${label(r.trigger)} ${r.reason}`.toLowerCase().includes(query),
    );
    const sent = matching.filter((r) => r.sent);
    const not = matching.length - sent.length;
    shown = [...(skipped ? matching : sent)].reverse();
    const toggle = h(
      'button',
      {
        type: 'button',
        className: 'link',
        onclick: () => {
          skipped = !skipped;
          ui.render();
        },
      },
      skipped ? 'Hide not sent' : `Show ${not} not sent`,
    );
    return h(
      'div',
      'block',
      h(
        'div',
        'bhead',
        h(
          'div',
          {},
          h('h4', {}, 'On this page'),
          h('p', {}, `${sent.length} sent, newest first. Open one for its data.`),
        ),
        not > 0 && h('div', 'bact', toggle),
      ),
      shown.length
        ? h('div', 'alog', ...shown.map((run) => row(snap, run)))
        : h('p', 'anone', query ? 'Nothing matches the filter.' : 'Nothing sent yet.'),
    );
  };

  const view = (query: string): Child[] => {
    const snap = snapshot(ui.config());
    const out = [
      h(
        'div',
        'block',
        h('div', 'bhead', h('div', {}, h('h4', {}, 'Tracking'), h('p', {}, verdict(snap)))),
        h('div', 'ksteps afunnel', ...funnel(snap)),
        destinations(snap),
      ),
      events(snap, query),
    ];
    fill(snap);
    return out;
  };

  const problems = () => {
    const snap = snapshot(ui.config());
    const byName = new Map<string, Run[]>();
    for (const run of runs) if (snap.issues(run).length) byName.set(run.name, [...(byName.get(run.name) ?? []), run]);
    return [...byName].map(([name, list]) => ({
      text: `${name}: ${snap.issues(list.at(-1)!).join(' · ')}${list.length > 1 ? ` (${list.length} events)` : ''}`,
      error: true,
    }));
  };

  const notes = () =>
    started()
      ? snapshot(ui.config())
          .providers.filter((p) => p.status === 'warn')
          .map((p) => p.detail)
      : [];

  const summary = () => {
    const ga = runs.filter((r) => r.sent && !r.name.startsWith('dl_')).length;
    const n = problems().length;
    return `${ga} sent${n ? ` · ⚠ ${n}` : ''}`;
  };

  return { record, note, view, summary, problems, notes, dialog };
}
