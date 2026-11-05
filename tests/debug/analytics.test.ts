import { afterEach, describe, expect, it, vi } from 'vitest';
import { startAnalytics } from '../../src/analytics';
import { createCheckout } from '../../src/checkout/state/checkout';
import { analyticsFlow } from '../../src/debug/analytics';
import type { PageKind, PageVisit } from '../../src/debug/state';
import { checks, dlOf, linesOf, type ProviderConfig, providers, WIRING } from '../../src/debug/providers';
import { nodes } from '../../src/debug/view';
import { GA4 } from '../../src/destinations/ga4';
import {
  type AnalyticsTrace,
  OBJECTS,
  type TrackingEvent,
  type TrackingMap,
  type TrackingName,
} from '../../src/engine/events/analytics';
import type { EventName } from '../../src/engine/events/bus';
import type { Cart, CartItem } from '../../src/engine/events/carts';
import type { Checkout } from '../../src/engine/events/checkout';
import type { Promotion } from '../../src/engine/events/promotions';
import { publicOrder } from '../../src/engine/order';
import { createOrder } from '../../src/order/state';
import { fakeApi, json } from '../fixtures/api';
import { flush, makeEngine } from '../fixtures/engine';
import { ORDER, withUpsell } from '../fixtures/order';
import { fakeRules } from '../fixtures/rules';

const EARBUDS: CartItem = { package_id: 1, quantity: 1, product_title: 'Earbuds', sku: 'EB-2', price: 49, total: 49 };
const CART: Cart = { lines: [EARBUDS], coupons: [], currency: 'USD', total: 49 };
const CHECKOUT: Checkout = { id: 'c1', cart: CART };
const ON: ProviderConfig = { enabled: true, nextCampaign: true, dataLayer: true, unsupported: [] };
const DL: Record<TrackingName, string> = {
  page_viewed: 'dl_user_data',
  product_viewed: 'dl_view_item',
  product_list_viewed: 'dl_view_item_list',
  product_added_to_cart: 'dl_add_to_cart',
  product_removed_from_cart: 'dl_remove_from_cart',
  cart_updated: 'dl_cart_updated',
  checkout_started: 'dl_begin_checkout',
  checkout_contact_info_submitted: 'dl_generate_lead',
  checkout_shipping_address_submitted: 'dl_add_shipping_info',
  checkout_shipping_method_submitted: 'dl_add_shipping_info',
  checkout_payment_info_submitted: 'dl_add_payment_info',
  checkout_completed: 'dl_purchase',
  upsell_completed: 'dl_upsell_purchase',
  upsell_viewed: 'dl_viewed_upsell',
  upsell_skipped: 'dl_skipped_upsell',
  promotion_viewed: 'dl_view_promotion',
  promotion_selected: 'dl_select_promotion',
};
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
  const send = <K extends TrackingName>(
    trigger: EventName,
    name: K,
    data: TrackingMap[K],
    id: string,
    options: { layers?: boolean; created_at?: string } = {},
  ) => {
    engine.events.emit('analytics', {
      event_id: id,
      event_type: name,
      object: OBJECTS[name],
      data,
      created_at: options.created_at ?? new Date().toISOString(),
      session_id: 's1',
      sdk_version: 'test',
      context: { ...engine.eventContext(), campaign: { id: 1, name: 'Olympus', currency: 'USD', language: 'en' } },
    } as TrackingEvent);
    if (options.layers !== false)
      for (const layer of [(win.NextDataLayer ??= []), (win.dataLayer ??= [])])
        layer.push({ event: dlOf(name), event_id: id });
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
  const open = (name: string, nth = 0) => {
    [...root.querySelectorAll<HTMLElement>('.arun')]
      .filter((r) => r.querySelector('code')!.textContent === name)
      [nth]!.click();
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
  it('wires every tracking event once, to its data layer event, and the exit popup straight to dl_exit_intent_*', () => {
    const tracked = WIRING.filter((w) => w.tracking).map((w) => [w.tracking, w.dl]);
    expect(Object.fromEntries(tracked)).toEqual(DL);
    expect(tracked).toHaveLength(Object.keys(OBJECTS).length);
    expect(Object.fromEntries(WIRING.filter((w) => w.tracking).map((w) => [w.tracking, w.object]))).toEqual(OBJECTS);
    expect(
      Object.fromEntries(
        WIRING.filter((w) => w.tracking !== 'page_viewed' && w.tracking).map((w) => [w.tracking, w.ga4]),
      ),
    ).toEqual(GA4);
    expect(WIRING.filter((w) => !w.tracking).map((w) => [w.from[0], w.dl])).toEqual([
      ['promotion.viewed', 'dl_exit_intent_shown'],
      ['promotion.clicked', 'dl_exit_intent_accepted'],
      ['promotion.clicked', 'dl_exit_intent_action'],
      ['promotion.closed', 'dl_exit_intent_dismissed'],
      ['promotion.closed', 'dl_exit_intent_closed'],
    ]);
    expect(dlOf('checkout_completed')).toBe('dl_purchase');
    expect(dlOf('dl_exit_intent_shown')).toBe('dl_exit_intent_shown');
  });

  it('lists every trigger that sends each event, and nothing the code does not send', async () => {
    document.body.innerHTML = '<div data-next-package-id="1"></div>';
    const { engine } = makeEngine({ fetch: fakeApi({ getOrder: () => json(withUpsell(ORDER, 99, 1)) }).fetch });
    startAnalytics(engine, { apiKey: 'pk_test', version: '1', nextCampaign: false });
    await engine.start();
    await engine.cart.addItem(1);
    engine.checkout = engine.attach((ctx) => createCheckout(ctx, engine.cart, fakeRules().api));
    engine.checkout.begin();
    await engine.cart.removeItem(1);
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
    engine.events.emit('shipping.settled', { id: 1, code: 'standard' });
    engine.events.emit('checkout.submitted', {
      ...engine.cart.currentCheckout(),
      payment_method: 'card_token',
    });
    engine.order = engine.attach((ctx) => createOrder(ctx, engine.cart));
    await engine.order.load('R1');
    engine.events.emit('upsell.viewed', { ref_id: 'R1', page: '/upsell', lines: [] });
    engine.events.emit('upsell.skipped', { ref_id: 'R1', page: '/upsell', lines: [] });
    const exit: Promotion = { id: 'exit_intent', type: 'exit_intent', creative: 'https://cdn.test/exit.png' };
    engine.events.emit('promotion.viewed', exit);
    engine.events.emit('promotion.clicked', exit);
    engine.events.emit('promotion.clicked', { ...exit, action: 'apply-coupon', coupon_code: 'X' });
    engine.events.emit('promotion.closed', { ...exit, reason: 'dismissed' });
    engine.events.emit('promotion.closed', { ...exit, reason: 'close_button' });
    await flush();
    const traced = engine.log
      .entries()
      .map((e) => e.data as AnalyticsTrace | undefined)
      .filter((d): d is AnalyticsTrace => d?.trace === 'analytics' && d.sent)
      .map((d) => `${d.trigger} → ${d.name}`);
    const allowed = new Set(WIRING.flatMap((w) => w.from.map((f) => `${f} → ${w.tracking ?? w.dl}`)));
    expect(traced.filter((pair) => !allowed.has(pair))).toEqual([]);
    expect(new Set(traced.map((pair) => pair.split(' → ')[1]))).toEqual(
      new Set(WIRING.map((w) => w.tracking ?? w.dl).filter((name) => name !== 'product_list_viewed')),
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
      ['info', 'Page scripts', 'next.analytics.on', "Page scripts get every event with next.analytics.on('*', fn)."],
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
      ['info', 'Page scripts', 'next.analytics.on', "Page scripts get every event with next.analytics.on('*', fn)."],
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

  it('says whether tracking works, then checks off the funnel with the page each step was sent on', () => {
    win.google_tag_manager = { 'GTM-ABC123': {} };
    win.nextCampaign = { event() {} };
    const landing = page('product', ['page_viewed', 'product_list_viewed', 'product_added_to_cart', 'cart_updated']);
    const { engine, flow, paint, send, verdict, steps, root } = setup(ON, [landing, page('checkout')]);
    engine.events.emit('sdk.ready', engine.snapshot());
    send('sdk.ready', 'page_viewed', {}, 'pv');
    engine.events.emit('cart.calculated', CART);
    send('cart.calculated', 'product_added_to_cart', { ...EARBUDS, first_in_session: true }, 'atc');
    engine.events.emit('checkout.started', CHECKOUT);
    send('checkout.started', 'checkout_started', CHECKOUT, 'bc');
    paint();
    expect(verdict()).toBe('Every event so far carried its object and reached its data layers');
    expect(steps()).toEqual([
      ['done', 'page_viewed', 'Landing · this page'],
      ['done', 'product_list_viewed', 'Landing'],
      ['done', 'product_added_to_cart', 'Landing · this page'],
      ['done', 'checkout_started', 'This page'],
      ['todo', 'checkout_shipping_address_submitted', 'Not yet: once per checkout, when the shipping address is valid'],
      ['todo', 'checkout_shipping_method_submitted', 'Not yet: once per checkout, when a shipping method is picked'],
      ['todo', 'checkout_payment_info_submitted', 'Not yet: once per checkout, when a submit passes its checks'],
      ['todo', 'checkout_completed', 'Not yet: once per order, when it is paid'],
    ]);
    const clickable = [...root.querySelectorAll<HTMLElement>('.afunnel > button')];
    expect(clickable.map((b) => b.querySelector('code')!.textContent)).toEqual([
      'page_viewed',
      'product_added_to_cart',
      'checkout_started',
    ]);
    clickable[2]!.click();
    expect(flow.dialog.querySelector('h2')!.textContent).toBe('checkout_started');
  });

  it('adds the upsell steps once the tab reaches an upsell page', () => {
    const { engine, paint, send, steps } = setup(ON, [page('checkout'), page('upsell')]);
    const order = publicOrder(ORDER);
    engine.events.emit('order.paid', order);
    send('order.paid', 'checkout_completed', order, '1001');
    paint();
    expect(steps().slice(-3)).toEqual([
      ['done', 'checkout_completed', 'This page'],
      ['todo', 'upsell_viewed', 'Not yet: once per upsell page, when an offer is shown'],
      ['todo', 'upsell_completed', 'Not yet: once per accepted upsell, when the order is loaded with it'],
    ]);
  });

  it('lists the sent events newest first, and the ones not sent on request', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { engine, root, paint, decide, send, rows, toggle, steps } = setup();
    vi.setSystemTime(10_000);
    document.title = 'Olympus';
    engine.events.emit('sdk.ready', engine.snapshot());
    send('sdk.ready', 'page_viewed', {}, 'pv');
    decide('sdk.ready', 'product_list_viewed', false, 'No package on the page');
    vi.setSystemTime(20_000);
    engine.events.emit('cart.calculated', CART);
    decide('cart.calculated', 'product_removed_from_cart', false, 'Nothing was removed since the last report');
    send('cart.calculated', 'product_added_to_cart', { ...EARBUDS, first_in_session: true }, 'atc');
    paint();
    expect(steps()[1]).toEqual(['todo', 'product_list_viewed', 'Not sent: No package on the page']);
    expect(root.querySelectorAll('.bhead p')[1]!.textContent).toBe('2 sent, newest first. Open one for its data.');
    expect(rows()).toEqual([
      ['ok', 'product_added_to_cart', 'Cart priced · + Earbuds ×1', expect.stringMatching(/^\$49\.00\d\d:/)],
      ['ok', 'page_viewed', 'Page loaded · Olympus', expect.stringMatching(at)],
    ]);
    expect(toggle().textContent).toBe('Show 2 not sent');
    toggle().click();
    expect(toggle().textContent).toBe('Hide not sent');
    expect(rows().map(([state, name, sub]) => [state, name, sub])).toEqual([
      ['ok', 'product_added_to_cart', 'Cart priced · + Earbuds ×1'],
      ['skip', 'product_removed_from_cart', 'Cart priced · Not sent: Nothing was removed since the last report'],
      ['skip', 'product_list_viewed', 'Page loaded · Not sent: No package on the page'],
      ['ok', 'page_viewed', 'Page loaded · Olympus'],
    ]);
  });

  it('opens an event in a dialog for why it was sent, the data layer push, its data and lines', () => {
    win.google_tag_manager = { 'GTM-ABC123': {} };
    win.nextCampaign = { event() {} };
    const { engine, flow, paint, send, rows, chips, notes, open, tabs, tab } = setup();
    engine.events.emit('cart.calculated', CART);
    send(
      'cart.calculated',
      'product_added_to_cart',
      { ...EARBUDS, variant_title: 'Black', first_in_session: true },
      'atc',
    );
    paint();
    expect(chips()).toEqual([
      'NextDataLayer · 1 event',
      'GTM dataLayer · GTM-ABC123',
      'NEXT analytics · own page_view',
    ]);
    expect(notes()).toEqual([]);
    expect(rows()[0]![2]).toBe('Cart priced · + Earbuds (Black) ×1');
    expect(open('product_added_to_cart')).toEqual([
      ['Why', 'reason for product_added_to_cartCart priced: cart.calculated'],
      ['Reached', 'dl_add_to_cartNextDataLayerGTM dataLayer'],
      [
        'Data',
        'cart_linepackage_id 1quantity 1product_title Earbudssku EB-2price 49total 49variant_title Blackfirst_in_session true',
      ],
    ]);
    expect(flow.dialog.querySelector('.aitems')!.textContent).toBe(
      'Lines · 1productvariantskuqtypriceEarbudsBlackEB-2149',
    );
    expect(tabs()).toEqual(['Summary', 'Event', 'NextDataLayer', 'GTM dataLayer']);
    const event = tab('Event');
    expect([...event.querySelectorAll('.ajson b')].map((b) => b.textContent)).toEqual([
      'product_added_to_cart',
      'cart.calculated',
    ]);
    expect(JSON.parse(event.querySelector('pre')!.textContent!)).toMatchObject({
      event_id: 'atc',
      event_type: 'product_added_to_cart',
      object: 'cart_line',
      data: { product_title: 'Earbuds', first_in_session: true },
      context: { page_location: 'http://localhost:3000/' },
    });
    expect(JSON.parse(tab('NextDataLayer').querySelector('pre')!.textContent!)).toEqual({
      event: 'dl_add_to_cart',
      event_id: 'atc',
    });
    expect(tab('GTM dataLayer').querySelector('.ajhead small')!.textContent).toBe(
      'The push in window.dataLayer, for GTM tags',
    );
    expect(flow.dialog.querySelector('h2')!.textContent).toBe('product_added_to_cart');
    expect(flow.dialog.querySelector('header p')!.textContent).toMatch(
      /^Cart priced · \d\d:\d\d:\d\d · \$49\.00 · Sent$/,
    );
  });

  it('shows the lines of a checkout from its cart, and an order by its number', () => {
    const { engine, paint, send, rows, open } = setup();
    engine.events.emit('checkout.started', CHECKOUT);
    send('checkout.started', 'checkout_started', CHECKOUT, 'bc');
    const order = publicOrder(ORDER);
    engine.events.emit('order.paid', order);
    send('order.paid', 'checkout_completed', order, '1001');
    paint();
    expect(rows().map(([, name, sub, end]) => [name, sub, end])).toEqual([
      ['checkout_completed', 'Order paid · Earbuds ×2', expect.stringMatching(/^\$106\.11/)],
      ['checkout_started', 'Checkout started · Earbuds ×1', expect.stringMatching(/^\$49\.00/)],
    ]);
    expect(Object.fromEntries(open('checkout_started')).Data).toBe('checkoutid c1');
    expect(Object.fromEntries(open('checkout_completed')).Data).toMatch(/^orderref_id R1number 1001currency USD/);
  });

  it('steps through the listed events with Newer and Older, or the arrow keys', () => {
    const { engine, flow, paint, send, open } = setup();
    engine.events.emit('sdk.ready', engine.snapshot());
    send('sdk.ready', 'page_viewed', {}, 'pv');
    engine.events.emit('cart.calculated', CART);
    send('cart.calculated', 'product_added_to_cart', { ...EARBUDS, first_in_session: true }, 'atc');
    paint();
    open('product_added_to_cart');
    const button = (text: string) =>
      [...flow.dialog.querySelectorAll<HTMLButtonElement>('footer .btn')].find((b) => b.textContent === text)!;
    const heading = () => flow.dialog.querySelector('h2')!.textContent;
    expect([button('Newer').disabled, button('Older').disabled]).toEqual([true, false]);
    button('Older').click();
    expect(heading()).toBe('page_viewed');
    expect([button('Newer').disabled, button('Older').disabled]).toEqual([false, true]);
    flow.dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(heading()).toBe('product_added_to_cart');
    button('Done').click();
    expect(flow.dialog.open).toBe(false);
  });

  it('says why an event was not sent', () => {
    const { engine, flow, paint, decide, toggle, open, tabs } = setup();
    engine.events.emit('cart.calculated', CART);
    decide('cart.calculated', 'product_removed_from_cart', false, 'Nothing was removed since the last report');
    paint();
    toggle().click();
    expect(open('product_removed_from_cart')).toEqual([
      ['Why', 'Nothing was removed since the last reportCart priced: cart.calculated'],
    ]);
    expect(tabs()).toEqual(['Summary', 'Event']);
    expect(flow.dialog.querySelector('header p')!.textContent).toMatch(/ · Not sent$/);
  });

  it('puts an incomplete object and a push that did not arrive in the verdict, the funnel and the row', () => {
    const { engine, flow, paint, send, rows, verdict, steps, open } = setup();
    const order = { ...publicOrder(ORDER), lines: [], currency: undefined, number: undefined };
    engine.events.emit('order.paid', order);
    send('order.paid', 'checkout_completed', order, 'p1', { layers: false });
    win.NextDataLayer = [{ event: 'dl_purchase', event_id: 'p1' }];
    win.dataLayer = [];
    paint();
    expect(verdict()).toBe('1 event with problems: checkout_completed lines is empty');
    expect(steps().find(([, name]) => name === 'checkout_completed')).toEqual([
      'warn',
      'checkout_completed',
      'This page · lines is empty',
    ]);
    expect(rows()[0]!.slice(0, 3)).toEqual([
      'warn',
      'checkout_completed',
      'Order paid · ⚠ lines is empty · ⚠ no currency · ⚠ checkout_completed has no order number · ⚠ not in dataLayer',
    ]);
    const detail = Object.fromEntries(open('checkout_completed'));
    expect(detail.Problems).toBe('⚠ lines is empty⚠ no currency⚠ checkout_completed has no order number');
    expect(detail.Reached).toBe('dl_purchaseNextDataLayerGTM dataLayer: not pushed');
    expect([...flow.dialog.querySelectorAll('.adetail .chip')].map((c) => c.className)).toEqual([
      'chip ok',
      'chip warn',
    ]);
  });

  it('takes one push for every line of a bundle added or removed at once', () => {
    const { engine, paint, send, rows, open } = setup();
    const created_at = '2026-11-05T10:00:00.000Z';
    const bump: CartItem = { package_id: 2, quantity: 1, product_title: 'Bump', price: 20, total: 20 };
    engine.events.emit('cart.calculated', { ...CART, lines: [EARBUDS, bump] });
    send('cart.calculated', 'product_added_to_cart', { ...EARBUDS, first_in_session: true }, 'a1', {
      layers: false,
      created_at,
    });
    send('cart.calculated', 'product_added_to_cart', { ...bump, first_in_session: false }, 'a2', {
      layers: false,
      created_at,
    });
    send('cart.calculated', 'product_added_to_cart', { ...bump, first_in_session: false }, 'a3', {
      layers: false,
      created_at: '2026-11-05T10:00:01.000Z',
    });
    send('cart.calculated', 'cart_updated', { ...CART, lines: [EARBUDS, bump] }, 'u1', { layers: false });
    win.NextDataLayer = [{ event: 'dl_add_to_cart', event_id: 'a1' }];
    win.dataLayer = [{ event: 'dl_add_to_cart', event_id: 'a1' }];
    paint();
    expect(rows().map(([state, name, sub]) => [state, name, sub])).toEqual([
      ['warn', 'cart_updated', 'Cart priced · ⚠ not in NextDataLayer · ⚠ not in dataLayer'],
      ['warn', 'product_added_to_cart', 'Cart priced · ⚠ not in NextDataLayer · ⚠ not in dataLayer'],
      ['ok', 'product_added_to_cart', 'Cart priced · + Bump ×1'],
      ['ok', 'product_added_to_cart', 'Cart priced · + Earbuds ×1'],
    ]);
    expect(Object.fromEntries(open('product_added_to_cart', 1)).Reached).toBe(
      'dl_add_to_cartNextDataLayerGTM dataLayer',
    );
  });

  it('shows GTM reading a push, and a GA4 request named as GA4 names the event that left the page after it', () => {
    win.google_tag_manager = { 'GTM-ABC123': {} };
    win.nextCampaign = { event() {} };
    const { engine, flow, paint, send, chips, steps, open, tabs, tab } = setup();
    engine.events.emit('cart.calculated', CART);
    send('cart.calculated', 'product_added_to_cart', { ...EARBUDS, first_in_session: true }, 'atc');
    send('cart.calculated', 'cart_updated', CART, 'u1');
    (win.dataLayer![0] as Record<string, unknown>)['gtm.uniqueEventId'] = 7;
    const collect = (en: string) => ({
      name: `https://region1.google-analytics.com/g/collect?v=2&tid=G-TEST1&en=${en}`,
      startTime: Date.now() - performance.timeOrigin + 20,
    });
    vi.spyOn(performance, 'getEntriesByType').mockReturnValue([
      collect('add_to_cart'),
      collect('cart_updated'),
      collect('page_view'),
      { name: 'https://cdn.test/app.js', startTime: 0 },
    ] as never);
    paint();
    expect(chips()).toContain('GA4 · G-TEST1');
    expect(steps().find(([, name]) => name === 'product_added_to_cart')).toEqual([
      'done',
      'product_added_to_cart',
      'This page · reached GA4',
    ]);
    expect(Object.fromEntries(open('cart_updated')).Reached).toBe('dl_cart_updatedNextDataLayerGTM dataLayer');
    expect(Object.fromEntries(open('product_added_to_cart')).Reached).toBe(
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
    engine.events.emit('sdk.ready', engine.snapshot());
    send('sdk.ready', 'page_viewed', {}, 'pv');
    paint();
    expect(chips()).toEqual(['NextDataLayer · 1 event', 'GTM dataLayer · off', 'NEXT analytics · own page_view']);
    expect(verdict()).toBe('GTM tags get none of these events: GTM dataLayer is off');
    expect(notes()).toEqual(['Off in nextConfig: analytics.providers.gtm.enabled is false.']);
    expect(Object.fromEntries(open('page_viewed'))['Reached']).toBe('dl_user_dataNextDataLayer');
  });

  it('runs the exit popup straight to the data layer, and names a provider that cannot deliver', () => {
    const { engine, paint, decide, rows, verdict, open, tabs } = setup();
    win.NextDataLayer = [{ event: 'dl_exit_intent_shown', event_id: 'x1' }];
    win.dataLayer = [{ event: 'dl_exit_intent_shown', event_id: 'x1' }];
    engine.events.emit('promotion.viewed', { id: 'exit_intent', type: 'exit_intent' });
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
    engine.events.emit('sdk.ready', engine.snapshot());
    send('sdk.ready', 'page_viewed', {}, 'pv');
    decide('sdk.ready', 'product_viewed', false, 'No package on the page');
    paint('package');
    expect(root.querySelector('.anone')!.textContent).toBe('Nothing matches the filter.');
    toggle().click();
    expect(rows().map(([, name]) => name)).toEqual(['product_viewed']);
    const off = setup({ ...ON, enabled: false });
    off.paint();
    expect(off.verdict()).toBe('Analytics is off: nextConfig.analytics.enabled is false.');
    expect(off.notes()).toEqual([]);
  });
});

describe('checks', () => {
  it('finds the lines of each object', () => {
    expect(linesOf('page_viewed', {})).toEqual([]);
    expect(linesOf('product_viewed', EARBUDS)).toEqual([EARBUDS]);
    expect(linesOf('product_list_viewed', [EARBUDS])).toEqual([EARBUDS]);
    expect(linesOf('product_removed_from_cart', EARBUDS)).toEqual([EARBUDS]);
    expect(linesOf('cart_updated', CART)).toEqual([EARBUDS]);
    expect(linesOf('checkout_payment_info_submitted', CHECKOUT)).toEqual([EARBUDS]);
    expect(linesOf('upsell_viewed', { ref_id: 'R1', page: '/u', lines: [EARBUDS] })).toEqual([EARBUDS]);
    expect(linesOf('checkout_completed', publicOrder(ORDER))).toHaveLength(1);
    expect(linesOf('promotion_viewed', { id: 'x', type: 'banner' })).toEqual([]);
  });

  it('checks that each event carries its object whole', () => {
    expect(checks('page_viewed', {})).toEqual([]);
    expect(checks('product_added_to_cart', { ...EARBUDS, first_in_session: true })).toEqual([]);
    expect(checks('product_added_to_cart', { package_id: 1, quantity: 1 })).toEqual(['a line has no product_title']);
    expect(checks('cart_updated', { lines: [], coupons: [] })).toEqual(['no currency']);
    expect(checks('checkout_started', { id: 'c1', cart: { lines: [], coupons: [] } })).toEqual([
      'lines is empty',
      'no currency',
    ]);
    expect(checks('checkout_completed', publicOrder(ORDER))).toEqual([]);
    expect(checks('upsell_completed', { ...publicOrder(ORDER), number: undefined })).toEqual([
      'upsell_completed has no order number',
    ]);
  });
});
