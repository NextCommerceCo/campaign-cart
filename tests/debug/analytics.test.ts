import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startAnalytics } from '../../src/analytics';
import { createCheckout } from '../../src/checkout/state/checkout';
import { analyticsFlow } from '../../src/debug/analytics';
import { checks, linesOf, type ProviderConfig, setupNotes, WIRING } from '../../src/debug/providers';
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
const CART: Cart = { lines: [EARBUDS], coupons: [], quantity: 1, currency: 'USD', total: 49 };
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
  const flow = analyticsFlow({ open: new Set(), config: () => config });
  const paint = (query = '') => root.replaceChildren(...nodes(flow.view(query)));
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
        layer.push({ event: DL[name], event_id: id });
    decide(trigger, name, true, `reason for ${name}`, id);
  };
  const rows = () =>
    [...root.querySelectorAll(':scope > details > summary, :scope > .row')].map((r) =>
      r.textContent!.replace(/^\d\d:\d\d:\d\d\.\d{3}/, '').replace(/ \{.*\}$/, ''),
    );
  const notes = () => [...root.querySelectorAll(':scope > .summary')].map((n) => n.textContent);
  const open = (nth: number) => {
    const row = root.querySelectorAll<HTMLDetailsElement>(':scope > details')[nth]!;
    row.open = true;
    return row.textContent!;
  };
  return { engine, root, flow, paint, decide, send, rows, notes, open };
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

describe('setup notes', () => {
  const texts = (config: ProviderConfig, started: boolean) => setupNotes(config, started).map((n) => [n.warn, n.text]);

  it('flags a provider that is on but has nothing to send to', () => {
    expect(texts(ON, true)).toEqual([
      [true, 'GTM dataLayer is on, but this page has no GTM container.'],
      [true, 'NEXT analytics is on, but its script is not on the page.'],
    ]);
  });

  it('says nothing once the GTM container and the NEXT script load', () => {
    win.google_tag_manager = { 'GTM-ABC123': {}, 'G-XYZ': {} };
    win.nextCampaign = { event() {} };
    expect(texts(ON, true)).toEqual([]);
  });

  it('names the nextConfig key that turns a provider off, and providers that are not built in', () => {
    const config = { enabled: true, nextCampaign: false, dataLayer: false, unsupported: ['custom'] };
    expect(texts(config, false)).toEqual([
      [false, 'Analytics starts once the page is idle.'],
      [false, 'GTM tags get none of these events: analytics.providers.gtm.enabled is false in nextConfig.'],
      [false, 'NEXT analytics is off: analytics.providers.nextCampaign.enabled is false in nextConfig.'],
      [
        true,
        "Custom endpoint is on in nextConfig, but it is not built in: send events from next.analytics.on('*', fn).",
      ],
    ]);
    expect(texts({ ...ON, enabled: false }, false)).toEqual([
      [false, 'Analytics is off: nextConfig.analytics.enabled is false.'],
    ]);
  });
});

describe('analytics tab', () => {
  beforeEach(() => {
    win.google_tag_manager = { 'GTM-ABC123': {} };
    win.nextCampaign = { event() {} };
  });

  it('lists the events sent on this page, newest first, each opening to the event next.analytics.on gets', () => {
    const { engine, paint, send, decide, rows, notes, open } = setup();
    engine.events.emit('sdk.ready', engine.snapshot());
    send('sdk.ready', 'page_viewed', {}, 'pv');
    decide('sdk.ready', 'product_viewed', false, 'No package on the page');
    send('cart.calculated', 'cart_updated', CART, 'cu');
    paint();
    expect(notes()).toEqual(['2 events sent on this page, newest first']);
    expect(rows()).toEqual(['cart cart_updated', 'page page_viewed']);
    const event = open(0);
    expect(event).toContain('event_id "cu"');
    expect(event).toContain('session_id "s1"');
    expect(event).toContain('context');
  });

  it('shows an incomplete object and a push that did not arrive on its row, and in Issues', () => {
    const { engine, flow, paint, send, rows } = setup();
    const order = { ...publicOrder(ORDER), lines: [], currency: undefined, number: undefined };
    engine.events.emit('order.paid', order);
    send('order.paid', 'checkout_completed', order, 'p1', { layers: false });
    win.NextDataLayer = [{ event: 'dl_purchase', event_id: 'p1' }];
    win.dataLayer = [];
    paint();
    const problems = 'lines is empty · no currency · checkout_completed has no order number · not in dataLayer';
    expect(rows()).toEqual([`order checkout_completed ⚠ ${problems}`]);
    expect(flow.problems()).toEqual([{ text: `checkout_completed: ${problems}`, error: true }]);
    expect(flow.summary()).toBe('1 sent · ⚠ 1');
  });

  it('takes one push for every line of a bundle added or removed at once', () => {
    const { engine, paint, send, rows } = setup();
    const created_at = '2026-11-05T10:00:00.000Z';
    const bump: CartItem = { package_id: 2, quantity: 1, product_title: 'Bump', price: 20, total: 20 };
    engine.events.emit('cart.calculated', { ...CART, lines: [EARBUDS, bump] });
    const add = (data: TrackingMap['product_added_to_cart'], id: string, at = created_at) =>
      send('cart.calculated', 'product_added_to_cart', data, id, { layers: false, created_at: at });
    add({ ...EARBUDS, first_in_session: true }, 'a1');
    add({ ...bump, first_in_session: false }, 'a2');
    add({ ...bump, first_in_session: false }, 'a3', '2026-11-05T10:00:01.000Z');
    win.NextDataLayer = [{ event: 'dl_add_to_cart', event_id: 'a1' }];
    win.dataLayer = [{ event: 'dl_add_to_cart', event_id: 'a1' }];
    paint();
    expect(rows()).toEqual([
      'cart_line product_added_to_cart ⚠ not in NextDataLayer · not in dataLayer',
      'cart_line product_added_to_cart',
      'cart_line product_added_to_cart',
    ]);
  });

  it('opens an exit popup event, which goes straight to the data layer, to its push', () => {
    const { engine, paint, decide, rows, open } = setup();
    win.NextDataLayer = [{ event: 'dl_exit_intent_shown', event_id: 'x1' }];
    win.dataLayer = [{ event: 'dl_exit_intent_shown', event_id: 'x1' }];
    engine.events.emit('promotion.viewed', { id: 'exit_intent', type: 'exit_intent' });
    decide('promotion.viewed', 'dl_exit_intent_shown', true, 'Data layer only: there is no analytics event', 'x1');
    paint();
    expect(rows()).toEqual(['data layer dl_exit_intent_shown']);
    expect(open(0)).toContain('event "dl_exit_intent_shown"');
  });

  it('puts setup notes on top, and only the warnings in Issues', () => {
    delete win.google_tag_manager;
    const { engine, flow, paint, send, notes } = setup({ ...ON, dataLayer: false, unsupported: ['custom'] });
    engine.events.emit('sdk.ready', engine.snapshot());
    send('sdk.ready', 'page_viewed', {}, 'pv');
    paint();
    const custom =
      "Custom endpoint is on in nextConfig, but it is not built in: send events from next.analytics.on('*', fn).";
    expect(notes()).toEqual([
      'GTM tags get none of these events: analytics.providers.gtm.enabled is false in nextConfig.',
      custom,
      '1 event sent on this page, newest first',
    ]);
    expect(flow.notes()).toEqual([custom]);
  });

  it('filters events by name, and explains an empty page or analytics turned off', () => {
    const { engine, root, paint, send, rows, notes } = setup();
    paint();
    expect(notes()).toEqual(['Analytics starts once the page is idle.']);
    expect(root.querySelector('.empty')!.textContent).toContain('Nothing sent yet');
    engine.events.emit('sdk.ready', engine.snapshot());
    send('sdk.ready', 'page_viewed', {}, 'pv');
    send('cart.calculated', 'cart_updated', CART, 'cu');
    paint('page');
    expect(rows()).toEqual(['page page_viewed']);
    paint('nope');
    expect(root.querySelector('.empty')!.textContent).toContain('Nothing matches');
    const off = setup({ ...ON, enabled: false });
    off.paint();
    expect(off.notes()).toEqual(['Analytics is off: nextConfig.analytics.enabled is false.']);
    expect(off.flow.notes()).toEqual([]);
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
