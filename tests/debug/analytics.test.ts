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
  const flow = analyticsFlow({ open: new Set(), idOf, render: () => paint(), config: () => config });
  const paint = (query = '') => root.replaceChildren(...nodes(flow.view(query)));
  engine.on('*', flow.record);
  const row = (dl: string) =>
    [...root.querySelectorAll<HTMLDetailsElement>('.wire')].find((w) => w.querySelector('.dl')!.textContent === dl)!;
  const cells = (dl: string) => [...row(dl).querySelector('summary')!.children].map((c) => c.textContent);
  return { engine, flow, root, paint, row, cells };
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

describe('providers', () => {
  it('flags a provider that is on but has nothing to send to', () => {
    win.NextDataLayer = [{}, {}];
    expect(providers(ON, true)).toEqual([
      ['ok', 'NextDataLayer', 'window.NextDataLayer has 2 dl_* events (Elevar format)'],
      [
        'warn',
        'GTM dataLayer',
        'On, but no GTM container on this page: dl_* events wait in window.dataLayer unless another tool reads them',
      ],
      ['warn', 'NEXT analytics', 'On, but its script is not on the page'],
    ]);
  });

  it('shows the GTM container and the NEXT script once they load', () => {
    win.google_tag_manager = { 'GTM-ABC123': {}, 'G-XYZ': {} };
    win.nextCampaign = { event() {} };
    expect(providers(ON, true).slice(1)).toEqual([
      ['ok', 'GTM dataLayer', 'window.dataLayer, read by GTM-ABC123'],
      ['ok', 'NEXT analytics', 'Script loaded; it sends its own page_view'],
    ]);
  });

  it('names the nextConfig key that turns a provider off, and providers that are no longer built in', () => {
    win.NextDataLayerTransformFn = () => null;
    const config = { enabled: true, nextCampaign: false, dataLayer: false, unsupported: ['facebook'] };
    expect(providers(config, false)).toEqual([
      ['off', 'NextDataLayer', 'Starts once the page is idle after ready'],
      ['off', 'GTM dataLayer', 'Off: nextConfig.analytics.providers.gtm.enabled is false'],
      ['off', 'NEXT analytics', 'Off: nextConfig.analytics.providers.nextCampaign.enabled is false'],
      ['warn', 'Meta Pixel', 'On in nextConfig (providers.facebook), but no longer built in: add it as a GTM tag'],
      ['info', 'NextDataLayerTransformFn', 'Set: it can change or drop each dl_* event before it is pushed'],
    ]);
    expect(providers({ ...ON, enabled: false }, false)).toEqual([
      ['off', 'Analytics', 'Off: nextConfig.analytics.enabled is false, so nothing is sent'],
    ]);
  });
});

describe('analytics tab', () => {
  it('shows each route from engine event to data layer, with what fired on this page', () => {
    const { engine, root, paint, row, cells } = setup();
    win.NextDataLayer = [
      { event: 'dl_user_data', event_id: 'pv' },
      { event: 'dl_add_to_cart', event_id: 'atc' },
    ];
    engine.events.emit('ready', { lines: [] });
    engine.events.emit('analytics', event('page_view', { page_title: 'Olympus' }, 'pv'));
    engine.events.emit('cart.calculated', { summary: {} as never });
    engine.events.emit('analytics', event('add_to_cart', { currency: 'USD', value: 49, items: [EARBUDS] }, 'atc'));
    paint();
    expect(cells('dl_add_to_cart')).toEqual(['ready1cart.calculated1', '→', 'add_to_cart1', '→', 'dl_add_to_cart1']);
    expect(cells('dl_cart_updated')).toEqual(['cart.calculated1', '→', 'update_cartcustom', '→', 'dl_cart_updated']);
    expect(row('dl_cart_updated').className).toBe('wire idle');
    expect(cells('dl_exit_intent_shown')).toEqual(['exit-intent.shown', '→', 'none', '→', 'dl_exit_intent_shown']);
    expect(row('dl_add_to_cart').className).toBe('wire');
    expect(row('dl_purchase').className).toBe('wire idle');
    expect(row('dl_add_to_cart').querySelector<HTMLElement>('.eng')!.title).toBe(
      'Once, when the campaign and the page’s values are in',
    );
    expect(root.querySelector('.prov')!.textContent).toBe(
      '✓NextDataLayerwindow.NextDataLayer has 2 dl_* events (Elevar format)',
    );
  });

  it('opens a route to each send: what it carried, the GA4 check and where it was pushed', async () => {
    const { engine, paint, row } = setup();
    win.NextDataLayer = [{ event: 'dl_purchase', event_id: 'p1' }];
    engine.events.emit(
      'analytics',
      event('purchase', { currency: 'USD', value: 98, transaction_id: 'R1', items: [EARBUDS] }, 'p1'),
    );
    engine.events.emit('analytics', event('purchase', { value: 98, items: [] }, 'p2'));
    paint();
    expect(row('dl_purchase').querySelector('summary .fail')!.getAttribute('title')).toBe(
      '1 sent without a field GA4 requires',
    );
    row('dl_purchase').open = true;
    await vi.waitFor(() => expect(row('dl_purchase').querySelectorAll('.send')).toHaveLength(2));
    const sends = [...row('dl_purchase').querySelectorAll('.send > summary')].map((s) =>
      [...s.children].slice(1).map((c) => c.textContent),
    );
    expect(sends).toEqual([
      ['Earbuds ×1', '$98.00', '✓'],
      ['', '98.00', '⚠'],
    ]);
    expect(row('dl_purchase').querySelectorAll<HTMLElement>('.send .fail')[0]!.title).toBe(
      'items is empty\nvalue is set without currency\ntransaction_id is missing\nnot in NextDataLayer',
    );
    expect(row('dl_purchase').querySelector('.why')!.textContent).toBe('Once per order, only when paid.');
  });

  it('lists the engine events that are not sent to analytics, with when they fire', () => {
    const { engine, root, paint } = setup();
    engine.events.emit('selection.changed', { selectorId: 'main', cardId: 'bundle-2x', items: [] });
    paint();
    const others = [...root.querySelectorAll('.other > summary')].map((s) => s.textContent);
    expect(others).toContain('selection.changed1A bundle pick, quantity or slot changed');
    expect(others).toContain('coupon.refusedThe server gives no discount for a code');
    expect(others.some((o) => o!.startsWith('ready'))).toBe(false);
  });

  it('narrows routes and events to the filter', () => {
    const { root, paint } = setup();
    paint('upsell');
    expect([...root.querySelectorAll('.wire .dl')].map((d) => d.textContent)).toEqual([
      'dl_upsell_purchase',
      'dl_viewed_upsell',
      'dl_skipped_upsell',
    ]);
    expect([...root.querySelectorAll('.other .sdk-name')].map((d) => d.textContent)).toEqual(['upsell.accepted']);
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
