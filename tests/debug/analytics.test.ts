import { afterEach, describe, expect, it, vi } from 'vitest';
import { startAnalytics } from '../../src/analytics';
import { EXIT_INTENT, NAMES } from '../../src/compat/analytics';
import { analyticsFlow } from '../../src/debug/analytics';
import { checks, type ProviderConfig, providers, WIRING } from '../../src/debug/providers';
import { nodes } from '../../src/debug/view';
import type { AnalyticsEvent, AnalyticsTrace, EventName } from '../../src/engine/events';
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
  const rows = () =>
    [...root.querySelectorAll('.arun')].map((r) => [
      r.classList[1],
      r.querySelector('code')!.textContent,
      r.querySelector('small')!.textContent,
      r.querySelector('.aend')!.textContent,
    ]);
  const filters = () =>
    [...root.querySelectorAll<HTMLElement>('.button-group .btn')].map(
      (b) => `${b.textContent}${b.getAttribute('aria-pressed') === 'true' ? ' *' : ''}`,
    );
  const showing = (label: string) =>
    [...root.querySelectorAll<HTMLElement>('.button-group .btn')]
      .find((b) => b.textContent!.startsWith(label))!
      .click();
  const chips = () => [...root.querySelectorAll('.agoes .chip')].map((c) => c.textContent);
  const open = (name: string) => {
    [...root.querySelectorAll<HTMLElement>('.arun')]
      .find((r) => r.querySelector('code')!.textContent === name)!
      .click();
    expect(flow.dialog.open).toBe(true);
    return [...flow.dialog.querySelectorAll('.adetail > dt')].map((dt) => [
      dt.textContent,
      dt.nextElementSibling!.textContent,
    ]);
  };
  return { engine, root, flow, paint, decide, send, rows, filters, showing, chips, open };
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
      ['ok', 'NextDataLayer', '2 events', 'window.NextDataLayer has 2 events (dl_*).'],
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
  const at = /\d\d:\d\d:\d\d$/;

  it('lists the sent events newest first, and the ones not sent under Not sent', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { engine, paint, decide, send, rows, filters, showing } = setup();
    vi.setSystemTime(10_000);
    engine.events.emit('ready', { lines: [] });
    send('ready', 'page_view', { page_title: 'Olympus' }, 'pv');
    decide('ready', 'view_item', false, 'No package on the page');
    vi.setSystemTime(20_000);
    engine.events.emit('cart.calculated', { summary: {} as never });
    decide('cart.calculated', 'remove_from_cart', false, 'Nothing was removed since the last report');
    send('cart.calculated', 'add_to_cart', { currency: 'USD', value: 49, items: [EARBUDS] }, 'atc');
    paint();
    expect(filters()).toEqual(['Sent 2 *', 'Not sent 2', 'Problems 0']);
    expect(rows()).toEqual([
      ['ok', 'add_to_cart', 'Cart priced · + Earbuds ×1', expect.stringMatching(/^\$49\.00\d\d:/)],
      ['ok', 'page_view', 'Page loaded · Olympus', expect.stringMatching(at)],
    ]);
    showing('Not sent');
    expect(filters()).toEqual(['Sent 2', 'Not sent 2 *', 'Problems 0']);
    expect(rows().map(([state, name, sub]) => [state, name, sub])).toEqual([
      ['skip', 'remove_from_cart', 'Cart priced · Not sent: Nothing was removed since the last report'],
      ['skip', 'view_item', 'Page loaded · Not sent: No package on the page'],
    ]);
  });

  it('opens an event in a dialog for why it was sent, the data layer push, its params and items', () => {
    win.google_tag_manager = { 'GTM-ABC123': {} };
    win.nextCampaign = { event() {} };
    const { engine, flow, paint, send, rows, chips, open } = setup();
    engine.events.emit('cart.calculated', { summary: {} as never });
    const items = [{ ...EARBUDS, item_variant: 'Black' }];
    send('cart.calculated', 'add_to_cart', { currency: 'USD', value: 49, items }, 'atc');
    paint();
    expect(chips()).toEqual([
      '✓ NextDataLayer · 1 event',
      '✓ GTM dataLayer · GTM-ABC123',
      '✓ NEXT analytics · own page_view',
    ]);
    expect(rows()[0]![2]).toBe('Cart priced · + Earbuds (Black) ×1');
    expect(open('add_to_cart')).toEqual([
      ['Why', 'reason for add_to_cartCart priced: cart.calculated'],
      ['Pushed as', 'dl_add_to_cart✓ NextDataLayer✓ GTM dataLayer'],
      ['Params', 'currency USDvalue 49'],
      ['Items', 'itemvariantidqtypriceEarbudsBlack11149'],
      ['Raw', expect.stringMatching(/^event .*dl_add_to_cart .*cart\.calculated /)],
    ]);
    expect(flow.dialog.querySelector('h2')!.textContent).toBe('add_to_cart');
    expect(flow.dialog.querySelector('header p')!.textContent).toMatch(
      /^Cart priced · \d\d:\d\d:\d\d · \$49\.00 · Sent$/,
    );
    expect(flow.dialog.querySelectorAll('.araw > details')).toHaveLength(3);
  });

  it('steps through the listed events with Newer and Older, or the arrow keys', () => {
    const { engine, flow, paint, send, open } = setup();
    engine.events.emit('ready', { lines: [] });
    send('ready', 'page_view', { page_title: 'Olympus' }, 'pv');
    engine.events.emit('cart.calculated', { summary: {} as never });
    send('cart.calculated', 'add_to_cart', { currency: 'USD', value: 49, items: [EARBUDS] }, 'atc');
    paint();
    open('add_to_cart');
    const button = (text: string) =>
      [...flow.dialog.querySelectorAll<HTMLButtonElement>('footer .btn')].find((b) => b.textContent === text)!;
    const heading = () => flow.dialog.querySelector('h2')!.textContent;
    expect([button('Newer').disabled, button('Older').disabled]).toEqual([true, false]);
    button('Older').click();
    expect(heading()).toBe('page_view');
    expect([button('Newer').disabled, button('Older').disabled]).toEqual([false, true]);
    flow.dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(heading()).toBe('add_to_cart');
    button('Done').click();
    expect(flow.dialog.open).toBe(false);
  });

  it('says why an event was not sent', () => {
    const { engine, flow, paint, decide, showing, open } = setup();
    engine.events.emit('cart.calculated', { summary: {} as never });
    decide('cart.calculated', 'remove_from_cart', false, 'Nothing was removed since the last report');
    paint();
    showing('Not sent');
    expect(open('remove_from_cart')).toEqual([
      ['Why', 'Nothing was removed since the last reportCart priced: cart.calculated'],
      ['Raw', expect.stringMatching(/^cart\.calculated /)],
    ]);
    expect(flow.dialog.querySelector('header p')!.textContent).toMatch(/ · Not sent$/);
  });

  it('flags missing GA4 fields and a push that did not arrive', async () => {
    const { engine, paint, send, rows, filters, showing, open } = setup();
    engine.events.emit('order.loaded', { order: ORDER });
    send('order.loaded', 'purchase', { value: 98, items: [] }, 'p1', false);
    win.NextDataLayer = [{ event: 'dl_purchase', event_id: 'p1' }];
    win.dataLayer = [];
    paint();
    expect(filters()).toEqual(['Sent 1 *', 'Not sent 0', 'Problems 1']);
    expect(rows()[0]![0]).toBe('warn');
    showing('Problems');
    const detail = Object.fromEntries(open('purchase'));
    expect(detail.Problems).toBe('⚠ items is empty⚠ value is set without currency⚠ transaction_id is missing');
    expect(detail['Pushed as']).toBe('dl_purchase✓ NextDataLayer⚠ GTM dataLayer: not pushed');
  });

  it('shows a provider that is off once on top, not on each event', async () => {
    win.nextCampaign = { event() {} };
    const { engine, paint, send, chips, open } = setup({ ...ON, dataLayer: false });
    engine.events.emit('ready', { lines: [] });
    send('ready', 'page_view', { page_title: 'Olympus' }, 'pv');
    paint();
    expect(chips()).toEqual(['✓ NextDataLayer · 1 event', '○ GTM dataLayer · off', '✓ NEXT analytics · own page_view']);
    expect(Object.fromEntries(open('page_view'))['Pushed as']).toBe('dl_user_data✓ NextDataLayer');
  });

  it('runs the exit popup straight to the data layer', async () => {
    const { engine, root, paint, decide, rows, open } = setup();
    win.NextDataLayer = [{ event: 'dl_exit_intent_shown', event_id: 'x1' }];
    win.dataLayer = [{ event: 'dl_exit_intent_shown', event_id: 'x1' }];
    engine.events.emit('exit-intent.shown', {} as never);
    decide('exit-intent.shown', 'dl_exit_intent_shown', true, 'Data layer only: there is no analytics event', 'x1');
    paint();
    expect(rows()[0]!.slice(0, 3)).toEqual(['ok', 'dl_exit_intent_shown', 'Exit popup shown · data layer only']);
    expect(root.querySelector('.alert')!.textContent).toBe(
      '⚠ GTM dataLayer is on, but this page has no GTM container.',
    );
    expect(open('dl_exit_intent_shown')).toEqual([
      ['Why', 'Data layer only: there is no analytics eventExit popup shown: exit-intent.shown'],
      ['Pushed as', 'dl_exit_intent_shown✓ NextDataLayer✓ GTM dataLayer'],
      ['Raw', expect.stringMatching(/^dl_exit_intent_shown /)],
    ]);
  });

  it('filters events, and explains an empty page', () => {
    const { engine, root, paint, decide, send, rows, showing } = setup();
    paint();
    expect(root.textContent).toContain('Nothing sent yet');
    expect(root.textContent).toContain('Analytics starts once the page is idle.');
    engine.events.emit('ready', { lines: [] });
    send('ready', 'page_view', {}, 'pv');
    decide('ready', 'view_item', false, 'No package on the page');
    paint('package');
    expect(root.querySelector('.anone')!.textContent).toBe('Nothing matches the filter.');
    showing('Not sent');
    expect(rows().map(([, name]) => name)).toEqual(['view_item']);
    paint('');
    showing('Problems');
    expect(root.querySelector('.anone')!.textContent).toMatch(/^No problems: /);
  });

  it('lists every workflow the SDK has', async () => {
    const { root, paint } = setup();
    paint();
    const flows = root.querySelector<HTMLDetailsElement>('.more')!;
    expect(flows.querySelector('summary')!.textContent).toBe(`All workflows · ${WIRING.length}`);
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
