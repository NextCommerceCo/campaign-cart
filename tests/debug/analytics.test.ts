import { afterEach, describe, expect, it, vi } from 'vitest';
import { startAnalytics } from '../../src/analytics';
import { EXIT_INTENT, NAMES } from '../../src/compat/analytics';
import { analyticsFlow } from '../../src/debug/analytics';
import type { PageKind, PageVisit } from '../../src/debug/state';
import { checks, type ProviderConfig, providers, WIRING } from '../../src/debug/providers';
import { nodes } from '../../src/debug/view';
import type { AnalyticsEvent, AnalyticsTrace, EventName } from '../../src/engine/events';
import type { Order } from '../../src/engine/types';
import { flush, makeEngine } from '../fixtures/engine';
import { ORDER, withUpsell } from '../fixtures/order';

const EARBUDS = { item_id: '11', item_name: 'Earbuds', quantity: 1, price: 49 };
const ON: ProviderConfig = { enabled: true, nextCampaign: true, dataLayer: true, unsupported: [] };
const page = (kind: PageKind, sent: string[] = []): PageVisit => ({
  at: 0,
  path: `/${kind}`,
  title: kind,
  kind,
  scope: 'test',
  reloads: 0,
  units: 0,
  sent,
  marks: [],
});

type Win = Window & {
  NextDataLayer?: unknown[];
  dataLayer?: unknown[];
  google_tag_manager?: unknown;
  nextCampaign?: unknown;
  NextDataLayerTransformFn?: unknown;
};
const win = window as Win;

function setup(config: ProviderConfig = ON, pages: PageVisit[] = []) {
  const { engine } = makeEngine();
  const root = document.createElement('div');
  const ids = new WeakMap<object, number>();
  let seq = 0;
  const idOf = (o: object) => {
    if (!ids.has(o)) ids.set(o, ++seq);
    return ids.get(o)!;
  };
  let filter = '';
  const flow = analyticsFlow({
    open: new Set(),
    idOf,
    render: () => paint(),
    config: () => config,
    pages: () => pages,
  });
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
  const verdict = () => root.querySelector('.bhead p')!.textContent;
  const steps = () =>
    [...root.querySelectorAll('.afunnel > .kstep')].map((step) => [
      step.classList[1],
      step.querySelector('code')!.textContent,
      step.querySelector('small')!.textContent,
    ]);
  const toggle = () => root.querySelector<HTMLElement>('.bact .link')!;
  const chips = () => [...root.querySelectorAll('.adest .chip')].map((c) => c.textContent);
  const notes = () => [...root.querySelectorAll('.adest p')].map((p) => p.textContent);
  const tabs = () => [...flow.dialog.querySelectorAll('[role=tab]')].map((t) => t.textContent);
  const tab = (label: string) => {
    [...flow.dialog.querySelectorAll<HTMLElement>('[role=tab]')].find((t) => t.textContent === label)!.click();
    return flow.dialog.querySelector('section')!;
  };
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
  return { engine, root, flow, paint, decide, send, rows, verdict, steps, toggle, chips, notes, open, tabs, tab };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
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
    expect(exits).toEqual(EXIT_INTENT.map(([from, name]) => [from, `dl_exit_intent_${name}`]));
  });

  it('lists every trigger that sends each event, and nothing the code does not send', async () => {
    document.body.innerHTML = '<div data-next-package-id="1"></div>';
    const { engine } = makeEngine();
    startAnalytics(engine, { apiKey: 'pk_test', version: '1', nextCampaign: false });
    await engine.start();
    await engine.cart.addItem(1);
    await engine.cart.removeItem(1);
    engine.events.emit('checkout.started', engine.cart.currentCheckout());
    engine.events.emit('user.created', {
      email: 'jane@example.com',
      first_name: 'Jane',
      last_name: 'Doe',
      accepts_marketing: true,
      language: 'en',
      user_agent: 'test',
    });
    engine.events.emit('address.entered', {
      first_name: 'Jane',
      last_name: 'Doe',
      line1: '1 Main St',
      country: 'US',
      type: 'shipping',
    });
    engine.events.emit('checkout.submitted', {
      ...engine.cart.currentCheckout(),
      payment_method: 'card_token',
      valid: true,
      errors: {},
    });
    engine.events.emit('order.loaded', { order: ORDER, upsells: [{ id: 'u1', number: 1, line: ORDER.lines![0]! }] });
    engine.events.emit('order.paid', { order: ORDER });
    engine.events.emit('upsell.viewed', { ref_id: 'R1', page: '/upsell' });
    engine.events.emit('upsell.skipped', { ref_id: 'R1' });
    const source = 'exit_intent';
    engine.events.emit('promotion.viewed', { source });
    engine.events.emit('promotion.clicked', { source });
    engine.events.emit('promotion.clicked', { source, action: 'apply-coupon', coupon_code: 'X' });
    engine.events.emit('promotion.closed', { source, reason: 'dismissed' });
    engine.events.emit('promotion.closed', { source, reason: 'closed' });
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

  it('says whether tracking works, then checks off the GA4 funnel with the page each step was sent on', () => {
    win.google_tag_manager = { 'GTM-ABC123': {} };
    win.nextCampaign = { event() {} };
    const landing = page('product', ['page_view', 'view_item_list', 'add_to_cart', 'update_cart']);
    const { engine, flow, paint, send, verdict, steps, root } = setup(ON, [landing, page('checkout')]);
    engine.events.emit('sdk.ready', { lines: [] });
    send('sdk.ready', 'page_view', { page_title: 'Checkout' }, 'pv');
    engine.events.emit('cart.calculated', { lines: [], coupons: [] });
    send('cart.calculated', 'add_to_cart', { currency: 'USD', value: 49, items: [EARBUDS] }, 'atc');
    engine.events.emit('checkout.started', engine.cart.currentCheckout());
    send('checkout.started', 'begin_checkout', { currency: 'USD', value: 49, items: [EARBUDS] }, 'bc');
    paint();
    expect(verdict()).toBe('Every event so far was pushed with the fields GA4 requires');
    expect(steps()).toEqual([
      ['done', 'page_view', 'Landing · this page'],
      ['done', 'view_item_list', 'Landing'],
      ['done', 'add_to_cart', 'Landing · this page'],
      ['done', 'begin_checkout', 'This page'],
      ['todo', 'add_shipping_info', 'Not yet: once, when the shipping address is valid or a shipping method is picked'],
      ['todo', 'add_payment_info', 'Not yet: once, when a submit passes its checks'],
      ['todo', 'purchase', 'Not yet: once per order, when the page after payment loads it'],
    ]);
    const clickable = [...root.querySelectorAll<HTMLElement>('.afunnel > button')];
    expect(clickable.map((b) => b.querySelector('code')!.textContent)).toEqual([
      'page_view',
      'add_to_cart',
      'begin_checkout',
    ]);
    clickable[2]!.click();
    expect(flow.dialog.querySelector('h2')!.textContent).toBe('begin_checkout');
  });

  it('adds the upsell steps once the tab reaches an upsell page', () => {
    const { engine, paint, send, steps } = setup(ON, [page('checkout'), page('upsell')]);
    engine.events.emit('order.paid', { order: ORDER });
    send(
      'order.paid',
      'purchase',
      { currency: 'USD', value: 89, shipping: 9.99, tax: 7.12, transaction_id: 'R1', items: [EARBUDS] },
      'p1',
    );
    paint();
    expect(steps().slice(-3)).toEqual([
      ['done', 'purchase', 'This page'],
      ['todo', 'view_upsell', 'Not yet: each upsell shown'],
      ['todo', 'upsell_purchase', 'Not yet: each accepted upsell, when the order loads'],
    ]);
  });

  it('lists the sent events newest first, and the ones not sent on request', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { engine, root, paint, decide, send, rows, toggle, steps } = setup();
    vi.setSystemTime(10_000);
    engine.events.emit('sdk.ready', { lines: [] });
    send('sdk.ready', 'page_view', { page_title: 'Olympus' }, 'pv');
    decide('sdk.ready', 'view_item_list', false, 'No package on the page');
    vi.setSystemTime(20_000);
    engine.events.emit('cart.calculated', { lines: [], coupons: [] });
    decide('cart.calculated', 'remove_from_cart', false, 'Nothing was removed since the last report');
    send('cart.calculated', 'add_to_cart', { currency: 'USD', value: 49, items: [EARBUDS] }, 'atc');
    paint();
    expect(steps()[1]).toEqual(['todo', 'view_item_list', 'Not sent: No package on the page']);
    expect(root.querySelectorAll('.bhead p')[1]!.textContent).toBe('2 sent, newest first. Open one for its data.');
    expect(rows()).toEqual([
      ['ok', 'add_to_cart', 'Cart priced · + Earbuds ×1', expect.stringMatching(/^\$49\.00\d\d:/)],
      ['ok', 'page_view', 'Page loaded · Olympus', expect.stringMatching(at)],
    ]);
    expect(toggle().textContent).toBe('Show 2 not sent');
    toggle().click();
    expect(toggle().textContent).toBe('Hide not sent');
    expect(rows().map(([state, name, sub]) => [state, name, sub])).toEqual([
      ['ok', 'add_to_cart', 'Cart priced · + Earbuds ×1'],
      ['skip', 'remove_from_cart', 'Cart priced · Not sent: Nothing was removed since the last report'],
      ['skip', 'view_item_list', 'Page loaded · Not sent: No package on the page'],
      ['ok', 'page_view', 'Page loaded · Olympus'],
    ]);
  });

  it('opens an event in a dialog for why it was sent, the data layer push, its params and items', () => {
    win.google_tag_manager = { 'GTM-ABC123': {} };
    win.nextCampaign = { event() {} };
    const { engine, flow, paint, send, rows, chips, notes, open, tabs, tab } = setup();
    engine.events.emit('cart.calculated', { lines: [], coupons: [] });
    const items = [{ ...EARBUDS, item_variant: 'Black' }];
    send('cart.calculated', 'add_to_cart', { currency: 'USD', value: 49, items }, 'atc');
    paint();
    expect(chips()).toEqual([
      'NextDataLayer · 1 event',
      'GTM dataLayer · GTM-ABC123',
      'NEXT analytics · own page_view',
    ]);
    expect(notes()).toEqual([]);
    expect(rows()[0]![2]).toBe('Cart priced · + Earbuds (Black) ×1');
    expect(open('add_to_cart')).toEqual([
      ['Why', 'reason for add_to_cartCart priced: cart.calculated'],
      ['Reached', 'dl_add_to_cartNextDataLayerGTM dataLayer'],
      ['Params', 'currency USDvalue 49'],
    ]);
    expect(flow.dialog.querySelector('.aitems')!.textContent).toBe('Items · 1itemvariantidqtypriceEarbudsBlack11149');
    expect(tabs()).toEqual(['Summary', 'Event', 'NextDataLayer', 'GTM dataLayer']);
    expect([...tab('Event').querySelectorAll('.ajson b')].map((b) => b.textContent)).toEqual([
      'analytics',
      'cart.calculated',
    ]);
    expect(JSON.parse(tab('NextDataLayer').querySelector('pre')!.textContent!)).toEqual({
      event: 'dl_add_to_cart',
      event_id: 'atc',
    });
    expect(tab('GTM dataLayer').querySelector('.ajhead small')!.textContent).toBe(
      'The push in window.dataLayer, for GTM tags',
    );
    expect(flow.dialog.querySelector('h2')!.textContent).toBe('add_to_cart');
    expect(flow.dialog.querySelector('header p')!.textContent).toMatch(
      /^Cart priced · \d\d:\d\d:\d\d · \$49\.00 · Sent$/,
    );
  });

  it('steps through the listed events with Newer and Older, or the arrow keys', () => {
    const { engine, flow, paint, send, open } = setup();
    engine.events.emit('sdk.ready', { lines: [] });
    send('sdk.ready', 'page_view', { page_title: 'Olympus' }, 'pv');
    engine.events.emit('cart.calculated', { lines: [], coupons: [] });
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
    const { engine, flow, paint, decide, toggle, open, tabs } = setup();
    engine.events.emit('cart.calculated', { lines: [], coupons: [] });
    decide('cart.calculated', 'remove_from_cart', false, 'Nothing was removed since the last report');
    paint();
    toggle().click();
    expect(open('remove_from_cart')).toEqual([
      ['Why', 'Nothing was removed since the last reportCart priced: cart.calculated'],
    ]);
    expect(tabs()).toEqual(['Summary', 'Event']);
    expect(flow.dialog.querySelector('header p')!.textContent).toMatch(/ · Not sent$/);
  });

  it('puts missing GA4 fields and a push that did not arrive in the verdict, the funnel and the row', () => {
    const { engine, flow, paint, send, rows, verdict, steps, open } = setup();
    engine.events.emit('order.paid', { order: ORDER });
    send('order.paid', 'purchase', { value: 89, shipping: 9.99, tax: 7.12, items: [] }, 'p1', false);
    win.NextDataLayer = [{ event: 'dl_purchase', event_id: 'p1' }];
    win.dataLayer = [];
    paint();
    expect(verdict()).toBe('1 event with problems: purchase items is empty');
    expect(steps().find(([, name]) => name === 'purchase')).toEqual(['warn', 'purchase', 'This page · items is empty']);
    expect(rows()[0]!.slice(0, 3)).toEqual([
      'warn',
      'purchase',
      'Order paid · ⚠ items is empty · ⚠ value is set without currency · ⚠ transaction_id is missing · ⚠ not in dataLayer',
    ]);
    const detail = Object.fromEntries(open('purchase'));
    expect(detail.Problems).toBe('⚠ items is empty⚠ value is set without currency⚠ transaction_id is missing');
    expect(detail.Reached).toBe('dl_purchaseNextDataLayerGTM dataLayer: not pushed');
    expect([...flow.dialog.querySelectorAll('.adetail .chip')].map((c) => c.className)).toEqual([
      'chip ok',
      'chip warn',
    ]);
  });

  it('checks update_cart against the cart lines, and a voucher GA4 takes as coupon', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { engine, paint, send, verdict, open } = setup();
    const priced = (value: number, voucher?: string) => {
      vi.setSystemTime(Date.now() + 1000);
      engine.events.emit('cart.calculated', {
        lines: [{ package_id: 1, quantity: 1, total: 49 }],
        coupons: voucher ? ['SAVE'] : [],
        total: 49,
        discounts: voucher
          ? [{ name: 'Save', amount: Number(voucher), source: 'coupon', code: 'SAVE', offer_id: 1 }]
          : [],
      });
      send('cart.calculated', 'update_cart', { currency: 'USD', value, items: [EARBUDS] }, `u${value}${voucher ?? ''}`);
      paint();
      return Object.fromEntries(open('update_cart'))['Adds up'];
    };
    expect(priced(49)).toBe('✓ value $49.00 = the cart lines $49.00');
    expect(priced(59, '10.00')).toBe(
      '✓ value $59.00 = the cart lines $49.00 before the $10.00 voucher, sent as coupon',
    );
    expect(priced(59)).toBe('⚠ value $59.00, but the cart lines come to $49.00');
    expect(verdict()).toBe('1 event with problems: update_cart value $59.00, but the cart lines come to $49.00');
  });

  it('checks a purchase against the order total, with tax added or included in the prices', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { engine, paint, send, steps, open } = setup();
    const bought = (order: Order, params: Record<string, unknown>, id: string) => {
      vi.setSystemTime(Date.now() + 1000);
      engine.events.emit('order.paid', { order });
      send('order.paid', 'purchase', { currency: 'USD', transaction_id: 'R1', items: [EARBUDS], ...params }, id);
      paint();
      return Object.fromEntries(open('purchase'))['Adds up'];
    };
    expect(bought(ORDER, { value: 89, shipping: 9.99, tax: 7.12 }, 'p1')).toBe(
      '✓ value $89.00 + shipping $9.99 + tax $7.12 = $106.11, the order total',
    );
    expect(bought(ORDER, { value: 96.12, shipping: 9.99, tax: 7.12 }, 'p2')).toBe(
      '✓ value $96.12 + shipping $9.99 = $106.11, the order total (prices include tax)',
    );
    const upsold = { ...withUpsell(ORDER, 12, 1), total_incl_tax: '126.11' };
    expect(bought(upsold, { value: 89, shipping: 9.99, tax: 7.12 }, 'p3')).toBe(
      '✓ value $89.00 + shipping $9.99 + tax $7.12 = $106.11, the order total',
    );
    expect(bought(ORDER, { value: 50, shipping: 9.99, tax: 7.12 }, 'p4')).toBe(
      '⚠ value $50.00 + shipping $9.99 + tax $7.12 = $67.11, but the order total is $106.11',
    );
    expect(steps().find(([, name]) => name === 'purchase')![0]).toBe('warn');
  });

  it('shows GTM reading a push, and a GA4 request that left the page after an event', () => {
    win.google_tag_manager = { 'GTM-ABC123': {} };
    win.nextCampaign = { event() {} };
    const { engine, flow, paint, send, chips, steps, open, tabs, tab } = setup();
    engine.events.emit('cart.calculated', { lines: [], coupons: [] });
    send('cart.calculated', 'add_to_cart', { currency: 'USD', value: 49, items: [EARBUDS] }, 'atc');
    (win.dataLayer![0] as Record<string, unknown>)['gtm.uniqueEventId'] = 7;
    const collect = (en: string) => ({
      name: `https://region1.google-analytics.com/g/collect?v=2&tid=G-TEST1&en=${en}`,
      startTime: Date.now() - performance.timeOrigin + 20,
    });
    vi.spyOn(performance, 'getEntriesByType').mockReturnValue([
      collect('add_to_cart'),
      collect('page_view'),
      { name: 'https://cdn.test/app.js', startTime: 0 },
    ] as never);
    paint();
    expect(chips()).toContain('GA4 · G-TEST1');
    expect(steps().find(([, name]) => name === 'add_to_cart')).toEqual([
      'done',
      'add_to_cart',
      'This page · reached GA4',
    ]);
    expect(Object.fromEntries(open('add_to_cart')).Reached).toBe(
      'dl_add_to_cartNextDataLayerGTM dataLayer · read by GTMGA4 G-TEST1',
    );
    expect(tabs()).toEqual(['Summary', 'Event', 'NextDataLayer', 'GTM dataLayer', 'GA4']);
    expect(
      [...flow.dialog.querySelectorAll('.adetail .chip')].map((c) => [
        c.className,
        c.textContent,
        c.querySelector('svg')!.getAttribute('fill'),
      ]),
    ).toEqual([
      ['chip ok', 'NextDataLayer', 'currentColor'],
      ['chip ok', 'GTM dataLayer · read by GTM', '#246FDB'],
      ['chip ok', 'GA4 G-TEST1', '#E37400'],
    ]);
    expect([...flow.dialog.querySelectorAll('[role=tab]')].map((t) => !!t.querySelector('svg'))).toEqual([
      false,
      false,
      true,
      true,
      true,
    ]);
    expect(tab('GTM dataLayer').querySelector('.ajhead small')!.textContent).toBe(
      'The push in window.dataLayer, read by GTM',
    );
    const ga4 = tab('GA4');
    expect(ga4.querySelector('p')!.textContent).toMatch(/^The request to region1\.google-analytics\.com for G-TEST1 /);
    expect([...ga4.querySelectorAll('tr')].map((r) => r.textContent)).toEqual(['v2', 'tidG-TEST1', 'enadd_to_cart']);
  });

  it('says what GTM being off means in the verdict, and its nextConfig key once, not on each event', () => {
    win.nextCampaign = { event() {} };
    const { engine, paint, send, chips, notes, verdict, open } = setup({ ...ON, dataLayer: false });
    engine.events.emit('sdk.ready', { lines: [] });
    send('sdk.ready', 'page_view', { page_title: 'Olympus' }, 'pv');
    paint();
    expect(chips()).toEqual(['NextDataLayer · 1 event', 'GTM dataLayer · off', 'NEXT analytics · own page_view']);
    expect(verdict()).toBe('GTM tags get none of these events: GTM dataLayer is off');
    expect(notes()).toEqual(['Off in nextConfig: analytics.providers.gtm.enabled is false.']);
    expect(Object.fromEntries(open('page_view'))['Reached']).toBe('dl_user_dataNextDataLayer');
  });

  it('runs the exit popup straight to the data layer, and names a provider that cannot deliver', () => {
    const { engine, paint, decide, rows, verdict, open, tabs } = setup();
    win.NextDataLayer = [{ event: 'dl_exit_intent_shown', event_id: 'x1' }];
    win.dataLayer = [{ event: 'dl_exit_intent_shown', event_id: 'x1' }];
    engine.events.emit('promotion.viewed', { source: 'exit_intent' });
    decide('promotion.viewed', 'dl_exit_intent_shown', true, 'Data layer only: there is no analytics event', 'x1');
    paint();
    expect(verdict()).toBe('GTM dataLayer is on, but this page has no GTM container.');
    expect(rows()[0]!.slice(0, 3)).toEqual(['ok', 'dl_exit_intent_shown', 'Promotion shown · data layer only']);
    expect(open('dl_exit_intent_shown')).toEqual([
      ['Why', 'Data layer only: there is no analytics eventPromotion shown: promotion.viewed'],
      ['Reached', 'dl_exit_intent_shownNextDataLayerGTM dataLayer'],
    ]);
    expect(tabs()).toEqual(['Summary', 'Event', 'NextDataLayer', 'GTM dataLayer']);
  });

  it('filters events, and explains an empty page or analytics turned off', () => {
    const { engine, root, paint, decide, send, rows, verdict, toggle } = setup();
    paint();
    expect(verdict()).toBe('Nothing sent yet: analytics starts once the page is idle.');
    expect(root.querySelector('.anone')!.textContent).toBe('Nothing sent yet.');
    engine.events.emit('sdk.ready', { lines: [] });
    send('sdk.ready', 'page_view', {}, 'pv');
    decide('sdk.ready', 'view_item', false, 'No package on the page');
    paint('package');
    expect(root.querySelector('.anone')!.textContent).toBe('Nothing matches the filter.');
    toggle().click();
    expect(rows().map(([, name]) => name)).toEqual(['view_item']);
    const off = setup({ ...ON, enabled: false });
    off.paint();
    expect(off.verdict()).toBe('Analytics is off: nextConfig.analytics.enabled is false.');
    expect(off.notes()).toEqual([]);
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
