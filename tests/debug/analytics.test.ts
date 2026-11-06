import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startAnalytics } from '../../src/analytics';
import { createCheckout } from '../../src/checkout/state/checkout';
import { analyticsFlow } from '../../src/debug/analytics';
import {
  analyticsOff,
  checks,
  destinations,
  linesOf,
  type ProviderConfig,
  unsupportedNotes,
  WIRING,
} from '../../src/debug/providers';
import type { PageVisit } from '../../src/debug/state';
import { nodes } from '../../src/debug/view';
import { GA4 } from '../../src/destinations/ga4';
import {
  type AnalyticsTrace,
  type DestinationTrace,
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
  nextConfig?: unknown;
  gtag?: unknown;
  fbq?: unknown;
  rudderanalytics?: unknown;
};
const win = window as Win;

const page = (path: string, sent: string[], kind: PageVisit['kind'] = 'page'): PageVisit => ({
  at: 0,
  path,
  title: path,
  kind,
  scope: 's',
  reloads: 0,
  units: 0,
  sent,
  marks: [],
});

function setup(config: ProviderConfig = ON, pages: PageVisit[] = []) {
  const { engine } = makeEngine();
  const root = document.createElement('div');
  const pageConfig = { dialog: document.createElement('dialog'), open: vi.fn(), trying: () => false, reset: vi.fn() };
  let query = '';
  const paint = (q = query) => root.replaceChildren(...nodes(flow.view((query = q))));
  const flow = analyticsFlow({
    open: new Set(),
    config: () => config,
    pageConfig,
    pages: () => pages,
  });
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
  const lines = () => [...root.querySelectorAll<HTMLElement>(':scope > details.aev > summary, :scope > div.aev')];
  const rows = () =>
    lines().map((r) =>
      [r.querySelector('.aname'), r.querySelector('.asum'), r.querySelector('.aprob')]
        .map((el) => el?.textContent)
        .filter(Boolean)
        .join(' | '),
    );
  const notes = () => [...root.querySelectorAll(':scope > .anote')].map((n) => n.textContent);
  const header = () => root.querySelector(':scope > .summary')?.textContent;
  const PLACE: Record<string, string> = {
    NextDataLayer: 'NextDataLayer',
    'GTM dataLayer': 'dataLayer',
    GA4: 'ga4',
    Meta: 'meta',
    RudderStack: 'rudderstack',
  };
  const offs = () => root.querySelector<HTMLElement>('.adests > .aoff');
  const dests = () => ({
    ...Object.fromEntries(
      [...root.querySelectorAll<HTMLElement>('.adests > .aplace')].map((b) => [
        b.dataset.place,
        b.querySelector('b')!.textContent,
      ]),
    ),
    ...Object.fromEntries(
      (offs()?.textContent!.replace('Off: ', '').split(', ') ?? []).map((label) => [PLACE[label], 'off']),
    ),
  });
  const titleOf = (place: string) => root.querySelector<HTMLElement>(`.adests > [data-place=${place}]`)!.title;
  const steps = () =>
    [...root.querySelectorAll<HTMLElement>('.afunnel > .astep')].map((b) => [b.textContent, b.dataset.done, b.title]);
  const row = (nth: number) => root.querySelectorAll<HTMLDetailsElement>(':scope > details')[nth]!;
  const logos = (nth: number) =>
    [...row(nth).querySelectorAll<HTMLElement>(':scope > summary .amarks .icon')].map((i) => i.title);
  const open = (nth: number) => {
    row(nth).open = true;
    const parts = [...row(nth).querySelectorAll<HTMLDetailsElement>(':scope > details')];
    const label = (d: HTMLDetailsElement) => d.querySelector('summary')!.textContent!.replace(/ [{[].*$/, '');
    return {
      sections: parts.map(label),
      section: (start: string) => {
        const part = parts.find((p) => label(p).startsWith(start))!;
        part.open = true;
        return part.textContent!;
      },
    };
  };
  return {
    engine,
    root,
    flow,
    pageConfig,
    paint,
    decide,
    send,
    rows,
    notes,
    header,
    dests,
    offs,
    titleOf,
    steps,
    logos,
    open,
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  for (const key of [
    'NextDataLayer',
    'dataLayer',
    'google_tag_manager',
    'nextCampaign',
    'NextDataLayerTransformFn',
    'nextConfig',
    'gtag',
    'fbq',
    'rudderanalytics',
  ])
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

describe('destinations', () => {
  const states = (config: ProviderConfig, started = true) =>
    Object.fromEntries(destinations(config, started).map((d) => [d.place, [d.on, d.missing, d.title]]));
  const nothing = (name: string, legacy = '') =>
    `${name} is off: turn it on with analytics.destinations.${name.toLowerCase()}.enabled${legacy} in nextConfig.`;

  it('flags a destination that is on but has nothing on the page to send through', () => {
    expect(states(ON)).toEqual({
      NextDataLayer: [true, 'NEXT script', 'NEXT analytics is on, but its script is not on the page.'],
      dataLayer: [true, 'GTM container', 'GTM dataLayer is on, but this page has no GTM container.'],
      ga4: [false, undefined, nothing('GA4')],
      meta: [false, undefined, nothing('Meta', ' (0.4.x: analytics.providers.facebook.enabled)')],
      rudderstack: [false, undefined, nothing('RudderStack', ' (0.4.x: analytics.providers.rudderstack.enabled)')],
    });
    expect(states(ON, false).NextDataLayer).toEqual([true, undefined, undefined]);
  });

  it('reads nextConfig.analytics.destinations over the 0.4.x providers, and finds each tag', () => {
    win.nextConfig = { analytics: { destinations: { ga4: { enabled: true }, rudderstack: { enabled: true } } } };
    expect(states({ ...ON, meta: true })).toMatchObject({
      ga4: [true, 'gtag', 'GA4 is on, but this page has no Google tag (gtag).'],
      meta: [true, 'fbq', 'Meta is on, but this page has no Meta Pixel (fbq).'],
      rudderstack: [true, 'rudderanalytics', 'RudderStack is on, but this page has no rudderanalytics.'],
    });
    win.google_tag_manager = { 'GTM-ABC123': {} };
    win.nextCampaign = { event() {} };
    win.gtag = () => {};
    win.fbq = () => {};
    win.rudderanalytics = {};
    expect(destinations({ ...ON, meta: true }, true).filter((d) => !d.on || d.missing || d.title)).toEqual([]);
    win.nextConfig = { analytics: { destinations: { gtm: { enabled: false }, meta: { enabled: false } } } };
    expect(states({ ...ON, meta: true })).toMatchObject({
      dataLayer: [
        false,
        undefined,
        'GTM tags get none of these events: analytics.destinations.gtm.enabled is false in nextConfig.',
      ],
      meta: [false, undefined, nothing('Meta', ' (0.4.x: analytics.providers.facebook.enabled)')],
    });
  });

  it('turns every destination off with analytics, and names the nextConfig key that turns one off', () => {
    const off = 'Analytics is off for this tab: ?ignore=true. Open a page with ?ignore=false to turn it back on.';
    expect(Object.values(states({ ...ON, ignored: true }))).toEqual(Array(5).fill([false, undefined, off]));
    expect(analyticsOff({ ...ON, enabled: false })).toBe('Analytics is off: nextConfig.analytics.enabled is false.');
    expect(states({ ...ON, nextCampaign: false, dataLayer: false })).toMatchObject({
      NextDataLayer: [
        true,
        undefined,
        'NEXT analytics is off: analytics.providers.nextCampaign.enabled is false in nextConfig.',
      ],
      dataLayer: [
        false,
        undefined,
        'GTM tags get none of these events: analytics.providers.gtm.enabled is false in nextConfig.',
      ],
    });
    expect(unsupportedNotes({ ...ON, unsupported: ['custom'] })).toEqual([
      "Custom endpoint is on in nextConfig, but it is not built in: send events from next.analytics.on('*', fn).",
    ]);
  });
});

describe('analytics tab', () => {
  beforeEach(() => {
    win.google_tag_manager = { 'GTM-ABC123': {} };
    win.nextCampaign = { event() {} };
  });

  it('lists the events sent on this page, newest first, each with what it carried and where it went', () => {
    win.nextConfig = { analytics: { destinations: { rudderstack: { enabled: true } } } };
    const { engine, paint, send, decide, rows, header, dests, titleOf, logos, open } = setup();
    engine.events.emit('sdk.ready', engine.snapshot());
    send('sdk.ready', 'page_viewed', {}, 'pv');
    decide('sdk.ready', 'product_viewed', false, 'No package on the page');
    send('cart.calculated', 'cart_updated', CART, 'cu');
    const ga4: DestinationTrace = {
      trace: 'destination',
      destination: 'ga4',
      name: 'update_cart',
      tracking: 'cart_updated',
      event_id: 'cu',
      payload: { currency: 'USD', value: 49 },
    };
    engine.log.debug('destination ga4 update_cart sent', ga4);
    engine.log.debug('destination meta AddToCart sent', {
      ...ga4,
      destination: 'meta',
      name: 'AddToCart',
      payload: { params: { value: 49 }, eventID: 'cu' },
    });
    paint();
    expect(header()).toBe('2 events sent on this page, newest first');
    expect(rows()).toEqual(['cart_updated | Earbuds ×1 · $49.00', 'page_viewed']);
    expect(dests()).toEqual({
      NextDataLayer: '2',
      dataLayer: '2',
      ga4: '1',
      meta: '1',
      rudderstack: 'no rudderanalytics',
    });
    expect(titleOf('ga4')).toBe('1 event reached GA4 on this page.');
    expect(titleOf('rudderstack')).toBe(
      '0 events reached RudderStack on this page. RudderStack is on, but this page has no rudderanalytics.',
    );
    expect(logos(0)).toEqual(['NextDataLayer', 'GTM dataLayer', 'GA4', 'Meta']);
    expect(logos(1)).toEqual(['NextDataLayer', 'GTM dataLayer']);
    const row = open(0);
    expect(row.sections).toEqual([
      'next.analytics.on',
      'NextDataLayerdl_cart_updated',
      'GTM dataLayerdl_cart_updated',
      'GA4update_cart',
      'MetaAddToCart',
    ]);
    const event = row.section('next.analytics.on');
    expect(event).toContain('event_id "cu"');
    expect(event).toContain('session_id "s1"');
    expect(row.section('GA4')).toContain('value 49');
    expect(row.section('Meta')).toContain('eventID "cu"');
  });

  it('sums up each event in one line: products with quantity, the price, and the order number', () => {
    const { engine, paint, send, rows } = setup();
    engine.events.emit('sdk.ready', engine.snapshot());
    send(
      'cart.calculated',
      'product_added_to_cart',
      { ...EARBUDS, quantity: 2, total: 98, first_in_session: true },
      'a1',
    );
    send('checkout.started', 'checkout_started', CHECKOUT, 'cs');
    send('order.paid', 'checkout_completed', publicOrder(ORDER), 'p1');
    paint();
    expect(rows()).toEqual([
      'checkout_completed | #1001 · Earbuds ×2 · $106.11',
      'checkout_started | Earbuds ×1 · $49.00',
      'product_added_to_cart | Earbuds ×2 · $98.00',
    ]);
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
    expect(rows()).toEqual([`checkout_completed | $106.11 | ⚠ ${problems}`]);
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
      'product_added_to_cart | Bump ×1 · $20.00 | ⚠ not in NextDataLayer · not in dataLayer',
      'product_added_to_cart | Bump ×1 · $20.00',
      'product_added_to_cart | Earbuds ×1 · $49.00',
    ]);
  });

  it('opens an exit popup event, which goes straight to the data layer, to its push', () => {
    const { engine, paint, decide, rows, open } = setup();
    win.NextDataLayer = [{ event: 'dl_exit_intent_shown', event_id: 'x1' }];
    win.dataLayer = [{ event: 'dl_exit_intent_shown', event_id: 'x1' }];
    engine.events.emit('promotion.viewed', { id: 'exit_intent', type: 'exit_intent' });
    decide('promotion.viewed', 'dl_exit_intent_shown', true, 'Data layer only: there is no analytics event', 'x1');
    paint();
    expect(rows()).toEqual(['dl_exit_intent_shown']);
    const row = open(0);
    expect(row.sections).toEqual(['NextDataLayerdl_exit_intent_shown', 'GTM dataLayerdl_exit_intent_shown']);
    expect(row.section('NextDataLayer')).toContain('event_id "x1"');
  });

  it('marks a destination turned off, notes a provider that is not built in, and puts only the warnings in Issues', () => {
    delete win.google_tag_manager;
    const { engine, flow, paint, send, notes, dests, offs } = setup({
      ...ON,
      dataLayer: false,
      unsupported: ['custom'],
    });
    engine.events.emit('sdk.ready', engine.snapshot());
    send('sdk.ready', 'page_viewed', {}, 'pv', { layers: false });
    win.NextDataLayer = [{ event: 'dl_user_data', event_id: 'pv' }];
    paint();
    const custom =
      "Custom endpoint is on in nextConfig, but it is not built in: send events from next.analytics.on('*', fn).";
    expect(notes()).toEqual([custom]);
    expect(dests()).toMatchObject({ NextDataLayer: '1', dataLayer: 'off' });
    expect(offs()!.title).toContain(
      'GTM tags get none of these events: analytics.providers.gtm.enabled is false in nextConfig.',
    );
    expect(flow.notes()).toEqual([custom]);
  });

  it('opens Page config at its analytics section from the Config button', () => {
    const { root, paint, pageConfig } = setup();
    paint();
    const config = [...root.querySelectorAll<HTMLButtonElement>('.adests > .btn')].find(
      (b) => b.textContent === 'Config',
    )!;
    config.click();
    expect(pageConfig.open).toHaveBeenCalledWith('analytics');
  });

  it('marks each funnel step sent on any page of the tab, and the upsell steps once the tab saw an upsell', () => {
    const pages = [
      page('/', ['page_viewed', 'product_viewed']),
      page('/checkout', ['page_viewed', 'checkout_started']),
    ];
    const { paint, steps, root } = setup(ON, pages);
    paint();
    expect(root.querySelector('.afunnel > .asub')!.textContent).toBe('Funnel 3/9');
    expect(steps().slice(0, 4)).toEqual([
      ['Page', 'true', 'page_viewed: sent on /, /checkout'],
      ['Product', 'true', 'product_viewed: sent on /'],
      ['Cart', 'false', 'product_added_to_cart: not sent on any page of this tab yet'],
      ['Checkout', 'true', 'checkout_started: sent on /checkout'],
    ]);
    pages.push(page('/upsell', ['upsell_viewed'], 'upsell'));
    paint();
    expect(
      steps()
        .map(([name]) => name)
        .slice(-3),
    ).toEqual(['Purchase', 'Upsell', 'Upsell paid']);
  });

  it('filters events by name or what they carried', () => {
    const { engine, root, paint, send, rows } = setup();
    engine.events.emit('sdk.ready', engine.snapshot());
    send('sdk.ready', 'page_viewed', {}, 'pv');
    send('cart.calculated', 'product_added_to_cart', { ...EARBUDS, first_in_session: true }, 'a1');
    send('cart.calculated', 'cart_updated', CART, 'cu');
    send('checkout.started', 'checkout_started', CHECKOUT, 'cs');
    paint('earbuds');
    expect(rows().map((r) => r.split(' | ')[0])).toEqual(['checkout_started', 'cart_updated', 'product_added_to_cart']);
    paint('checkout');
    expect(rows().map((r) => r.split(' | ')[0])).toEqual(['checkout_started']);
    paint('nope');
    expect(root.querySelector('.empty')!.textContent).toContain('Nothing matches');
  });

  it('explains an empty page, analytics not started yet, or turned off', () => {
    const { root, paint, notes } = setup();
    paint();
    expect(notes()).toEqual(['Analytics starts once the page is idle.']);
    expect(root.querySelector('.empty')!.textContent).toContain('Nothing sent yet');
    const off = setup({ ...ON, enabled: false });
    off.paint();
    expect(off.notes()).toEqual(['Analytics is off: nextConfig.analytics.enabled is false.']);
    expect(Object.values(off.dests())).toEqual(Array(5).fill('off'));
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
