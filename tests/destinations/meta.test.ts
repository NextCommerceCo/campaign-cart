import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { metaEvent, startMeta } from '../../src/destinations/meta';
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

const EARBUDS = {
  content_ids: ['1'],
  contents: [{ id: '1', quantity: 1, item_price: 49 }],
  content_type: 'product',
  content_name: 'Earbuds ×1',
  value: 49,
};

describe('metaEvent', () => {
  it.each([
    ['product_viewed', 'ViewContent', { ...EARBUDS, currency: 'EUR' }],
    ['product_added_to_cart', 'AddToCart', { ...EARBUDS, currency: 'EUR' }],
    ['checkout_started', 'InitiateCheckout', { ...EARBUDS, currency: 'USD', num_items: 1 }],
    ['checkout_contact_info_submitted', 'Lead', { value: 49, currency: 'USD' }],
    ['checkout_payment_info_submitted', 'AddPaymentInfo', { ...EARBUDS, currency: 'USD' }],
  ] as const)('%s is %s', (type, name, params) => {
    expect(metaEvent(event(type))).toEqual({ name, params, event_id: `ev-${type}` });
  });

  it('sends an order as Purchase of what its lines cost, the same value as the GA4 purchase, without its upsell lines, under the order number', () => {
    expect(metaEvent(event('checkout_completed'))).toEqual({
      name: 'Purchase',
      params: {
        content_ids: ['EB-2'],
        contents: [{ id: 'EB-2', quantity: 2, item_price: 44.5 }],
        content_type: 'product',
        content_name: 'Earbuds',
        value: 89,
        currency: 'USD',
      },
      event_id: '1001',
    });
  });

  it('sends a purchase whose currency is unknown without one, never as USD', () => {
    const unknown = (type: 'checkout_completed' | 'upsell_completed') => {
      const e = event(type, { ...(EXAMPLES[type].data as object), currency: undefined });
      return { ...e, context: { ...e.context, campaign: undefined } } as TrackingEvent;
    };
    expect(metaEvent(unknown('checkout_completed'))?.params).not.toHaveProperty('currency');
  });

  it('sends an order line before tax', () => {
    const order = EXAMPLES.checkout_completed.data as { lines: object[] };
    const params = metaEvent(
      event('checkout_completed', { ...order, lines: [{ ...order.lines[0], tax: 6.12 }] }),
    )?.params;
    expect(params).toMatchObject({ contents: [{ id: 'EB-2', quantity: 2, item_price: 45 }], value: 90 });
  });

  it('ids the order Purchase as the store does when a store name is set', () => {
    expect(metaEvent(event('checkout_completed'), { storeName: 'shop' })?.event_id).toBe('shop-1001');
    const { number: _, ...unnumbered } = EXAMPLES.checkout_completed.data as { number: string };
    expect(metaEvent(event('checkout_completed', unnumbered), { storeName: 'shop' })?.event_id).toBe('shop-R1');
    expect(metaEvent(event('upsell_completed'), { storeName: 'shop' })?.event_id).toBe('R1-US1');
  });

  it('sends an accepted upsell as Purchase of its one line', () => {
    expect(metaEvent(event('upsell_completed'))).toEqual({
      name: 'Purchase',
      params: {
        content_ids: ['99'],
        contents: [{ id: '99', quantity: 1, item_price: 20 }],
        content_type: 'product',
        content_name: 'Bump',
        value: 20,
        currency: 'USD',
      },
      event_id: 'R1-US1',
    });
  });

  it('names no product and sums every line for a cart of several', () => {
    const data = EXAMPLES.checkout_started.data as { cart: { lines: object[] } };
    const lines = [
      ...data.cart.lines,
      { package_id: 2, sku: 'EB-2', quantity: 3, product_title: 'Earbuds ×2', price: 10 },
    ];
    const params = metaEvent(event('checkout_started', { ...data, cart: { ...data.cart, lines } }))?.params;
    expect(params).toMatchObject({ content_ids: ['1', 'EB-2'], value: 79, num_items: 4 });
    expect(params).not.toHaveProperty('content_name');
  });

  it('counts a cart line of a multi-unit package in units, keeping the value exact', () => {
    const data = EXAMPLES.checkout_started.data as { cart: { lines: object[] } };
    const lines = [{ package_id: 2, sku: 'EB-2', quantity: 2, product_title: 'Earbuds ×2', price: 10 }];
    const packages = { getPackage: (id: number) => (id === 2 ? ({ qty: 3 } as never) : undefined) };
    const params = metaEvent(
      event('checkout_started', { ...data, cart: { ...data.cart, lines } }),
      {},
      packages,
    )?.params;
    expect(params).toMatchObject({
      contents: [{ id: 'EB-2', quantity: 6, item_price: 3.33 }],
      value: 20,
      num_items: 6,
    });
  });

  it('leaves out what an unpriced line does not have', () => {
    const params = metaEvent(event('product_viewed', { package_id: 7, quantity: 1 }))?.params;
    expect(params).toEqual({
      content_ids: ['7'],
      contents: [{ id: '7', quantity: 1 }],
      content_type: 'product',
      currency: 'EUR',
    });
  });

  it('sends a page view as PageView without parameters, under the event id', () => {
    expect(metaEvent(event('page_viewed'))).toEqual({ name: 'PageView', params: {}, event_id: 'ev-page_viewed' });
  });

  it.each([
    'product_list_viewed',
    'product_removed_from_cart',
    'cart_updated',
    'checkout_shipping_address_submitted',
    'checkout_shipping_method_submitted',
    'upsell_viewed',
    'upsell_skipped',
    'promotion_viewed',
    'promotion_selected',
  ] as const)('does not send %s', (type) => {
    expect(metaEvent(event(type))).toBeUndefined();
  });
});

describe('startMeta', () => {
  const win = window as Window & { fbq?: unknown };
  afterEach(() => delete win.fbq);

  const quietEngine = () => {
    const { engine } = makeEngine();
    engine.log.level = 'silent';
    return engine;
  };
  const logged = (engine: ReturnType<typeof quietEngine>, level: string) =>
    engine.log.entries().filter((e) => e.level === level);

  it('sends the events from before it started and each later one, once', () => {
    const fbq = vi.fn();
    win.fbq = fbq;
    const engine = quietEngine();
    engine.events.emit('analytics', event('product_viewed'));
    engine.events.emit('analytics', event('page_viewed'));
    startMeta(engine, { storeName: 'shop' });
    engine.events.emit('analytics', event('checkout_completed'));

    expect(fbq.mock.calls).toEqual([
      ['track', 'ViewContent', metaEvent(event('product_viewed'))!.params, { eventID: 'ev-product_viewed' }],
      ['track', 'PageView', {}, { eventID: 'ev-page_viewed' }],
      ['track', 'Purchase', metaEvent(event('checkout_completed'))!.params, { eventID: 'shop-1001' }],
    ]);
    expect(logged(engine, 'debug').filter((e) => e.message.startsWith('destination meta'))).toEqual([
      expect.objectContaining({
        message: 'destination meta ViewContent sent',
        data: {
          trace: 'destination',
          destination: 'meta',
          name: 'ViewContent',
          tracking: 'product_viewed',
          event_id: 'ev-product_viewed',
          payload: { params: metaEvent(event('product_viewed'))!.params, eventID: 'ev-product_viewed' },
        },
      }),
      expect.objectContaining({ message: 'destination meta PageView sent' }),
      expect.objectContaining({
        message: 'destination meta Purchase sent',
        data: expect.objectContaining({
          event_id: '1001',
          payload: expect.objectContaining({ eventID: 'shop-1001' }),
        }),
      }),
    ]);
  });

  it('warns once while the page has no pixel and sends once it appears', () => {
    const engine = quietEngine();
    startMeta(engine);
    engine.events.emit('analytics', event('product_viewed'));
    engine.events.emit('analytics', event('product_added_to_cart'));
    expect(logged(engine, 'warn').map((e) => e.message)).toEqual([expect.stringContaining('no Meta Pixel (fbq)')]);

    const fbq = vi.fn();
    win.fbq = fbq;
    engine.events.emit('analytics', event('checkout_started'));
    expect(fbq.mock.calls.map((c) => c[1])).toEqual(['InitiateCheckout']);
    expect(logged(engine, 'warn')).toHaveLength(1);
  });

  it('logs a failing pixel and keeps sending', () => {
    const fbq = vi.fn().mockImplementationOnce(() => {
      throw new Error('blocked');
    });
    win.fbq = fbq;
    const engine = quietEngine();
    startMeta(engine);
    engine.events.emit('analytics', event('product_viewed'));
    engine.events.emit('analytics', event('product_added_to_cart'));

    expect(fbq).toHaveBeenCalledTimes(2);
    expect(logged(engine, 'error').map((e) => e.message)).toEqual(['Meta destination failed']);
  });
});
