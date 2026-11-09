import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GA4, ga4Event, startGa4 } from '../../src/destinations/ga4';
import { OBJECTS, type TrackingEvent, type TrackingName } from '../../src/engine/events/analytics';
import type { EventContext } from '../../src/engine/events/context';
import { makeEngine } from '../fixtures/engine';

const EXAMPLES = JSON.parse(readFileSync('docs/analytics-examples.json', 'utf8')) as Record<
  TrackingName,
  { data: unknown }
>;
const CONTEXT: EventContext = {
  page_location: 'https://shop.test/',
  page_title: 'Shop',
  page_referrer: '',
  campaign: { id: 1, name: 'Campaign', currency: 'EUR', language: 'en' },
  session_id: 's1',
  attribution: {},
  browser: { user_agent: 'test', language: 'en-US', device_type: 'desktop' },
};
const IDS: Partial<Record<TrackingName, string>> = { checkout_completed: '1001', upsell_completed: 'R1-US1' };

const event = (type: TrackingName, data: unknown = EXAMPLES[type].data) =>
  ({
    event_id: IDS[type] ?? `ev-${type}`,
    event_type: type,
    object: OBJECTS[type],
    data,
    created_at: '2026-01-01T00:00:00.000Z',
    session_id: 's1',
    sdk_version: '1.0.0',
    context: CONTEXT,
  }) as TrackingEvent;

const EARBUDS = { item_id: '1', item_name: 'Earbuds ×1', price: 49, discount: 50, quantity: 1, index: 0 };
const CART = { currency: 'USD', value: 49, items: [EARBUDS] };
const PROMOTION = { promotion_id: 'exit_intent', promotion_name: 'Exit offer', creative_name: 'exit-offer' };

const withCart = (type: TrackingName, { cart, ...change }: { cart?: object; payment_method?: string }) => {
  const data = EXAMPLES[type].data as { cart: object };
  return event(type, { ...data, ...change, cart: { ...data.cart, ...cart } });
};

const undefinedKeys = (value: unknown, path = ''): string[] =>
  value && typeof value === 'object'
    ? Object.entries(value).flatMap(([k, v]) => (v === undefined ? [`${path}${k}`] : undefinedKeys(v, `${path}${k}.`)))
    : [];

describe('ga4Event', () => {
  it.each([
    ['product_viewed', 'view_item', { currency: 'EUR', value: 49, items: [EARBUDS] }],
    ['product_added_to_cart', 'add_to_cart', { currency: 'EUR', value: 49, items: [EARBUDS] }],
    ['product_removed_from_cart', 'remove_from_cart', { currency: 'EUR', value: 49, items: [EARBUDS] }],
    ['cart_updated', 'update_cart', CART],
    ['checkout_started', 'begin_checkout', CART],
    ['checkout_contact_info_submitted', 'generate_lead', { currency: 'USD', value: 49, lead_source: 'checkout' }],
    ['checkout_shipping_address_submitted', 'add_shipping_info', { ...CART, shipping_tier: 'Standard' }],
    ['checkout_shipping_method_submitted', 'add_shipping_info', { ...CART, shipping_tier: 'Standard' }],
    ['checkout_payment_info_submitted', 'add_payment_info', { ...CART, payment_type: 'Credit Card' }],
    ['promotion_viewed', 'view_promotion', PROMOTION],
    ['promotion_selected', 'select_promotion', PROMOTION],
    ['upsell_viewed', 'view_upsell', { order_id: 'R1', currency: 'EUR', items: [] }],
    [
      'upsell_skipped',
      'skip_upsell',
      { order_id: 'R1', currency: 'EUR', items: [{ item_id: '3', quantity: 1, index: 0 }] },
    ],
  ] as const)('%s is %s', (type, name, params) => {
    expect(ga4Event(event(type))).toEqual({ name, params });
    expect(GA4[type]).toBe(name);
  });

  it('lists several products', () => {
    expect(ga4Event(event('product_list_viewed'))).toEqual({
      name: 'view_item_list',
      params: {
        currency: 'EUR',
        value: 138,
        items: [EARBUDS, { item_id: '2', item_name: 'Earbuds ×2', price: 89, discount: 109, quantity: 1, index: 1 }],
        item_list_id: 'product_list',
        item_list_name: 'Product List',
      },
    });
  });

  it('sends an order as purchase of its item revenue, with shipping and tax apart', () => {
    expect(ga4Event(event('checkout_completed'))).toEqual({
      name: 'purchase',
      params: {
        currency: 'USD',
        value: 89,
        items: [{ item_id: 'EB-2', item_name: 'Earbuds', price: 44.5, discount: 47.17, quantity: 2, index: 0 }],
        transaction_id: '1001',
        shipping: 9.99,
        tax: 7.12,
      },
    });
  });

  it('sends a purchase whose currency is unknown without one, never as USD', () => {
    const unknown = (type: 'checkout_completed' | 'upsell_completed') => {
      const e = event(type, { ...(EXAMPLES[type].data as object), currency: undefined });
      return { ...e, context: { ...e.context, campaign: undefined } } as TrackingEvent;
    };
    expect(ga4Event(unknown('checkout_completed'))?.params).not.toHaveProperty('currency');
    expect(ga4Event(unknown('upsell_completed'))?.params).not.toHaveProperty('currency');
  });

  it('sends an order line and shipping before tax', () => {
    const order = EXAMPLES.checkout_completed.data as { lines: object[] };
    const taxed = { ...order.lines[0], tax: 6.12 };
    const data = { ...order, lines: [taxed], shipping_method: { name: 'Express', price: 9.99, tax: 0.99 } };
    expect(ga4Event(event('checkout_completed', data))?.params).toMatchObject({
      value: 90,
      items: [{ item_id: 'EB-2', price: 45, discount: 47.7, quantity: 2 }],
      shipping: 9,
    });
  });

  it('sends an accepted upsell as a purchase of its one line', () => {
    const order = EXAMPLES.upsell_completed.data as object;
    expect(ga4Event(event('upsell_completed', { ...order, coupons: ['SAVE10'] }))).toEqual({
      name: 'purchase',
      params: {
        transaction_id: 'R1-US1',
        value: 20,
        currency: 'USD',
        items: [{ item_id: '99', item_name: 'Bump', price: 20, quantity: 1, index: 0 }],
      },
    });
  });

  it('sends the first coupon and a payment method other than a card as it is', () => {
    const params = ga4Event(
      withCart('checkout_payment_info_submitted', { payment_method: 'paypal', cart: { coupons: ['SAVE10', 'VIP'] } }),
    )?.params;
    expect(params).toMatchObject({ coupon: 'SAVE10', payment_type: 'paypal' });
  });

  it('counts a cart line of a multi-unit package in units, as purchase lines are, keeping the value exact', () => {
    const line = { package_id: 2, quantity: 1, product_title: 'Earbuds ×2', price: 10, original_price: 20 };
    const packages = { getPackage: (id: number) => (id === 2 ? ({ qty: 3 } as never) : undefined) };
    expect(ga4Event(event('product_added_to_cart', line), packages)?.params).toEqual({
      currency: 'EUR',
      value: 10,
      items: [{ item_id: '2', item_name: 'Earbuds ×2', price: 3.33, discount: 3.34, quantity: 3, index: 0 }],
    });
  });

  it('does not send page_viewed: the Google tag sends its own', () => {
    expect(ga4Event(event('page_viewed'))).toBeUndefined();
  });

  it('never sends a key without a value', () => {
    const types = Object.keys(EXAMPLES) as TrackingName[];
    const unpriced = event('product_viewed', { package_id: 7, quantity: 1 });
    expect(ga4Event(unpriced)?.params).toEqual({ currency: 'EUR', items: [{ item_id: '7', quantity: 1, index: 0 }] });
    expect([...types.map((t) => ga4Event(event(t))), ga4Event(unpriced)].flatMap((e) => undefinedKeys(e))).toEqual([]);
  });
});

describe('startGa4', () => {
  const win = window as Window & { gtag?: unknown };
  afterEach(() => delete win.gtag);

  const quietEngine = () => {
    const { engine } = makeEngine();
    engine.log.level = 'silent';
    return engine;
  };
  const logged = (engine: ReturnType<typeof quietEngine>, level: string) =>
    engine.log.entries().filter((e) => e.level === level);

  it('sends the events from before it started and each later one, once', () => {
    const gtag = vi.fn();
    win.gtag = gtag;
    const engine = quietEngine();
    engine.events.emit('analytics', event('product_viewed'));
    engine.events.emit('analytics', event('page_viewed'));
    startGa4(engine);
    engine.events.emit('analytics', event('checkout_completed'));

    expect(gtag.mock.calls).toEqual([
      ['event', 'view_item', ga4Event(event('product_viewed'))!.params],
      ['event', 'purchase', ga4Event(event('checkout_completed'))!.params],
    ]);
    expect(logged(engine, 'debug').filter((e) => e.message.startsWith('destination ga4'))).toEqual([
      expect.objectContaining({
        message: 'destination ga4 view_item sent',
        data: {
          trace: 'destination',
          destination: 'ga4',
          name: 'view_item',
          tracking: 'product_viewed',
          event_id: 'ev-product_viewed',
          payload: ga4Event(event('product_viewed'))!.params,
        },
      }),
      expect.objectContaining({ message: 'destination ga4 purchase sent' }),
    ]);
  });

  it('warns once while the page has no Google tag and sends once it appears', () => {
    const engine = quietEngine();
    startGa4(engine);
    engine.events.emit('analytics', event('product_viewed'));
    engine.events.emit('analytics', event('product_added_to_cart'));
    expect(logged(engine, 'warn').map((e) => e.message)).toEqual([expect.stringContaining('no Google tag (gtag)')]);

    const gtag = vi.fn();
    win.gtag = gtag;
    engine.events.emit('analytics', event('checkout_started'));
    expect(gtag.mock.calls.map((c) => c[1])).toEqual(['begin_checkout']);
    expect(logged(engine, 'warn')).toHaveLength(1);
  });

  it('logs a failing tag and keeps sending', () => {
    const gtag = vi.fn().mockImplementationOnce(() => {
      throw new Error('blocked');
    });
    win.gtag = gtag;
    const engine = quietEngine();
    startGa4(engine);
    engine.events.emit('analytics', event('product_viewed'));
    engine.events.emit('analytics', event('product_added_to_cart'));

    expect(gtag).toHaveBeenCalledTimes(2);
    expect(logged(engine, 'error').map((e) => e.message)).toEqual(['GA4 destination failed']);
  });
});
