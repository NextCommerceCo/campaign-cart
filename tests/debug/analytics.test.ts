import { afterEach, describe, expect, it, vi } from 'vitest';
import { startAnalytics } from '../../src/analytics';
import { EXIT_INTENT, NAMES } from '../../src/compat/analytics';
import { analyticsFlow, checks, type ProviderConfig, providers, WIRING } from '../../src/debug/analytics';
import { nodes } from '../../src/debug/view';
import type { AnalyticsEvent } from '../../src/engine/types';
import { flush, makeEngine } from '../fixtures/engine';
import { ORDER } from '../fixtures/order';

const event = (name: string, params: Record<string, unknown>, id = `${name}_1`) =>
  ({ name, id, time: '', params, context: {} }) as unknown as AnalyticsEvent;

const EARBUDS = { item_id: '11', item_name: 'Earbuds', quantity: 1, price: 49 };
const ON: ProviderConfig = { enabled: true, nextCampaign: true, dataLayer: true, unsupported: [] };

type Win = Window & {
  NextDataLayer?: unknown[];
  dataLayer?: unknown[];
  google_tag_manager?: unknown;
  nextCampaign?: unknown;
  NextDataLayerTransformFn?: unknown;
};
const win = window as Win;

function setup(config: ProviderConfig = ON) {
  const { engine } = makeEngine();
  const root = document.createElement('div');
  const ids = new WeakMap<object, number>();
  let seq = 0;
  const idOf = (o: object) => {
    if (!ids.has(o)) ids.set(o, ++seq);
    return ids.get(o)!;
  };
  let filter = '';
  const flow = analyticsFlow({ open: new Set(), idOf, render: () => paint(), config: () => config });
  const paint = (query = filter) => {
    filter = query;
    root.replaceChildren(...nodes(flow.view(query)));
  };
  engine.on('*', flow.record);
  const node = (id: string) => root.querySelector<SVGGElement>(`.gn[data-id="${id}"]`)!;
  const edge = (from: string, to: string) => root.querySelector(`.ge[data-from="${from}"][data-to="${to}"]`)!;
  const on = () => [...root.querySelectorAll('.gn.on')].map((g) => g.getAttribute('data-id'));
  return { engine, flow, root, paint, node, edge, on };
}

afterEach(() => {
  for (const key of ['NextDataLayer', 'dataLayer', 'google_tag_manager', 'nextCampaign', 'NextDataLayerTransformFn'])
    delete (win as unknown as Record<string, unknown>)[key];
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

describe('the wiring map matches the analytics code', () => {
  it('names the same data layer event as the data layer code for every analytics event', () => {
    const ga = WIRING.filter((w) => w.ga).map((w) => [w.ga, w.dl]);
    expect(Object.fromEntries(ga)).toEqual(NAMES);
    const exits = WIRING.filter((w) => !w.ga).map((w) => [w.from[0], w.dl]);
    expect(Object.fromEntries(exits)).toEqual({
      ...Object.fromEntries(Object.entries(EXIT_INTENT).map(([from, name]) => [from, `dl_exit_intent_${name}`])),
      'exit-intent.action': 'dl_exit_intent_action',
    });
  });

  it('lists every engine event that sends an analytics event, and nothing it does not send', async () => {
    document.body.innerHTML = '<div data-next-package-id="1"></div>';
    const { engine } = makeEngine();
    const seen = new Set<string>();
    let cause: string | undefined;
    engine.on('*', (e) => {
      if (e.name !== 'analytics') {
        cause = e.name;
        queueMicrotask(() => (cause = undefined));
      } else seen.add(`${cause} → ${(e.data as AnalyticsEvent).name}`);
    });
    startAnalytics(engine, { apiKey: 'pk_test', version: '1', nextCampaign: false });
    await engine.start();
    await engine.cart.addItem(1);
    await engine.cart.removeItem(1);
    engine.events.emit('checkout.started', { lines: [] });
    engine.events.emit('checkout.shipping-added', { tier: 'standard' });
    engine.events.emit('checkout.payment-added', { method: 'card_token' });
    engine.events.emit('order.loaded', {
      order: ORDER,
      purchase: ORDER.ref_id,
      upsells: [{ id: 'u1', number: 1, line: ORDER.lines![0]! }],
    });
    engine.events.emit('upsell.viewed', { refId: 'R1', page: '/upsell' });
    engine.events.emit('upsell.skipped', { refId: 'R1' });
    await flush();
    const allowed = new Set(WIRING.flatMap((w) => w.from.map((f) => `${f} → ${w.ga}`)));
    expect([...seen].filter((pair) => !allowed.has(pair))).toEqual([]);
    expect(new Set([...seen].map((pair) => pair.split(' → ')[1]))).toEqual(
      new Set(WIRING.map((w) => w.ga).filter((ga) => ga && ga !== 'view_item_list')),
    );
    for (const w of WIRING.filter((w) => !w.ga)) {
      engine.events.emit(w.from[0]!, { imageUrl: '', template: '' } as never);
      expect((win.NextDataLayer!.at(-1) as { event: string }).event).toBe(w.dl);
    }
  });
});

const rows = (list: ReturnType<typeof providers>) => list.map((p) => [p.status, p.name, p.short, p.detail]);

describe('providers', () => {
  it('flags a provider that is on but has nothing to send to', () => {
    win.NextDataLayer = [{}, {}];
    expect(rows(providers(ON, true))).toEqual([
      ['ok', 'NextDataLayer', '2 events', 'window.NextDataLayer has 2 dl_* events.'],
      ['warn', 'GTM dataLayer', 'no GTM container', 'GTM dataLayer is on, but this page has no GTM container.'],
      ['info', 'Page scripts', "next.on('analytics')", "Page scripts get every event with next.on('analytics', fn)."],
      ['warn', 'NEXT analytics', 'not loaded', 'NEXT analytics is on, but its script is not on the page.'],
    ]);
  });

  it('shows the GTM container and the NEXT script once they load', () => {
    win.google_tag_manager = { 'GTM-ABC123': {}, 'G-XYZ': {} };
    win.nextCampaign = { event() {} };
    const list = rows(providers(ON, true));
    expect(list[1]).toEqual(['ok', 'GTM dataLayer', 'GTM-ABC123', 'window.dataLayer, read by GTM-ABC123.']);
    expect(list[3]).toEqual(['ok', 'NEXT analytics', 'own page_view', 'Its own script sends page_view.']);
  });

  it('names the nextConfig key that turns a provider off, and providers that are no longer built in', () => {
    win.NextDataLayerTransformFn = () => null;
    const config = { enabled: true, nextCampaign: false, dataLayer: false, unsupported: ['facebook'] };
    expect(rows(providers(config, false))).toEqual([
      ['off', 'NextDataLayer', 'waits for idle', 'Starts once the page is idle.'],
      ['off', 'GTM dataLayer', 'off', 'Off in nextConfig: analytics.providers.gtm.enabled is false.'],
      ['info', 'Page scripts', "next.on('analytics')", "Page scripts get every event with next.on('analytics', fn)."],
      ['off', 'NEXT analytics', 'off', 'Off in nextConfig: analytics.providers.nextCampaign.enabled is false.'],
      [
        'warn',
        'Meta Pixel',
        'not built in',
        'Meta Pixel is on in nextConfig, but the SDK no longer sends to it. Add it as a GTM tag.',
      ],
      ['info', 'NextDataLayerTransformFn', 'set', 'NextDataLayerTransformFn can change or drop each dl_* event.'],
    ]);
    expect(providers({ ...ON, enabled: false }, false).map((p) => [p.status, p.detail])).toContainEqual([
      'off',
      'Analytics is off: nextConfig.analytics.enabled is false.',
    ]);
  });
});

function shop(engine: ReturnType<typeof setup>['engine']) {
  win.NextDataLayer = [
    { event: 'dl_user_data', event_id: 'pv' },
    { event: 'dl_add_to_cart', event_id: 'atc' },
  ];
  engine.events.emit('ready', { lines: [] });
  engine.events.emit('analytics', event('page_view', { page_title: 'Olympus' }, 'pv'));
  engine.events.emit('cart.calculated', { summary: {} as never });
  engine.events.emit('analytics', event('add_to_cart', { currency: 'USD', value: 49, items: [EARBUDS] }, 'atc'));
}

describe('analytics graph', () => {
  it('shows only what happened on this page, in plain words, and where it went', () => {
    const { engine, root, paint, node, edge } = setup();
    shop(engine);
    paint();
    expect(root.querySelector('.headline')!.textContent).toBe('2 GA4 events sent✓ GA4 fields OKShow every route');
    expect([...root.querySelectorAll('.gn')].map((g) => g.getAttribute('data-id'))).toEqual([
      'e:ready',
      'e:cart.calculated',
      'a:page_view',
      'a:add_to_cart',
      'd:NextDataLayer',
      'd:dataLayer',
      'd:listeners',
      'd:nextCampaign',
    ]);
    expect(node('e:ready').textContent).toBe(
      'ready: Once, when the campaign and the page’s values are inPage loaded×1',
    );
    expect(node('a:add_to_cart').getAttribute('class')).toBe('gn ga ga-node');
    expect(node('d:dataLayer').textContent).toContain('no GTM container');
    expect(root.querySelector('.alert')!.textContent).toBe(
      '⚠ GTM dataLayer is on, but this page has no GTM container.',
    );
    expect(edge('e:cart.calculated', 'a:add_to_cart').getAttribute('class')).toBe('ge lit from-engine');
    expect(edge('a:add_to_cart', 'bus').getAttribute('class')).toBe('ge lit');
    expect(root.querySelector('.ge.bus')!.getAttribute('class')).toBe('ge bus lit');
    expect(edge('bus', 'd:NextDataLayer').getAttribute('class')).toBe('ge lit');
    expect(edge('bus', 'd:dataLayer').getAttribute('class')).toBe('ge');
    expect(edge('e:ready', 'd:nextCampaign')).not.toBeNull();
  });

  it('shows every route on request, idle ones dimmed, and dashes the routes into a provider that is off', () => {
    const { root, paint, node, edge } = setup({ ...ON, dataLayer: false });
    paint();
    expect(root.querySelector('.graph')).toBeNull();
    expect(root.textContent).toContain('Nothing sent yet');
    const toggle = root.querySelector<HTMLInputElement>('.switch input')!;
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change'));
    expect(root.querySelectorAll('.gn.ga-node')).toHaveLength(13);
    expect(root.querySelectorAll('.gn[data-id^="e:"]')).toHaveLength(10);
    expect(node('a:purchase').getAttribute('class')).toBe('gn idle ga-node');
    expect(node('d:dataLayer').getAttribute('class')).toBe('gn off');
    expect(edge('bus', 'd:dataLayer').getAttribute('class')).toBe('ge dash');
    expect(edge('e:exit-intent.*', 'd:NextDataLayer')).not.toBeNull();
    expect(edge('e:exit-intent.*', 'd:listeners')).toBeNull();
  });

  it('traces a node’s paths on hover, and keeps the trace of the selected node', () => {
    const { engine, root, paint, node, on } = setup();
    shop(engine);
    paint();
    node('e:cart.calculated').dispatchEvent(new Event('mouseenter'));
    expect(root.querySelector('.graph')!.classList.contains('tracing')).toBe(true);
    expect(on()).toEqual(['e:cart.calculated', 'a:add_to_cart', 'd:NextDataLayer', 'd:dataLayer', 'd:listeners']);
    expect(root.querySelector('.ge.bus')!.classList.contains('on')).toBe(true);
    node('e:cart.calculated').dispatchEvent(new Event('mouseleave'));
    expect(root.querySelector('.graph')!.classList.contains('tracing')).toBe(false);
    node('d:nextCampaign').dispatchEvent(new Event('click'));
    expect(node('d:nextCampaign').getAttribute('class')).toContain('sel');
    expect(on()).toEqual(['e:ready', 'd:nextCampaign']);
  });

  it('shows what an analytics event sent when it is clicked', () => {
    const { engine, root, paint, node } = setup();
    win.NextDataLayer = [{ event: 'dl_purchase', event_id: 'p1' }];
    engine.events.emit(
      'analytics',
      event('purchase', { currency: 'USD', value: 98, transaction_id: 'R1', items: [EARBUDS] }, 'p1'),
    );
    engine.events.emit('analytics', event('purchase', { value: 98, items: [] }, 'p2'));
    paint();
    expect(root.querySelector('.headline')!.textContent).toContain('⚠ 1 missing GA4 fields');
    expect(node('a:purchase').textContent).toContain('⚠ ×2');
    node('a:purchase').dispatchEvent(new Event('click'));
    const detail = root.querySelector('.detail')!;
    expect(detail.querySelector('.dhead')!.textContent).toBe('purchase→ dl_purchaseClose');
    expect(detail.querySelector('.why')!.textContent).toBe('From Order loaded. Once per order, only when paid.');
    const sends = [...detail.querySelectorAll('.send > summary')].map((s) =>
      [...s.children].slice(1).map((c) => c.textContent),
    );
    expect(sends).toEqual([
      ['Earbuds ×1', '$98.00', '✓'],
      ['', '98.00', '⚠'],
    ]);
    expect(detail.querySelectorAll<HTMLElement>('.send .fail')[0]!.title).toBe(
      'items is empty\nvalue is set without currency\ntransaction_id is missing\nnot in NextDataLayer',
    );
    detail.querySelector<HTMLElement>('.link')!.click();
    expect(root.querySelector('.detail')).toBeNull();
    expect(root.querySelector('.tip')!.textContent).toBe('Click a node to see what it sent.');
  });

  it('shows what an engine event, the exit popup and a provider carry when clicked', () => {
    const { engine, root, paint, node } = setup();
    shop(engine);
    win.NextDataLayer!.push({ event: 'dl_exit_intent_shown' });
    engine.events.emit('exit-intent.shown', {} as never);
    paint();
    node('e:exit-intent.*').dispatchEvent(new Event('click'));
    expect([...root.querySelectorAll('.detail .line')].map((l) => l.textContent)).toContain(
      'exit-intent.shown1 → dl_exit_intent_shown',
    );
    node('e:cart.calculated').dispatchEvent(new Event('click'));
    expect(root.querySelector('.detail .dhead')!.textContent).toBe('Cart pricedcart.calculatedClose');
    expect([...root.querySelectorAll('.detail .line')].map((l) => l.textContent)).toEqual([
      '→ add_to_cart1',
      '→ remove_from_cart',
      '→ update_cart',
    ]);
    node('d:NextDataLayer').dispatchEvent(new Event('click'));
    expect(root.querySelector('.detail .why')!.textContent).toBe('window.NextDataLayer has 3 dl_* events.');
    expect([...root.querySelectorAll('.detail .line')].map((l) => l.textContent)).toEqual([
      'dl_user_data1',
      'dl_add_to_cart1',
      'dl_exit_intent_shown1',
    ]);
  });

  it('lights the nodes that match the filter, by plain word or code name', () => {
    const { engine, paint, on } = setup();
    shop(engine);
    paint('cart.calc');
    expect(on()).toEqual(['e:cart.calculated']);
    paint('page');
    expect(on()).toEqual(['e:ready', 'a:page_view', 'd:listeners']);
  });

  it('folds the engine events that are not sent to analytics into one line', async () => {
    const { engine, root, paint } = setup();
    engine.events.emit('selection.changed', { selectorId: 'main', cardId: 'bundle-2x', items: [] });
    paint();
    const more = root.querySelector<HTMLDetailsElement>('.more')!;
    expect(more.querySelector('summary')!.textContent).toBe('Other SDK events, not sent to analytics9');
    more.open = true;
    await vi.waitFor(() => expect(more.querySelectorAll('.other')).toHaveLength(9));
    const others = [...more.querySelectorAll('.other > summary')].map((s) => s.textContent);
    expect(others).toContain('selection.changed1A bundle pick, quantity or slot changed');
    expect(others.some((o) => o!.startsWith('ready'))).toBe(false);
  });
});

describe('checks', () => {
  it('checks what GA4 requires', () => {
    expect(checks('page_view', { page_title: 'x' })).toEqual([]);
    expect(checks('add_to_cart', { currency: 'USD', value: 49, items: [EARBUDS] })).toEqual([]);
    expect(checks('add_to_cart', { value: 49, items: [{ quantity: 1 }] })).toEqual([
      'an item has neither item_id nor item_name',
      'value is set without currency',
    ]);
    expect(checks('upsell_purchase', { currency: 'USD', items: [EARBUDS] })).toEqual(['transaction_id is missing']);
  });
});
