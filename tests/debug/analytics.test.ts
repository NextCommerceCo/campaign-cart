import { afterEach, describe, expect, it, vi } from 'vitest';
import { startAnalytics } from '../../src/analytics';
import { EXIT_INTENT, NAMES } from '../../src/compat/analytics';
import { analyticsFlow, checks, type ProviderConfig, providers, WIRING } from '../../src/debug/analytics';
import { nodes } from '../../src/debug/view';
import type { AnalyticsEvent, AnalyticsTrace, EventName } from '../../src/engine/types';
import { flush, makeEngine } from '../fixtures/engine';
import { ORDER } from '../fixtures/order';

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
  engine.log.stream(flow.note, { replay: true });
  const decide = (trigger: EventName, name: string, sent: boolean, reason: string, id?: string) => {
    const trace: AnalyticsTrace = { trace: 'analytics', trigger, name, sent, reason, ...(id && { id }) };
    engine.log.debug(`analytics ${name}`, trace);
  };
  const send = (trigger: EventName, name: string, params: Record<string, unknown>, id: string, layers = true) => {
    engine.events.emit('analytics', { name, id, time: '', params, context: {} } as unknown as AnalyticsEvent);
    if (layers)
      for (const layer of [(win.NextDataLayer ??= []), (win.dataLayer ??= [])])
        layer.push({ event: `dl_${name}`, event_id: id });
    decide(trigger, name, true, `reason for ${name}`, id);
  };
  const runs = () =>
    [...root.querySelectorAll('.rhead > :first-child, .run')].map((r) =>
      r.classList.contains('run')
        ? ['.ricon', 'code', 'small'].map((q) => r.querySelector(q)!.textContent).join(' ')
        : r.textContent,
    );
  const run = (name: string) =>
    [...root.querySelectorAll<HTMLElement>('.run')].find((r) => r.querySelector('code')!.textContent === name)!;
  const steps = () =>
    [...root.querySelectorAll('.step')].map((s) => [
      s.className.replace('step ', ''),
      s.querySelector('.stitle')!.textContent,
      s.querySelector('.sdetail')?.textContent ?? '',
      [...s.querySelectorAll('.chip')].map((c) => c.textContent).join(', '),
    ]);
  return { engine, root, paint, decide, send, runs, run, steps };
}

afterEach(() => {
  vi.useRealTimers();
  for (const key of ['NextDataLayer', 'dataLayer', 'google_tag_manager', 'nextCampaign', 'NextDataLayerTransformFn'])
    delete (win as unknown as Record<string, unknown>)[key];
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

describe('the workflows match the analytics code', () => {
  it('names the same data layer event as the data layer code for every analytics event', () => {
    const ga = WIRING.filter((w) => w.ga).map((w) => [w.ga, w.dl]);
    expect(Object.fromEntries(ga)).toEqual(NAMES);
    const exits = WIRING.filter((w) => !w.ga).map((w) => [w.from[0], w.dl]);
    expect(Object.fromEntries(exits)).toEqual({
      ...Object.fromEntries(Object.entries(EXIT_INTENT).map(([from, name]) => [from, `dl_exit_intent_${name}`])),
      'exit-intent.action': 'dl_exit_intent_action',
    });
  });

  it('lists every trigger that sends each event, and nothing the code does not send', async () => {
    document.body.innerHTML = '<div data-next-package-id="1"></div>';
    const { engine } = makeEngine();
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
    for (const w of WIRING.filter((w) => !w.ga))
      engine.events.emit(w.from[0]!, { imageUrl: '', template: '' } as never);
    await flush();
    const traced = engine.log
      .entries()
      .map((e) => e.data as AnalyticsTrace | undefined)
      .filter((d): d is AnalyticsTrace => d?.trace === 'analytics' && d.sent)
      .map((d) => `${d.trigger} → ${d.name}`);
    const allowed = new Set(WIRING.flatMap((w) => w.from.map((f) => `${f} → ${w.ga ?? w.dl}`)));
    expect(traced.filter((pair) => !allowed.has(pair))).toEqual([]);
    expect(new Set(traced.map((pair) => pair.split(' → ')[1]))).toEqual(
      new Set(WIRING.map((w) => w.ga ?? w.dl).filter((name) => name !== 'view_item_list')),
    );
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

describe('analytics workflow', () => {
  it('lists each run under what triggered it, newest first, with the ones that were not sent', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { engine, root, paint, decide, send, runs } = setup();
    vi.setSystemTime(10_000);
    engine.events.emit('ready', { lines: [] });
    send('ready', 'page_view', { page_title: 'Olympus' }, 'pv');
    decide('ready', 'view_item', false, 'No package on the page');
    vi.setSystemTime(20_000);
    engine.events.emit('cart.calculated', { summary: {} as never });
    decide('cart.calculated', 'remove_from_cart', false, 'Nothing was removed since the last report');
    send('cart.calculated', 'add_to_cart', { currency: 'USD', value: 49, items: [EARBUDS] }, 'atc');
    paint();
    expect(root.querySelector('.wf-sum')!.textContent).toBe('2 GA4 events sent0 problems');
    expect(runs()).toEqual([
      'Cart priced',
      '✓ add_to_cart + Earbuds ×1 · $49.00',
      '– remove_from_cart not sent',
      'Page loaded',
      '✓ page_view Olympus',
      '– view_item not sent',
    ]);
    expect(root.querySelector('.run.on code')!.textContent).toBe('add_to_cart');
  });

  it('walks a sent run from trigger to delivery', () => {
    win.google_tag_manager = { 'GTM-ABC123': {} };
    const { engine, root, paint, send, steps } = setup();
    engine.events.emit('cart.calculated', { summary: {} as never });
    send('cart.calculated', 'add_to_cart', { currency: 'USD', value: 49, items: [EARBUDS] }, 'atc');
    paint();
    expect(steps()).toEqual([
      ['ok', 'Triggercart.calculated', expect.stringMatching(/^Cart priced at \d\d:\d\d:\d\d$/), ''],
      ['ok', 'Decide', 'Send: reason for add_to_cart', ''],
      ['ok', 'Buildadd_to_cart', '+ Earbuds ×1 · $49.00', ''],
      ['ok', 'Pushdl_add_to_cart', '', '✓ NextDataLayer, ✓ GTM dataLayer'],
      ['ok', 'Deliver', '', "✓ Page scripts (next.on('analytics')), ✓ GTM GTM-ABC123 → GA4, Meta…"],
    ]);
    expect(root.querySelector('.green')!.textContent).toBe('✓ Has every field GA4 requires');
  });

  it('stops a run that was not sent at Decide, and says why', () => {
    const { engine, paint, decide, run, steps } = setup();
    engine.events.emit('cart.calculated', { summary: {} as never });
    decide('cart.calculated', 'remove_from_cart', false, 'Nothing was removed since the last report');
    paint();
    run('remove_from_cart').click();
    expect(steps().map(([state, title, detail]) => [state, title, detail])).toEqual([
      ['ok', 'Triggercart.calculated', expect.any(String)],
      ['skip', 'Decide', 'Stop: Nothing was removed since the last report'],
      ['skip', 'Build', 'Not run'],
      ['skip', 'Push', 'Not run'],
      ['skip', 'Deliver', 'Not run'],
    ]);
  });

  it('flags missing GA4 fields and a push that did not arrive', () => {
    const { engine, root, paint, send, steps } = setup();
    engine.events.emit('order.loaded', { order: ORDER });
    send('order.loaded', 'purchase', { value: 98, items: [] }, 'p1', false);
    win.NextDataLayer = [{ event: 'dl_purchase', event_id: 'p1' }];
    win.dataLayer = [];
    paint();
    expect(root.querySelector('.wf-sum')!.textContent).toBe('1 GA4 event sent1 problem');
    expect(root.querySelector('.run')!.className).toBe('run warn on');
    const [, , build, push] = steps();
    expect(build![0]).toBe('warn');
    expect(root.querySelector('.step.warn .amber')!.textContent).toBe(
      '⚠ items is empty⚠ value is set without currency⚠ transaction_id is missing',
    );
    expect(push).toEqual(['warn', 'Pushdl_purchase', '', '✓ NextDataLayer, ⚠ GTM dataLayer: not pushed']);
  });

  it('shows a provider that is off, and the NEXT script for page_view', () => {
    win.nextCampaign = { event() {} };
    const { engine, root, paint, send, steps } = setup({ ...ON, dataLayer: false });
    engine.events.emit('ready', { lines: [] });
    send('ready', 'page_view', { page_title: 'Olympus' }, 'pv');
    paint();
    expect(root.querySelector('.wf-sum')!.textContent).toBe('1 GA4 event sent0 problems1 provider off');
    const [, , , push, deliver] = steps();
    expect(push![3]).toBe('✓ NextDataLayer, ○ GTM dataLayer: off');
    expect(deliver![3]).toBe(
      "✓ Page scripts (next.on('analytics')), ○ GTM dataLayer: off, ✓ NEXT analytics (own page_view)",
    );
  });

  it('runs the exit popup straight to the data layer', () => {
    const { engine, paint, decide, steps } = setup();
    win.NextDataLayer = [{ event: 'dl_exit_intent_shown', event_id: 'x1' }];
    win.dataLayer = [{ event: 'dl_exit_intent_shown', event_id: 'x1' }];
    engine.events.emit('exit-intent.shown', {} as never);
    decide('exit-intent.shown', 'dl_exit_intent_shown', true, 'Data layer only: there is no analytics event', 'x1');
    paint();
    expect(steps()).toEqual([
      ['ok', 'Triggerexit-intent.shown', expect.stringMatching(/^Exit popup shown at /), ''],
      ['ok', 'Decide', 'Send: Data layer only: there is no analytics event', ''],
      ['off', 'Build', 'No analytics event: the data layer gets this directly', ''],
      ['ok', 'Pushdl_exit_intent_shown', '', '✓ NextDataLayer, ✓ GTM dataLayer'],
      ['warn', 'Deliver', '', '⚠ GTM dataLayer: no GTM container'],
    ]);
  });

  it('shows the data at a step on request', async () => {
    const { engine, root, paint, send } = setup();
    engine.events.emit('cart.calculated', { summary: {} as never });
    send('cart.calculated', 'add_to_cart', { currency: 'USD', value: 49, items: [EARBUDS] }, 'atc');
    paint();
    const data = root.querySelectorAll<HTMLDetailsElement>('.sdata')[1]!;
    data.open = true;
    await vi.waitFor(() => expect(data.querySelector('table')).not.toBeNull());
    expect(data.querySelector('table')!.textContent).toBe('itemidqtypriceEarbuds11149');
  });

  it('filters runs, and explains an empty page', () => {
    const { engine, root, paint, decide, send, runs } = setup();
    paint();
    expect(root.textContent).toContain('Nothing sent yet');
    expect(root.textContent).toContain('Analytics starts once the page is idle.');
    engine.events.emit('ready', { lines: [] });
    send('ready', 'page_view', {}, 'pv');
    decide('ready', 'view_item', false, 'No package on the page');
    paint('package');
    expect(runs()).toEqual(['Page loaded', '– view_item not sent']);
  });

  it('lists every workflow the SDK has', async () => {
    const { root, paint } = setup();
    paint();
    const flows = root.querySelector<HTMLDetailsElement>('.more')!;
    expect(flows.querySelector('summary')!.textContent).toBe(`All workflows${WIRING.length}`);
    flows.open = true;
    await vi.waitFor(() => expect(flows.querySelectorAll('.flow')).toHaveLength(WIRING.length));
    expect(flows.querySelectorAll('.flow')[3]!.textContent).toBe(
      'Page loaded or Cart priced → add_to_cart → dl_add_to_cart',
    );
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
