import { readFileSync } from 'node:fs';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createCheckout } from '../../src/checkout/state/checkout';
import { startRudderStack } from '../../src/destinations/rudderstack';
import { RUDDERSTACK, rudderStackCalls } from '../../src/destinations/rudderstack/calls';
import type { Engine } from '../../src/engine/engine';
import { OBJECTS, type TrackingEvent, type TrackingName } from '../../src/engine/events/analytics';
import type { EventContext } from '../../src/engine/events/context';
import { createOrder } from '../../src/order/state';
import { fakeApi, json } from '../fixtures/api';
import { makeEngine } from '../fixtures/engine';
import { ORDER, withUpsell } from '../fixtures/order';
import { fakeRules } from '../fixtures/rules';

type Push = Record<string, any>;
const EXAMPLES = JSON.parse(readFileSync('docs/analytics-examples.json', 'utf8')) as Record<
  TrackingName,
  { data: any; dataLayer: Push }
>;
const SESSION = '0b8f3c2d1e4a4f6b9c7d5e3f2a1b0c9d';
const URL_ = 'http://localhost:3000/';
const CONTEXT: EventContext = {
  page_location: URL_,
  page_title: 'Olympus Earbuds',
  page_referrer: '',
  campaign: { id: 1310, name: 'Olympus', currency: 'USD', language: 'en' },
  session_id: SESSION,
  attribution: {},
  browser: { user_agent: 'test', language: 'en-US', device_type: 'desktop' },
};
const IDS: Partial<Record<TrackingName, string>> = { checkout_completed: '1001', upsell_completed: 'R1-US1' };
const OPTIONS = { apiKey: 'pk_test' };
const USER = {
  email: 'jane@example.com',
  first_name: 'Jane',
  last_name: 'Doe',
  accepts_marketing: false,
  language: 'en',
  user_agent: 'UA',
};

const event = (type: TrackingName, data: unknown = EXAMPLES[type].data) =>
  ({
    event_id: IDS[type] ?? `ev-${type}`,
    event_type: type,
    object: OBJECTS[type],
    data,
    created_at: '2026-11-04T08:30:00.000Z',
    session_id: SESSION,
    sdk_version: '1.0.0',
    context: CONTEXT,
  }) as TrackingEvent;

/** The engine the examples were recorded with: the fixture campaign and order R1 with upsell line 99. */
const shop = async () => {
  const { engine } = makeEngine({ fetch: fakeApi({ getOrder: () => json(withUpsell(ORDER, 99, 1)) }).fetch });
  engine.log.level = 'silent';
  await engine.start();
  engine.order = engine.attach((ctx) => createOrder(ctx, engine.cart));
  await engine.order.load('R1');
  return engine;
};

const CAMPAIGN = {
  campaign_name: 'Olympus',
  campaign_api_key: 'pk_test',
  campaign_currency: 'USD',
  campaign_language: 'en',
  campaign_id: '1310',
  campaign_session_id: SESSION,
};
const CONTEXT_PROPS = { page_type: 'product', page_name: 'Olympus Earbuds', ...CAMPAIGN };

/**
 * The 0.4.x RudderStack adapter's property builders (`src/core/analytics/providers/rudderstack-*.ts`
 * at `e0f48913^`), ported as they were: the oracle the destination is checked against. Only the
 * store reads are replaced: page metadata, campaign data and `window.location.href` come in as
 * arguments, and `_metadata.session_id` is the tracking event's session.
 */
const legacy = (() => {
  const page = { pageType: 'product', pageName: 'Olympus Earbuds' };
  const href = URL_;
  const campaignData = (event: Push) => ({
    campaignName: event.campaign_name,
    campaignCurrency: event.campaign_currency,
  });
  const toNumber = (value: unknown) => {
    const n = typeof value === 'number' ? value : parseFloat(String(value));
    return Number.isFinite(n) ? n : 0;
  };
  const buildContextProps = (event: Push) => {
    const keys = [
      'campaign_name',
      'campaign_api_key',
      'campaign_currency',
      'campaign_language',
      'campaign_id',
      'campaign_session_id',
    ];
    const out: Record<string, string> = {};
    for (const key of keys) {
      const value = event[key];
      if (value !== undefined && value !== null && value !== '') out[key] = String(value);
    }
    return out;
  };
  const formatProduct = (item: any) => {
    const product: Record<string, any> = {
      product_id: String(item.item_product_id ?? item.product_id ?? item.item_id ?? item.id ?? ''),
      sku: String(item.item_sku ?? item.item_id ?? item.sku ?? ''),
      name: item.item_name ?? item.name ?? '',
      price: toNumber(item.price),
      quantity: parseInt(item.quantity, 10) || 1,
      url: href,
    };
    const category = item.item_category ?? item.category;
    if (category) product.category = category;
    const brand = item.item_brand ?? item.brand;
    if (brand) product.brand = brand;
    const variant = item.item_variant ?? item.variant;
    if (variant) product.variant = variant;
    if (item.coupon) product.coupon = item.coupon;
    const position = item.index ?? item.position;
    if (typeof position === 'number') product.position = position;
    const imageUrl = item.item_image ?? item.image_url ?? item.image;
    if (imageUrl) product.image_url = imageUrl;
    return product;
  };
  const formatProducts = (items: any[]) => (Array.isArray(items) ? items.map(formatProduct) : []);

  const build = (event: Push, rudderEventName: string) => {
    const data = event.data || event.ecommerce || {};
    const campaign = campaignData(event);
    const currency = data.currency || campaign.campaignCurrency || 'USD';
    const baseProps = { page_type: page.pageType, page_name: page.pageName, ...buildContextProps(event) };
    const sessionId = event._metadata?.session_id;
    const id = (key: string) => (sessionId ? { [key]: sessionId } : {});
    switch (rudderEventName) {
      case 'Product Viewed':
        return { ...formatProduct((data.items || [])[0] || {}), currency, ...baseProps };
      case 'Product List Viewed': {
        const props: any = { products: formatProducts(data.items || []), currency };
        const listId = data.item_list_id || data.list_id;
        if (listId) props.list_id = listId;
        const category = data.item_list_name || data.item_list_id;
        if (category) props.category = category;
        return { ...props, ...baseProps };
      }
      case 'Product Added':
      case 'Product Removed':
        return { ...id('cart_id'), ...formatProduct((data.items || [])[0] || {}), currency, ...baseProps };
      case 'Cart Viewed':
        return {
          ...id('cart_id'),
          products: formatProducts(data.items || []),
          currency,
          value: toNumber(data.value),
          ...baseProps,
        };
      case 'Checkout Started': {
        const value = toNumber(data.value);
        const props: any = {
          value,
          revenue: value,
          currency,
          affiliation: data.affiliation || campaign.campaignName || 'Funnels',
          products: formatProducts(data.items || []),
        };
        if (data.shipping !== undefined) props.shipping = toNumber(data.shipping);
        if (data.tax) props.tax = toNumber(data.tax);
        if (data.discount) props.discount = toNumber(data.discount);
        if (data.coupon) props.coupon = data.coupon;
        return { ...props, ...baseProps };
      }
      case 'Checkout Step Completed': {
        const props: any = { ...id('checkout_id'), step: 2 };
        if (data.shipping_tier) props.shipping_method = data.shipping_tier;
        return { ...props, ...baseProps };
      }
      case 'Payment Info Entered': {
        const props: any = { ...id('checkout_id'), step: 3 };
        if (data.payment_type) props.payment_method = data.payment_type;
        return { ...props, ...baseProps };
      }
      case 'Order Completed': {
        const value = toNumber(data.value);
        const tax = toNumber(data.tax);
        const shipping = toNumber(data.shipping);
        const props: any = {
          ...id('checkout_id'),
          order_id: data.transaction_id || '',
          affiliation: data.affiliation || campaign.campaignName || 'Funnels',
          subtotal: value,
          revenue: value,
          total: Math.round((value + tax + shipping) * 100) / 100,
          shipping,
          tax,
          currency,
          products: formatProducts(data.items || []),
        };
        if (data.discount) props.discount = toNumber(data.discount);
        if (data.coupon) props.coupon = data.coupon;
        return { ...props, ...baseProps };
      }
      case 'Upsell Viewed':
      case 'Upsell Skipped': {
        const upsell = event.upsell || {};
        const props: any = {
          order_id: event.order_id || '',
          product_id: upsell.package_id || '',
          name: upsell.package_name || '',
          quantity: 1,
          currency: upsell.currency || campaign.campaignCurrency || 'USD',
        };
        if (upsell.price !== undefined) props.price = toNumber(upsell.price);
        return { ...props, ...baseProps };
      }
      default:
        return { ...data, ...baseProps };
    }
  };

  const pagePlan = (event: Push) => {
    const p = event.page;
    const properties = { path: p.path, url: p.url, title: p.title, referrer: p.referrer, ...buildContextProps(event) };
    const name = `${page.pageType.charAt(0).toUpperCase()}${page.pageType.slice(1)} Page View`;
    return [
      { call: 'page', category: page.pageType, name: page.pageName, properties },
      { call: 'track', name, properties: { page_name: page.pageName, ...properties } },
    ];
  };

  return { build, pagePlan };
})();

describe('rudderStackCalls', () => {
  let engine: Engine;
  beforeAll(async () => {
    engine = await shop();
  });
  const calls = (type: TrackingName, data?: unknown) => rudderStackCalls(event(type, data), engine, OPTIONS);

  const EARBUDS = {
    product_id: '400',
    sku: '11',
    name: 'Earbuds ×1',
    price: 49,
    quantity: 1,
    url: URL_,
    category: 'Olympus',
    position: 0,
    image_url: 'https://cdn.test/1.png',
  };

  it('sends a page view as page() and a <Page type> Page View track', () => {
    const properties = { path: '/', url: URL_, title: 'Olympus Earbuds', referrer: '', ...CAMPAIGN };
    expect(calls('page_viewed')).toEqual([
      { call: 'page', category: 'product', name: 'Olympus Earbuds', properties },
      { call: 'track', name: 'Product Page View', properties: { page_name: 'Olympus Earbuds', ...properties } },
    ]);
    const upsell = rudderStackCalls(event('page_viewed'), engine, { pageType: 'upsell', pageName: 'Offer' });
    expect(upsell.map((c) => [c.call, 'name' in c && c.name])).toEqual([
      ['page', 'Offer'],
      ['track', 'Upsell Page View'],
    ]);
  });

  it.each([
    ['product_viewed', 'Product Viewed', { ...EARBUDS, currency: 'USD' }],
    ['product_added_to_cart', 'Product Added', { cart_id: SESSION, ...EARBUDS, currency: 'USD' }],
    ['product_removed_from_cart', 'Product Removed', { cart_id: SESSION, ...EARBUDS, currency: 'USD' }],
    ['cart_updated', 'Cart Viewed', { cart_id: SESSION, products: [EARBUDS], currency: 'USD', value: 49 }],
    [
      'checkout_started',
      'Checkout Started',
      { value: 49, revenue: 49, currency: 'USD', affiliation: 'Olympus', products: [EARBUDS], shipping: 0 },
    ],
    [
      'checkout_shipping_method_submitted',
      'Checkout Step Completed',
      { checkout_id: SESSION, step: 2, shipping_method: 'Standard' },
    ],
    [
      'checkout_payment_info_submitted',
      'Payment Info Entered',
      { checkout_id: SESSION, step: 3, payment_method: 'Credit Card' },
    ],
    [
      'upsell_skipped',
      'Upsell Skipped',
      { order_id: 'R1', product_id: '3', name: 'Earbuds case', quantity: 1, currency: 'USD' },
    ],
  ] as const)('%s is track(%s)', (type, name, properties) => {
    expect(calls(type)).toEqual([{ call: 'track', name, properties: { ...properties, ...CONTEXT_PROPS } }]);
  });

  it('identifies the shopper by email when they leave their details, and sends nothing without one', () => {
    const data = EXAMPLES.checkout_contact_info_submitted.data;
    const address = {
      first_name: 'Jane',
      last_name: 'Doe',
      line1: '1 Main St',
      city: 'Austin',
      state: 'TX',
      country: 'US',
    };
    expect(
      calls('checkout_contact_info_submitted', {
        ...data,
        user: { ...USER, phone: '+15125550100' },
        shipping_address: address,
      }),
    ).toEqual([
      {
        call: 'identify',
        userId: 'jane@example.com',
        traits: {
          email: 'jane@example.com',
          firstName: 'Jane',
          lastName: 'Doe',
          phone: '+15125550100',
          city: 'Austin',
          state: 'TX',
          country: 'US',
        },
      },
    ]);
    expect(calls('checkout_contact_info_submitted', { ...data, user: { ...USER, accepts_marketing: true } })).toEqual([
      {
        call: 'identify',
        userId: 'jane@example.com',
        traits: { email: 'jane@example.com', firstName: 'Jane', lastName: 'Doe', acceptsMarketing: true },
      },
    ]);
    expect(calls('checkout_contact_info_submitted', { ...data, user: { ...USER, email: undefined } })).toEqual([]);
    expect(calls('checkout_contact_info_submitted')).toEqual([]);
  });

  it('identifies the buyer from the billing address before the Order Completed of the order, priced before tax', () => {
    const [identify, track] = calls('checkout_completed');
    expect(identify).toEqual({
      call: 'identify',
      userId: 'jane@example.com',
      traits: {
        email: 'jane@example.com',
        firstName: 'Ann',
        lastName: 'Lee',
        city: 'Reno',
        state: 'NV',
        country: 'US',
        postalCode: '',
      },
    });
    expect(track).toEqual({
      call: 'track',
      name: 'Order Completed',
      properties: {
        checkout_id: SESSION,
        order_id: '1001',
        affiliation: 'Online Store',
        subtotal: 89,
        revenue: 89,
        total: 106.11,
        shipping: 9.99,
        tax: 7.12,
        currency: 'USD',
        products: [
          {
            product_id: 'EB-2',
            sku: 'EB-2',
            name: 'Earbuds',
            price: 44.5,
            quantity: 2,
            url: URL_,
            category: 'Olympus',
            brand: 'Olympus',
            position: 0,
            image_url: 'https://img.test/eb.png',
          },
        ],
        ...CONTEXT_PROPS,
      },
    });
  });

  it('identifies by the order id when the order has no email', () => {
    const { user: _, ...data } = EXAMPLES.checkout_completed.data;
    expect(calls('checkout_completed', data)[0]).toMatchObject({ call: 'identify', userId: '1001' });
    const { billing_address: __, ...anonymous } = data;
    expect(calls('checkout_completed', anonymous).map((c) => c.call)).toEqual(['track']);
  });

  it('sends an accepted upsell as an Order Completed of its own line', () => {
    expect(calls('upsell_completed').at(-1)).toEqual({
      call: 'track',
      name: 'Order Completed',
      properties: expect.objectContaining({
        order_id: 'R1-US1',
        affiliation: 'Upsell',
        subtotal: 20,
        total: 20,
        shipping: 0,
        tax: 0,
        products: [expect.objectContaining({ product_id: 'SKU-99', sku: 'SKU-99', name: 'Bump', price: 20 })],
      }),
    });
  });

  it('prices an order with its own line prices when the API order is not loaded', async () => {
    const { engine: bare } = makeEngine();
    await bare.start();
    const [, track] = rudderStackCalls(event('checkout_completed'), bare, OPTIONS);
    expect(track).toMatchObject({ name: 'Order Completed' });
    expect(track && 'properties' in track && track.properties).toMatchObject({
      subtotal: 96.12,
      shipping: 9.99,
      tax: 7.12,
      total: 113.23,
    });
  });

  it.each(['promotion_viewed', 'promotion_selected'] as const)('does not send %s', (type) => {
    expect(calls(type)).toEqual([]);
  });

  describe('parity with 0.4.x', () => {
    const tracked = (Object.keys(RUDDERSTACK) as TrackingName[]).filter(
      (name) => RUDDERSTACK[name] !== 'page' && RUDDERSTACK[name] !== 'identify',
    );

    it.each(tracked)('%s sends the properties 0.4.x built from its dl_* push', (name) => {
      const rudder = RUDDERSTACK[name]!;
      const push = { ...EXAMPLES[name].dataLayer, _metadata: { session_id: SESSION } };
      const track = calls(name).filter((c) => c.call === 'track');
      expect(track).toEqual([{ call: 'track', name: rudder, properties: legacy.build(push, rudder) }]);
    });

    it('page_viewed sends the calls 0.4.x made for its dl_page_view', () => {
      const push = {
        ...EXAMPLES.page_viewed.dataLayer,
        page: { title: 'Olympus Earbuds', url: URL_, path: '/', referrer: '' },
      };
      expect(calls('page_viewed')).toEqual(legacy.pagePlan(push));
    });
  });
});

describe('startRudderStack', () => {
  const win = window as Window & { rudderanalytics?: unknown; nextConfig?: unknown };
  afterEach(() => {
    delete win.rudderanalytics;
    delete win.nextConfig;
    document.head.innerHTML = '';
  });

  const sdk = () => ({ page: vi.fn(), track: vi.fn(), identify: vi.fn() });
  const quietEngine = () => {
    const { engine } = makeEngine();
    engine.log.level = 'silent';
    return engine;
  };
  const logged = (engine: Engine, level: string) => engine.log.entries().filter((e) => e.level === level);

  it('sends the events from before it started and each later one, once', () => {
    const ra = sdk();
    win.rudderanalytics = ra;
    const engine = quietEngine();
    engine.events.emit('analytics', event('page_viewed'));
    engine.events.emit('analytics', event('product_viewed'));
    startRudderStack(engine, OPTIONS);
    engine.events.emit('analytics', event('checkout_completed'));
    engine.events.emit('analytics', event('promotion_viewed'));

    expect(ra.page.mock.calls.map((c) => c.slice(0, 2))).toEqual([['product', 'Olympus Earbuds']]);
    expect(ra.track.mock.calls.map((c) => c[0])).toEqual(['Product Page View', 'Product Viewed', 'Order Completed']);
    expect(ra.identify.mock.calls.map((c) => c[0])).toEqual(['jane@example.com']);
    expect(ra.track.mock.calls[1]![1]).toMatchObject({ campaign_api_key: 'pk_test', product_id: '400' });
    expect(logged(engine, 'debug').filter((e) => e.message.startsWith('destination rudderstack'))).toEqual([
      expect.objectContaining({ message: 'destination rudderstack page Olympus Earbuds sent' }),
      expect.objectContaining({ message: 'destination rudderstack track Product Page View sent' }),
      expect.objectContaining({
        message: 'destination rudderstack track Product Viewed sent',
        data: {
          trace: 'destination',
          destination: 'rudderstack',
          name: 'Product Viewed',
          tracking: 'product_viewed',
          event_id: 'ev-product_viewed',
        },
      }),
      expect.objectContaining({ message: 'destination rudderstack identify sent' }),
      expect.objectContaining({ message: 'destination rudderstack track Order Completed sent' }),
    ]);
  });

  it('takes the page type and name from the 0.4.x meta tags, else nextConfig.pageType', () => {
    const ra = sdk();
    win.rudderanalytics = ra;
    document.head.innerHTML =
      '<meta name="next-page-type" content="checkout"><meta name="next-page-name" content="Pay">';
    const engine = quietEngine();
    startRudderStack(engine);
    engine.events.emit('analytics', event('page_viewed'));
    engine.events.emit('analytics', event('product_viewed'));
    expect(ra.page.mock.calls[0]!.slice(0, 2)).toEqual(['checkout', 'Pay']);
    expect(ra.track.mock.calls.map((c) => [c[0], c[1].page_type])).toEqual([
      ['Checkout Page View', undefined],
      ['Product Viewed', 'checkout'],
    ]);

    document.head.innerHTML = '';
    win.nextConfig = { pageType: 'upsell' };
    const other = quietEngine();
    startRudderStack(other);
    other.events.emit('analytics', event('page_viewed'));
    expect(ra.page.mock.calls[1]!.slice(0, 2)).toEqual(['upsell', 'Olympus Earbuds']);
  });

  it('waits for ready() while the SDK has not loaded', () => {
    let ready: () => void = () => {};
    win.rudderanalytics = { ready: (fn: () => void) => (ready = fn) };
    const engine = quietEngine();
    startRudderStack(engine);
    engine.events.emit('analytics', event('product_viewed'));
    const ra = sdk();
    win.rudderanalytics = ra;
    expect(ra.track).not.toHaveBeenCalled();
    ready();
    expect(ra.track.mock.calls.map((c) => c[0])).toEqual(['Product Viewed']);
    expect(logged(engine, 'warn')).toEqual([]);
  });

  it('warns once while the page has no rudderanalytics and sends once it appears', () => {
    const engine = quietEngine();
    startRudderStack(engine);
    engine.events.emit('analytics', event('product_viewed'));
    engine.events.emit('analytics', event('product_added_to_cart'));
    expect(logged(engine, 'warn').map((e) => e.message)).toEqual([expect.stringContaining('no rudderanalytics')]);

    const ra = sdk();
    win.rudderanalytics = ra;
    engine.events.emit('analytics', event('checkout_started'));
    expect(ra.track.mock.calls.map((c) => c[0])).toEqual(['Checkout Started']);
    expect(logged(engine, 'warn')).toHaveLength(1);
  });

  it('logs a failing call and keeps sending', () => {
    const ra = sdk();
    ra.identify.mockImplementationOnce(() => {
      throw new Error('blocked');
    });
    win.rudderanalytics = ra;
    const engine = quietEngine();
    startRudderStack(engine);
    engine.events.emit('analytics', event('checkout_completed'));
    engine.events.emit('analytics', event('product_viewed'));

    expect(ra.track.mock.calls.map((c) => c[0])).toEqual(['Order Completed', 'Product Viewed']);
    expect(logged(engine, 'error').map((e) => e.message)).toEqual(['RudderStack destination failed']);
  });

  it('sends Checkout Step Completed once per checkout, for the first of its address and method', () => {
    const ra = sdk();
    win.rudderanalytics = ra;
    const engine = quietEngine();
    engine.checkout = engine.attach((ctx) => createCheckout(ctx, engine.cart, fakeRules().api));
    startRudderStack(engine);
    engine.events.emit('analytics', event('checkout_shipping_address_submitted'));
    engine.events.emit('analytics', event('checkout_shipping_method_submitted'));
    engine.events.emit('analytics', event('checkout_payment_info_submitted'));
    expect(ra.track.mock.calls.map((c) => c[0])).toEqual(['Checkout Step Completed', 'Payment Info Entered']);
  });
});
