import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startAnalytics } from '../../src/analytics';
import { exitIntent } from '../../src/compat/exit-intent';
import { createCheckout } from '../../src/checkout/state/checkout';
import type { Engine } from '../../src/engine/engine';
import type { AnalyticsTrace, TrackingEvent } from '../../src/engine/events/analytics';
import type { Address } from '../../src/engine/events/checkout';
import type { Promotion } from '../../src/engine/events/promotions';
import { publicOrder, purchaseId, REPORTED } from '../../src/engine/order';
import type { ApiOrder } from '../../src/engine/types';
import { upsellId } from '../../src/engine/order';
import { createOrder, type OrderState } from '../../src/order/state';
import { fakeApi, json } from '../fixtures/api';
import { campaign } from '../fixtures/campaign';
import { flush, makeEngine } from '../fixtures/engine';
import { ORDER, withUpsell } from '../fixtures/order';
import { fakeRules } from '../fixtures/rules';
import { MemoryStorage } from '../fixtures/storage';

type Win = Window & {
  NextDataLayer?: any[];
  dataLayer?: any[];
  NextDataLayerTransformFn?: unknown;
  nextCampaign?: unknown;
};
const win = window as Win;
const options = { apiKey: 'pk_test', version: '1.0.0', nextCampaign: false };
const names = () => (win.NextDataLayer ?? []).map((e) => e.event);
const SHIPPING: Address & { type: 'shipping' } = {
  first_name: 'Jane',
  last_name: 'Doe',
  line1: '1 Main St',
  country: 'US',
  type: 'shipping',
};
const EXIT: Promotion = { id: 'exit_intent', type: 'exit_intent', creative: 'https://cdn.test/exit.png' };

function startCheckout(engine: Engine) {
  engine.checkout = engine.attach((ctx) => createCheckout(ctx, engine.cart, fakeRules().api));
  engine.checkout.begin();
  return engine.checkout;
}

const submitted = (engine: Engine, payment_method = 'card_token') =>
  engine.events.emit('checkout.submitted', {
    ...engine.cart.currentCheckout(),
    payment_method,
  });

async function loadOrder(order: ApiOrder, opts: { local?: Storage; coupon?: OrderState['coupon'] } = {}) {
  const { engine } = makeEngine({ local: opts.local, fetch: fakeApi({ getOrder: () => json(order) }).fetch });
  await engine.start();
  engine.order = engine.attach((ctx) => createOrder(ctx, engine.cart));
  engine.attach((ctx) => ctx.update('order', { coupon: opts.coupon }));
  await engine.order.load(order.ref_id);
  return engine;
}

async function ready(html = '', params: Record<string, string> = {}, before?: (engine: Engine) => void) {
  document.body.innerHTML = html;
  const { engine } = makeEngine({
    params,
    visit: { landingPage: 'https://shop.test/lp', referrer: '', device: 'UA', deviceType: 'desktop' },
  });
  before?.(engine);
  await engine.start();
  return engine;
}

beforeEach(() => {
  delete win.NextDataLayer;
  delete win.dataLayer;
  delete win.NextDataLayerTransformFn;
  delete win.nextCampaign;
});

afterEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

describe('analytics', () => {
  it('sends dl_user_data on ready with the old envelope and no personal data', async () => {
    const engine = await ready('', { utm_source: 'fb', email: 'jane@x.com' });
    startAnalytics(engine, options);
    const [event] = win.NextDataLayer!;
    expect(event).toMatchObject({
      event: 'dl_user_data',
      user_properties: { visitor_type: 'guest' },
      campaign_id: '1310',
      campaign_name: 'Olympus',
      campaign_currency: 'USD',
      campaign_language: 'en',
      campaign_api_key: 'pk_test',
      campaign_session_id: expect.stringMatching(/^[0-9a-f]{32}$/),
      cart_total: '0',
      ecommerce: { currency: 'USD', value: 0, items: [] },
      attribution: { utm_source: 'fb', funnel: 'Olympus' },
    });
    expect(event.event_id).toMatch(/^[0-9a-f]{32}$/);
    expect(event).not.toHaveProperty('session_id');
    expect(JSON.stringify(event)).not.toContain('jane@x.com');
    expect(win.dataLayer).toEqual([{ ecommerce: null }, event]);
  });

  it('leaves dataLayer alone when the page turned the GTM provider off, like 0.4.x', async () => {
    const engine = await ready();
    startAnalytics(engine, { ...options, legacy: { dataLayer: false, meta: false } });
    expect(names()).toEqual(['dl_user_data']);
    expect(win.dataLayer).toBeUndefined();
  });

  it('replays ready when it attaches late, and reports what the page shows', async () => {
    const engine = await ready(
      `<div data-next-package-id="1"></div><div data-next-package-id="9"></div><div data-next-package-id="1"></div>`,
    );
    startAnalytics(engine, options);
    expect(names()).toEqual(['dl_user_data', 'dl_view_item_list']);
    expect(win.NextDataLayer![1].ecommerce.items.map((i: any) => i.item_id)).toEqual(['11', '19']);
  });

  it('honours NextDataLayerTransformFn, including a forwarder-style accessor', async () => {
    const engine = await ready(`<div data-next-package-id="2"></div>`);
    const seen: string[] = [];
    Object.defineProperty(win, 'NextDataLayerTransformFn', {
      configurable: true,
      get: () => (e: any) => {
        seen.push(e.event);
        return e.event === 'dl_user_data' ? null : { ...e, forwarded: true };
      },
    });
    startAnalytics(engine, options);
    expect(seen).toEqual(['dl_user_data', 'dl_view_item']);
    expect(win.NextDataLayer).toHaveLength(1);
    expect(win.NextDataLayer![0]).toMatchObject({
      event: 'dl_view_item',
      forwarded: true,
      ecommerce: { items: [{ item_id: '12', price: 44.5, quantity: 2 }] },
    });
    delete win.NextDataLayerTransformFn;
  });

  it('turns cart changes into add and remove events, a bundle change into both, never a swap', async () => {
    const engine = await ready('', {}, (e) => {
      void e.cart.setGroup('bundle:main', { lines: [{ packageId: 1, quantity: 1 }], vouchers: [] });
    });
    const error = vi.spyOn(console, 'error');
    startAnalytics(engine, options);
    await flush();
    await engine.cart.setGroup('toggle:9', { lines: [{ packageId: 9, quantity: 1 }], vouchers: [] });
    await engine.cart.setGroup('bundle:main', { lines: [{ packageId: 2, quantity: 1 }], vouchers: [] });
    await engine.cart.setGroup('toggle:9', null);
    await flush();
    expect(names()).toEqual([
      'dl_user_data',
      'dl_add_to_cart',
      'dl_cart_updated',
      'dl_add_to_cart',
      'dl_cart_updated',
      'dl_remove_from_cart',
      'dl_add_to_cart',
      'dl_cart_updated',
      'dl_remove_from_cart',
      'dl_cart_updated',
    ]);
    const events = (name: string) => win.NextDataLayer!.filter((e) => e.event === name);
    expect(events('dl_add_to_cart').map((e) => [e.ecommerce.items[0].item_id, e.first_in_session])).toEqual([
      ['11', true],
      ['19', false],
      ['12', false],
    ]);
    const [removedBundle] = events('dl_remove_from_cart');
    expect(removedBundle.ecommerce).toEqual(events('dl_add_to_cart')[0].ecommerce);
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('sends add_to_cart at the cart price for a cart filled before ready, such as a forced cart', async () => {
    const engine = await ready('', { forcePackageId: '2' });
    startAnalytics(engine, options);
    await flush();
    expect(names()).toEqual(['dl_user_data', 'dl_add_to_cart', 'dl_cart_updated']);
    expect(win.NextDataLayer![0].ecommerce.items).toMatchObject([{ item_id: '12' }]);
    const [, add, updated] = win.NextDataLayer!;
    expect(add).toMatchObject({ first_in_session: true, ecommerce: { currency: 'USD', value: 89 } });
    expect(add.ecommerce.items).toEqual(updated.ecommerce.items);
    expect(updated.ecommerce.items).toEqual([
      expect.objectContaining({ item_id: '12', item_product_id: '400', price: 44.5, discount: 54.5, quantity: 2 }),
    ]);
  });

  it('sends add_to_cart for the ?forceBundleId card, not the preferred one', async () => {
    const cards = [
      { id: '1x', lines: [{ packageId: 1, quantity: 1 }], vouchers: [] },
      { id: '3x', lines: [{ packageId: 1, quantity: 3 }], vouchers: [] },
    ];
    const engine = await ready('', { forceBundleId: '3x' }, (e) => {
      void e.selectors.register('main', cards, 'swap', '1x');
    });
    startAnalytics(engine, options);
    await flush();
    const add = win.NextDataLayer!.find((e) => e.event === 'dl_add_to_cart');
    expect(add).toMatchObject({ first_in_session: true, ecommerce: { items: [{ item_id: '11' }] } });
    const updated = win.NextDataLayer!.find((e) => e.event === 'dl_cart_updated');
    expect(add.ecommerce.items).toEqual(updated.ecommerce.items);
    expect(engine.cart.lines()).toEqual([{ package_id: 1, quantity: 3 }]);
  });

  it('sends the add on the next page when the page that filled the cart left before analytics ran', async () => {
    const session = new MemoryStorage();
    const page = async (fill?: (engine: Engine) => Promise<void>, analytics = true) => {
      delete win.NextDataLayer;
      const { engine } = makeEngine({ session });
      await engine.start();
      if (analytics) startAnalytics(engine, options);
      await fill?.(engine);
      await flush();
      return names();
    };
    await page((e) => e.cart.addItem(2), false);
    expect(await page()).toEqual(['dl_user_data', 'dl_add_to_cart', 'dl_cart_updated']);
    expect(win.NextDataLayer![1].first_in_session).toBe(true);
    expect(await page()).toEqual(['dl_user_data', 'dl_cart_updated']);
    expect(await page((e) => e.cart.addItem(9))).toEqual(['dl_user_data', 'dl_add_to_cart', 'dl_cart_updated']);
    expect(win.NextDataLayer![1]).toMatchObject({ first_in_session: false, ecommerce: { items: [{ item_id: '19' }] } });
  });

  it('reports an emptied cart as removed, at the price it was added', async () => {
    const engine = await ready('', { forcePackageId: '2' });
    startAnalytics(engine, options);
    await flush();
    await engine.cart.clear();
    await flush();
    const add = win.NextDataLayer!.find((e) => e.event === 'dl_add_to_cart');
    const removed = win.NextDataLayer!.at(-1);
    expect(removed).toMatchObject({ event: 'dl_remove_from_cart' });
    expect(removed.ecommerce).toEqual(add.ecommerce);
  });

  it('reports checkout steps in the 0.4.x shape', async () => {
    const engine = await ready('', {}, (e) => void e.cart.addItem(2));
    startAnalytics(engine, options);
    await flush();
    startCheckout(engine);
    engine.events.emit('address.entered', SHIPPING);
    submitted(engine);
    const [begin, shipping, payment] = win.NextDataLayer!.slice(-3);
    expect(begin).toMatchObject({ event: 'dl_begin_checkout', cart_total: '89.00', ecommerce: { value: 89 } });
    expect(shipping).toMatchObject({
      event: 'dl_add_shipping_info',
      shipping_tier: 'Standard',
      event_value: 89,
      ecommerce: { currencyCode: 'USD', shipping_tier: 'Standard' },
    });
    expect(payment).toMatchObject({ event: 'dl_add_payment_info', payment_type: 'Credit Card' });
  });

  it('sends begin_checkout, add_shipping_info and add_payment_info once per checkout, across its pages', async () => {
    const session = new MemoryStorage();
    const steps = ['dl_begin_checkout', 'dl_add_shipping_info', 'dl_add_payment_info'];
    const page = async (fill?: (engine: Engine) => Promise<void>) => {
      delete win.NextDataLayer;
      const { engine } = makeEngine({ session });
      await engine.start();
      await fill?.(engine);
      startAnalytics(engine, options);
      startCheckout(engine);
      await flush();
      engine.events.emit('address.entered', SHIPPING);
      submitted(engine, 'paypal');
      return { engine, sent: names().filter((n) => steps.includes(n)) };
    };
    expect((await page((e) => e.cart.addItem(2))).sent).toEqual(steps);
    const back = await page();
    expect(back.sent).toEqual([]);
    expect(
      back.engine.log
        .entries()
        .map((e) => e.data as AnalyticsTrace | undefined)
        .filter((d) => d?.trace === 'analytics' && !d.sent && d.name.endsWith('_submitted'))
        .map((d) => [d!.name, d!.reason]),
    ).toEqual([
      ['checkout_shipping_address_submitted', 'Already sent for this checkout'],
      ['checkout_payment_info_submitted', 'Already sent for this checkout'],
    ]);
    back.engine.attach((ctx) => ctx.forget('checkout'));
    expect((await page()).sent).toEqual(steps);
  });

  it('sends begin_checkout on a later page when the page that started the checkout was left first', async () => {
    const session = new MemoryStorage();
    const first = makeEngine({ session }).engine;
    await first.start();
    await first.cart.addItem(2);
    startCheckout(first);
    await flush();
    expect(first.getState().checkout?.id).toBeTruthy();

    delete win.NextDataLayer;
    const { engine } = makeEngine({ session });
    await engine.start();
    startCheckout(engine);
    startAnalytics(engine, options);
    await flush();
    expect(names().filter((n) => n === 'dl_begin_checkout')).toHaveLength(1);
    startAnalytics(engine, options);
    await flush();
    expect(names().filter((n) => n === 'dl_begin_checkout')).toHaveLength(1);
  });

  it('names the shipping method the cart was priced with on add_shipping_info', async () => {
    const api = fakeApi();
    const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await api.fetch(input, init);
      if (JSON.parse(String(init?.body ?? '{}')).shipping_method !== 2) return response;
      const express = { id: 2, name: 'Express', code: 'express', price: '9.99', original_price: '9.99' };
      return json({ ...(await response.json()), shipping_method: express });
    }) as typeof globalThis.fetch;
    const methods = [...campaign.shipping_methods, { ref_id: 2, code: 'express', price: '9.99' }];
    const { engine } = makeEngine({ fetch, campaign: Promise.resolve({ ...campaign, shipping_methods: methods }) });
    await engine.start();
    await engine.cart.addItem(2);
    startAnalytics(engine, options);
    startCheckout(engine);
    await engine.cart.setShipping(2);
    await flush();
    expect(win.NextDataLayer!.find((e) => e.event === 'dl_add_shipping_info')).toMatchObject({
      shipping_tier: 'Express',
      ecommerce: { shipping: 9.99, shipping_tier: 'Express' },
    });
  });

  it('names the coupon and the shipping cost on cart-level events, like 0.4.x', async () => {
    const engine = await ready('', {}, (e) => void e.cart.addItem(2));
    startAnalytics(engine, options);
    await flush();
    await engine.cart.applyCoupon('SAVE10');
    await flush();
    engine.events.emit('checkout.started', engine.cart.currentCheckout());
    const updated = win.NextDataLayer!.filter((e) => e.event === 'dl_cart_updated').at(-1);
    const begin = win.NextDataLayer!.at(-1);
    expect(updated.ecommerce).toMatchObject({ coupon: 'SAVE10', shipping: 0 });
    expect(updated.cart).toEqual({
      currency: 'USD',
      items: [{ package_id: 2, quantity: 1, price: 89 }],
      total_items: 1,
      total_value: 89,
    });
    expect(begin.ecommerce).toMatchObject({ coupon: 'SAVE10', shipping: 0 });
  });

  it('fills purchase items from the campaign package and names the coupon, like 0.4.x', async () => {
    const order = {
      ...ORDER,
      lines: [
        {
          id: 31,
          package: 9,
          product_title: 'Protection plan',
          quantity: 1,
          price_excl_tax: '9.00',
          price_incl_tax: '9.00',
          is_upsell: false,
        },
      ],
    };
    const engine = await loadOrder(order, { coupon: { refId: 'R1', code: 'SAVE10', codes: ['SAVE10'] } });
    startAnalytics(engine, options);
    const purchase = win.NextDataLayer!.find((e) => e.event === 'dl_purchase')!;
    expect(purchase.ecommerce.coupon).toBe('SAVE10');
    expect(purchase.ecommerce.items[0]).toMatchObject({
      item_id: 'SKU-31',
      item_brand: 'Olympus',
      item_product_id: '900',
      item_image: 'https://cdn.test/9.png',
    });
  });

  it('builds checkout_completed from the paid order in state, keyed by the order number, with the codes it was paid with', async () => {
    const engine = await loadOrder(ORDER, { coupon: { refId: 'R1', code: 'CARD5', codes: ['SAVE10'] } });
    const seen: TrackingEvent[] = [];
    engine.on('analytics', (e) => void seen.push(e.data));
    startAnalytics(engine, options);
    const completed = seen.find((e) => e.event_type === 'checkout_completed')!;
    expect(completed).toMatchObject({ event_id: '1001', object: 'order' });
    expect(completed.data).toEqual(publicOrder(ORDER, ['SAVE10']));
    expect(completed.data).toMatchObject({
      ref_id: 'R1',
      number: '1001',
      currency: 'USD',
      paid: true,
      total: 106.11,
      tax: 7.12,
      shipping_method: { name: 'Express', price: 9.99 },
      coupons: ['SAVE10'],
      lines: [expect.objectContaining({ sku: 'EB-2', price: 48.06, original_price: 99, quantity: 2, upsell: false })],
    });
    delete win.NextDataLayer;
    const other = await loadOrder(
      { ...ORDER, ref_id: 'R2', number: 1002 },
      { coupon: { refId: 'R1', code: 'CARD5', codes: [] } },
    );
    startAnalytics(other, options);
    expect(win.NextDataLayer!.find((e) => e.event === 'dl_purchase')!.ecommerce).not.toHaveProperty('coupon');
  });

  it('builds checkout_completed from the order as it was paid, when an upsell was accepted before analytics loaded', async () => {
    const engine = await loadOrder(ORDER);
    const upsold: ApiOrder = {
      ...withUpsell(ORDER, 99, 1),
      total_tax: '9.00',
      total_discounts: '5.00',
      shipping_excl_tax: '0.00',
      shipping_incl_tax: '0.00',
    };
    engine.attach((ctx) => ctx.update('order', { order: upsold }));
    const seen: TrackingEvent[] = [];
    engine.on('analytics', (e) => void seen.push(e.data));
    startAnalytics(engine, options);
    const order = seen.find((e) => e.event_type === 'checkout_completed')!.data;
    expect(order).toMatchObject({ total: 106.11, tax: 7.12, total_discount: 0, shipping_method: { price: 9.99 } });
    expect(order.lines.map((l) => l.upsell)).toEqual([false]);
  });

  it('sends no purchase for a paid order other than the one in state', async () => {
    const engine = await ready();
    startAnalytics(engine, options);
    engine.events.emit('order.paid', publicOrder(ORDER));
    expect(names()).not.toContain('dl_purchase');
  });

  it('sends purchase on the checkout for an order paid at once, and not again on the page after', async () => {
    const local = new MemoryStorage();
    const { engine } = makeEngine({ local });
    await engine.start();
    startAnalytics(engine, options);
    engine.attach((ctx) => {
      ctx.update('order', { paidOrder: ORDER });
      ctx.local.set(REPORTED, [purchaseId(ORDER)]);
    });
    engine.events.emit('order.created', publicOrder(ORDER));
    engine.events.emit('order.paid', publicOrder(ORDER));
    expect(names().filter((n) => n === 'dl_purchase')).toHaveLength(1);

    delete win.NextDataLayer;
    const after = await loadOrder(ORDER, { local });
    startAnalytics(after, options);
    expect(names()).not.toContain('dl_purchase');
  });

  it('sends purchase on the page after when the checkout that paid the order was left before it was sent', async () => {
    const local = new MemoryStorage();
    const { engine: checkout } = makeEngine({ local });
    checkout.attach((ctx) => ctx.local.set(REPORTED, [purchaseId(ORDER)]));
    const traces: AnalyticsTrace[] = [];
    const page = async () => {
      delete win.NextDataLayer;
      const engine = await loadOrder(ORDER, { local });
      vi.spyOn(engine.log, 'debug').mockImplementation((_, data) => void traces.push(data as AnalyticsTrace));
      startAnalytics(engine, options);
      return engine;
    };
    const first = await page();
    expect(first.getState().order?.paidOrder).toBeUndefined();
    expect(win.NextDataLayer!.filter((e) => e.event === 'dl_purchase')).toMatchObject([
      { event_id: '1001', ecommerce: { transaction_id: '1001', value: 89 } },
    ]);
    expect(traces.find((t) => t.name === 'checkout_completed' && t.sent)).toMatchObject({ trigger: 'order.loaded' });
    await page();
    expect(names()).not.toContain('dl_purchase');
  });

  it('sends no remove_from_cart when the cart is emptied after a paid order', async () => {
    const session = new MemoryStorage();
    const { engine } = makeEngine({ session, params: { forcePackageId: '2' } });
    await engine.start();
    startAnalytics(engine, options);
    await flush();
    expect(names()).toContain('dl_add_to_cart');
    engine.cart.clearAfterOrder();
    await flush();
    const { engine: next } = makeEngine({ session });
    await next.start();
    startAnalytics(next, options);
    await flush();
    expect(names()).not.toContain('dl_remove_from_cart');
  });

  it('reports a paid order and its upsells once, in the 0.4.x shape, without personal data', async () => {
    const local = new MemoryStorage();
    const run = async () => {
      delete win.NextDataLayer;
      const fetch = fakeApi({ getOrder: () => json(withUpsell(ORDER, 99, 1)) }).fetch;
      const { engine } = makeEngine({ local, fetch });
      await engine.start();
      engine.order = engine.attach((ctx) => createOrder(ctx, engine.cart));
      await engine.order.load('R1');
      startAnalytics(engine, options);
      return names();
    };
    expect(await run()).toEqual(['dl_user_data', 'dl_upsell_purchase', 'dl_purchase']);
    const [, upsell, purchase] = win.NextDataLayer!;
    expect(purchase.event_id).toBe('1001');
    expect(upsell.event_id).toBe('R1-US1');
    expect(purchase.ecommerce).toMatchObject({
      transaction_id: '1001',
      value: 89,
      tax: 7.12,
      shipping: 9.99,
      affiliation: 'Online Store',
      items: [{ item_id: 'EB-2', item_name: 'Earbuds', price: 44.5, quantity: 2 }],
    });
    expect(upsell).toMatchObject({
      ecommerce: { transaction_id: 'R1-US1', affiliation: 'Upsell', value: 20 },
      upsell_metadata: { original_order_id: 'R1', upsell_number: 1 },
    });
    expect(JSON.stringify(purchase)).not.toContain('jane@example.com');
    expect(await run()).toEqual(['dl_user_data']);
  });

  it('prices a VAT-inclusive order the way its packages are listed', async () => {
    const vat = {
      ...ORDER,
      lines: [
        {
          id: 21,
          package: 1,
          product_title: 'Earbuds',
          quantity: 1,
          price_incl_tax: '49.00',
          price_excl_tax: '40.83',
          price_incl_tax_excl_discounts: '49.00',
          price_excl_tax_excl_discounts: '40.83',
        },
      ],
      shipping_incl_tax: '6.00',
      shipping_excl_tax: '5.00',
    };
    const { engine } = makeEngine({ fetch: fakeApi({ getOrder: () => json(vat) }).fetch });
    await engine.start();
    engine.order = engine.attach((ctx) => createOrder(ctx, engine.cart));
    await engine.order.load('R9');
    startAnalytics(engine, options);
    const purchase = win.NextDataLayer!.find((e) => e.event === 'dl_purchase')!;
    expect(purchase.ecommerce).toMatchObject({ value: 49, shipping: 6, items: [{ price: 49 }] });
  });

  it('keeps addresses out of events, even in the landing page and referrer', async () => {
    const { engine } = makeEngine({
      visit: {
        landingPage: 'https://shop.test/lp?email=jane@example.com',
        referrer: 'https://mail.test/open?to=jane@example.com',
        device: 'UA',
        deviceType: 'mobile',
      },
    });
    await engine.start();
    startAnalytics(engine, options);
    const [event] = win.NextDataLayer!;
    expect(event.attribution.metadata.landing_page).toBe('https://shop.test/lp');
    expect(JSON.stringify(win.NextDataLayer)).not.toContain('jane@example.com');
  });

  it('reports upsell views and skips', async () => {
    const engine = await ready();
    startAnalytics(engine, options);
    engine.events.emit('upsell.viewed', { ref_id: 'R1', page: '/up/', lines: [] });
    engine.events.emit('upsell.skipped', { ref_id: 'R1', page: '/up/', lines: [] });
    engine.events.emit('upsell.skipped', { ref_id: 'R1', page: '/up/', lines: [{ package_id: 3, quantity: 1 }] });
    expect(win.NextDataLayer!.slice(-3)).toMatchObject([
      { event: 'dl_viewed_upsell', order_id: 'R1', page_path: '/up/' },
      { event: 'dl_skipped_upsell', order_id: 'R1', upsell: { package_id: 'unknown' } },
      { event: 'dl_skipped_upsell', upsell: { package_id: '3', package_name: 'Earbuds case' } },
    ]);
  });

  it('sends dl_viewed_upsell once per upsell page, as 0.4.x did, when the page shows several offers', async () => {
    const engine = await ready();
    startAnalytics(engine, options);
    engine.events.emit('upsell.viewed', { ref_id: 'R1', page: '/up/', selector_id: 'a', lines: [] });
    engine.events.emit('upsell.viewed', { ref_id: 'R1', page: '/up/', selector_id: 'b', lines: [] });
    expect(names().filter((n) => n === 'dl_viewed_upsell')).toHaveLength(1);
  });

  it('reports each accepted upsell once per browser, numbered by its place among the order upsells', async () => {
    const local = new MemoryStorage();
    const run = async (order: ApiOrder) => {
      delete win.NextDataLayer;
      const engine = await loadOrder(order, { local });
      startAnalytics(engine, options);
      const sent = win.NextDataLayer!.filter((e) => e.event === 'dl_upsell_purchase').map((e) => e.event_id);
      return { engine, sent };
    };
    const one = withUpsell(ORDER, 99, 1);
    const first = await run(one);
    expect(first.sent).toEqual(['R1-US1']);
    expect(first.engine.order!.reported()).toEqual(['1001', upsellId(one, one.lines!.at(-1)!), 'purchase:1001']);
    const two = withUpsell(one, 100, 2);
    expect((await run(two)).sent).toEqual(['R1-US2']);
    expect((await run(two)).sent).toEqual([]);
  });

  describe('exit-intent popup (0.4.x data layer)', () => {
    const leave = () => document.dispatchEvent(new MouseEvent('mouseout', { clientY: -1, relatedTarget: null }));
    const click = (selector: string) => document.querySelector<HTMLElement>(selector)!.click();
    const TEMPLATE = `<template data-template="exit"><button data-exit-intent-action="apply-coupon" data-coupon-code="EXIT10">Apply</button><button data-exit-intent-action="custom">Go</button></template>`;
    const exits = () => win.NextDataLayer!.filter((e) => e.event.startsWith('dl_exit_intent_'));

    beforeEach(() => vi.stubGlobal('matchMedia', () => ({ matches: false })));
    afterEach(() => vi.unstubAllGlobals());

    it('names the image, and the template of a template popup, as 0.4.43 did', async () => {
      const engine = await ready(TEMPLATE);
      startAnalytics(engine, options);
      const stop = exitIntent(engine, { id: 'image', image: EXIT.creative });
      leave();
      click('.exit-intent-popup img');
      await flush();
      stop();
      exitIntent(engine, { id: 'both', image: EXIT.creative, template: 'exit', maxTriggers: 3 });
      leave();
      click('[data-exit-intent-action="apply-coupon"]');
      await flush();
      leave();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      const image = { event_label: EXIT.creative, exit_intent: { image_url: EXIT.creative, template: '' } };
      const both = { event_label: EXIT.creative, exit_intent: { image_url: EXIT.creative, template: 'exit' } };
      expect(exits()).toMatchObject([
        { event: 'dl_exit_intent_shown', event_category: 'engagement', ...image },
        { event: 'dl_exit_intent_accepted', event_action: 'exit_intent_accepted', ...image },
        { event: 'dl_exit_intent_shown', ...both },
        {
          event: 'dl_exit_intent_action',
          event_action: 'exit_intent_apply-coupon',
          event_label: 'EXIT10',
          exit_intent: { action: 'apply-coupon', coupon_code: 'EXIT10' },
        },
        { event: 'dl_exit_intent_shown', ...both },
        { event: 'dl_exit_intent_dismissed', event_action: 'exit_intent_dismissed', ...both },
      ]);
    });

    it('sends a custom button’s dl_exit_intent_action once its action has run, as 0.4.43 did', async () => {
      const engine = await ready(TEMPLATE);
      startAnalytics(engine, options);
      let finish!: () => void;
      const action = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
      exitIntent(engine, { template: 'exit', action });
      leave();
      click('[data-exit-intent-action="custom"]');
      expect(action).toHaveBeenCalled();
      expect(exits().map((e) => e.event)).toEqual(['dl_exit_intent_shown']);
      finish();
      await flush();
      expect(exits().slice(1)).toMatchObject([
        {
          event: 'dl_exit_intent_action',
          event_action: 'exit_intent_custom',
          event_label: 'custom',
          exit_intent: { action: 'custom', coupon_code: '' },
        },
      ]);
    });

    it('sends a custom button’s dl_exit_intent_action when its action removes the popup', async () => {
      const engine = await ready(TEMPLATE);
      startAnalytics(engine, options);
      const remove: () => void = exitIntent(engine, { template: 'exit', action: () => remove() });
      leave();
      click('[data-exit-intent-action="custom"]');
      await flush();
      expect(document.querySelector('.exit-intent-popup')).toBeNull();
      expect(exits()).toMatchObject([
        { event: 'dl_exit_intent_shown' },
        { event: 'dl_exit_intent_action', event_action: 'exit_intent_custom', exit_intent: { action: 'custom' } },
      ]);
    });

    it('sends no dl_exit_intent_action for a custom action that fails, as 0.4.43', async () => {
      const engine = await ready(TEMPLATE);
      vi.spyOn(console, 'error').mockImplementation(() => {});
      startAnalytics(engine, options);
      exitIntent(engine, { template: 'exit', action: () => Promise.reject(new Error('page script')) });
      leave();
      click('[data-exit-intent-action="custom"]');
      await flush();
      expect(exits().map((e) => e.event)).toEqual(['dl_exit_intent_shown']);
    });

    it('sends no dl_exit_intent_dismissed when the page removes the popup', async () => {
      const engine = await ready();
      startAnalytics(engine, options);
      const remove = exitIntent(engine, { image: EXIT.creative });
      leave();
      remove();
      expect(document.querySelector('.exit-intent-popup')).toBeNull();
      expect(exits().map((e) => e.event)).toEqual(['dl_exit_intent_shown']);
    });
  });

  it('reports a marked banner as a promotion, without the exit-intent data layer events', async () => {
    const engine = await ready();
    const seen: TrackingEvent[] = [];
    engine.on('analytics', (e) => void seen.push(e.data));
    startAnalytics(engine, options);
    const banner: Promotion = { id: 'summer', type: 'banner', name: 'Summer sale', creative: 'hero' };
    engine.events.emit('promotion.viewed', banner);
    engine.events.emit('promotion.clicked', { ...banner, action: 'apply-coupon', coupon_code: 'SUMMER' });
    expect(seen.slice(-2)).toMatchObject([
      { event_type: 'promotion_viewed', object: 'promotion', data: banner },
      {
        event_type: 'promotion_selected',
        object: 'promotion',
        data: { ...banner, action: 'apply-coupon', coupon_code: 'SUMMER' },
      },
    ]);
    expect(names().slice(1)).toEqual(['dl_view_promotion', 'dl_select_promotion']);
  });

  it('keeps dl_user_data first when the exit-intent popup showed before analytics loaded', async () => {
    const engine = await ready();
    engine.events.emit('promotion.viewed', EXIT);
    await engine.cart.setGroup('bundle:main', { lines: [{ packageId: 1, quantity: 1 }], vouchers: [] });
    startAnalytics(engine, options);
    expect(names()).toEqual([
      'dl_user_data',
      'dl_exit_intent_shown',
      'dl_view_promotion',
      'dl_add_to_cart',
      'dl_cart_updated',
    ]);
    expect(new Set(win.NextDataLayer!.map((e) => e.event_id)).size).toBe(5);
  });

  it('loads the NextCampaign script once and sends one page_view', async () => {
    const engine = await ready();
    const config = vi.fn();
    const event = vi.fn();
    startAnalytics(engine, { ...options, nextCampaign: true });
    const script = document.querySelector<HTMLScriptElement>(
      'script[src="https://campaigns.apps.29next.com/js/v1/campaign/"]',
    )!;
    win.nextCampaign = { config, event };
    script.onload!(new Event('load'));
    expect(config).toHaveBeenCalledWith({ apiKey: 'pk_test' });
    expect(event).toHaveBeenCalledWith('page_view', expect.objectContaining({ url: location.href }));
    startAnalytics(engine, { ...options, nextCampaign: true });
    expect(document.querySelectorAll('script[src*="js/v1/campaign"]')).toHaveLength(1);
  });
});

describe('tracking events', () => {
  const listen = (engine: Engine) => {
    const seen: TrackingEvent[] = [];
    engine.on('analytics', (e) => void seen.push(e.data));
    return seen;
  };

  it('sends each event in the SDK envelope with the SDK object as data, and the dl_* event mirrors it id for id', async () => {
    const engine = await ready();
    const seen = listen(engine);
    startAnalytics(engine, options);
    await engine.cart.setGroup('bundle:main', { lines: [{ packageId: 1, quantity: 1 }], vouchers: [] });
    await flush();
    startCheckout(engine);
    engine.events.emit('address.entered', SHIPPING);
    submitted(engine);
    expect(seen.map((e) => e.event_type)).toEqual([
      'page_viewed',
      'product_added_to_cart',
      'cart_updated',
      'checkout_started',
      'checkout_shipping_address_submitted',
      'checkout_payment_info_submitted',
    ]);
    expect(names()).toEqual([
      'dl_user_data',
      'dl_add_to_cart',
      'dl_cart_updated',
      'dl_begin_checkout',
      'dl_add_shipping_info',
      'dl_add_payment_info',
    ]);
    expect(win.NextDataLayer!.map((e) => e.event_id)).toEqual(seen.map((e) => e.event_id));
    const add = seen.find((e) => e.event_type === 'product_added_to_cart')!;
    expect(add).toMatchObject({
      event_id: expect.stringMatching(/^[0-9a-f]{32}$/),
      object: 'cart_line',
      created_at: expect.stringMatching(/^\d{4}-\d\d-\d\dT/),
      session_id: engine.sessionId(),
      sdk_version: expect.any(String),
    });
    expect(add.data).toEqual({
      package_id: 1,
      quantity: 1,
      product_id: 400,
      product_title: 'Earbuds ×1',
      image: 'https://cdn.test/1.png',
      price: 49,
      original_price: 99,
      total_discount: 0,
      total: 49,
      discounts: [],
      first_in_session: true,
    });
    expect(add.context).toMatchObject({
      campaign: { id: 1310, name: 'Olympus', currency: 'USD', language: 'en' },
      page_location: location.origin + location.pathname,
      page_title: document.title,
    });
    const checkoutId = engine.getState().checkout!.id;
    expect(seen.find((e) => e.event_type === 'cart_updated')!.data).toEqual(engine.cart.current());
    expect(seen.slice(-3).map((e) => e.object)).toEqual(['checkout', 'checkout', 'checkout']);
    expect(seen.at(-2)!.data).toMatchObject({ id: checkoutId, cart: { lines: [{ package_id: 1, total: 49 }] } });
    expect(seen.at(-1)!.data).toMatchObject({ id: checkoutId, payment_method: 'card_token' });
  });

  it('sends one product_added_to_cart per line of a bundle, all with the same first_in_session', async () => {
    const engine = await ready();
    const seen = listen(engine);
    startAnalytics(engine, options);
    await engine.cart.setGroup('bundle:main', {
      lines: [
        { packageId: 1, quantity: 1 },
        { packageId: 9, quantity: 2 },
      ],
      vouchers: [],
    });
    await flush();
    const added = seen.filter((e) => e.event_type === 'product_added_to_cart');
    expect(added.map((e) => e.data)).toMatchObject([
      { package_id: 1, quantity: 1, price: 49, total: 49, first_in_session: true },
      { package_id: 9, quantity: 2, price: 9, total: 18, first_in_session: true },
    ]);
    await engine.cart.setGroup('bundle:main', { lines: [{ packageId: 1, quantity: 2 }], vouchers: [] });
    await flush();
    expect(seen.slice(-3).map((e) => [e.event_type, e.data])).toMatchObject([
      ['product_removed_from_cart', { package_id: 9, quantity: 2, price: 9, total: 18 }],
      ['product_added_to_cart', { package_id: 1, quantity: 1, price: 49, total: 49, first_in_session: false }],
      ['cart_updated', { lines: [{ package_id: 1, quantity: 2 }] }],
    ]);
  });

  it('sends product_viewed at the catalog price, with the package sku', async () => {
    document.body.innerHTML = `<div data-next-package-id="2"></div>`;
    const packages = campaign.packages.map((p) => (p.ref_id === 2 ? { ...p, product_sku: 'EB-2' } : p));
    const { engine } = makeEngine({ campaign: Promise.resolve({ ...campaign, packages }) });
    await engine.start();
    const seen = listen(engine);
    startAnalytics(engine, options);
    expect(seen.map((e) => e.event_type)).toEqual(['page_viewed', 'product_viewed']);
    expect(seen[1]).toMatchObject({ object: 'product' });
    expect(seen[1]!.data).toEqual({
      package_id: 2,
      quantity: 1,
      product_id: 400,
      product_title: 'Earbuds ×2',
      sku: 'EB-2',
      image: 'https://cdn.test/2.png',
      price: 89,
      original_price: 198,
      total_discount: 0,
      total: 89,
      discounts: [],
    });
  });

  it('sends product_list_viewed with every package the page shows', async () => {
    const engine = await ready(`<div data-next-package-id="1"></div><div data-next-package-id="9"></div>`);
    const seen = listen(engine);
    startAnalytics(engine, options);
    const list = seen.find((e) => e.event_type === 'product_list_viewed')!;
    expect(list).toMatchObject({ object: 'products' });
    expect(list.data).toMatchObject([
      { package_id: 1, quantity: 1, price: 49, original_price: 99 },
      { package_id: 9, quantity: 1, price: 9, original_price: 9 },
    ]);
  });

  it('sends the shipping address and the shipping method each once per checkout', async () => {
    const engine = await ready('', {}, (e) => void e.cart.addItem(2));
    const seen = listen(engine);
    startAnalytics(engine, options);
    await flush();
    startCheckout(engine);
    const method = { id: 1, code: 'standard', name: 'Standard', price: 0 };
    engine.events.emit('address.entered', SHIPPING);
    engine.events.emit('shipping.settled', method);
    engine.events.emit('address.entered', SHIPPING);
    engine.events.emit('shipping.settled', method);
    const shipping = seen.filter((e) => e.event_type.startsWith('checkout_shipping'));
    expect(shipping.map((e) => e.event_type)).toEqual([
      'checkout_shipping_address_submitted',
      'checkout_shipping_method_submitted',
    ]);
    for (const e of shipping) expect(e.data).toMatchObject({ id: engine.getState().checkout!.id, cart: { total: 89 } });
  });

  it('reports a lead and promotions, and the shipping address for the shipping address only', async () => {
    const engine = await ready('', {}, (e) => void e.cart.addItem(2));
    const seen = listen(engine);
    startAnalytics(engine, options);
    await flush();
    startCheckout(engine);
    engine.events.emit('user.created', {
      email: 'jane@example.com',
      first_name: 'Jane',
      last_name: 'Doe',
      accepts_marketing: true,
      language: 'en',
      user_agent: 'test',
    });
    engine.events.emit('address.entered', { ...SHIPPING, type: 'billing' });
    const template: Promotion = { id: 'exit_intent', type: 'exit_intent', creative: 'exit' };
    engine.events.emit('promotion.viewed', template);
    engine.events.emit('promotion.clicked', { ...template, action: 'apply-coupon', coupon_code: 'EXIT10' });
    engine.events.emit('address.entered', SHIPPING);
    expect(seen.slice(-4)).toMatchObject([
      { event_type: 'checkout_contact_info_submitted', object: 'checkout', data: { cart: { total: 89 } } },
      { event_type: 'promotion_viewed', data: template },
      { event_type: 'promotion_selected', data: { ...template, action: 'apply-coupon', coupon_code: 'EXIT10' } },
      { event_type: 'checkout_shipping_address_submitted', data: { cart: { total: 89 } } },
    ]);
    expect(names().slice(-6)).toEqual([
      'dl_generate_lead',
      'dl_exit_intent_shown',
      'dl_view_promotion',
      'dl_exit_intent_action',
      'dl_select_promotion',
      'dl_add_shipping_info',
    ]);
    expect(win.NextDataLayer!.find((e) => e.event === 'dl_generate_lead')).toMatchObject({
      currency: 'USD',
      value: 89,
      lead_source: 'checkout',
    });
    expect(win.NextDataLayer!.find((e) => e.event === 'dl_view_promotion')).toMatchObject({
      ecommerce: { promotion_id: 'exit_intent', creative_name: 'exit' },
    });
  });

  it('keys a purchase and an upsell by their transaction ids, with the upsell details nested', async () => {
    const fetch = fakeApi({ getOrder: () => json(withUpsell(ORDER, 99, 1)) }).fetch;
    const { engine } = makeEngine({ local: new MemoryStorage(), fetch });
    await engine.start();
    engine.order = engine.attach((ctx) => createOrder(ctx, engine.cart));
    await engine.order.load('R1');
    const seen = listen(engine);
    startAnalytics(engine, options);
    const [, upsell, purchase] = seen;
    expect(purchase).toMatchObject({
      event_type: 'checkout_completed',
      event_id: '1001',
      object: 'order',
      data: { ref_id: 'R1', number: '1001', total: 106.11 },
    });
    expect(upsell).toMatchObject({
      event_type: 'upsell_completed',
      event_id: 'R1-US1',
      object: 'order',
      data: {
        ref_id: 'R1',
        number: '1001',
        lines: [
          { sku: 'EB-2', upsell: false },
          { id: '99', upsell: true },
        ],
        upsell: {
          number: 1,
          line: { id: '99', product_title: 'Bump', quantity: 1, price: 20, total: 20, upsell: true },
        },
      },
    });
  });

  it('passes the upsell offer through on upsell_viewed and upsell_skipped', async () => {
    const engine = await ready();
    const seen = listen(engine);
    startAnalytics(engine, options);
    const offer = { ref_id: 'R1', page: '/up/', selector_id: 'a', lines: [{ package_id: 3, quantity: 1 }], total: 40 };
    engine.events.emit('upsell.viewed', offer);
    engine.events.emit('upsell.viewed', { ...offer, selector_id: 'b' });
    engine.events.emit('upsell.skipped', offer);
    expect(seen.slice(1)).toMatchObject([
      { event_type: 'upsell_viewed', object: 'upsell', data: offer },
      { event_type: 'upsell_skipped', object: 'upsell', data: offer },
    ]);
  });

  it('keeps sending tracking events when the page turned the dl_* data layer off', async () => {
    const engine = await ready();
    const seen = listen(engine);
    startAnalytics(engine, { ...options, legacy: { dataLayer: false, meta: false } });
    expect(seen.map((e) => e.event_type)).toEqual(['page_viewed']);
    expect(seen[0]!.data).toEqual({});
    expect(win.dataLayer).toBeUndefined();
  });
});

describe('analytics decisions', () => {
  const traces = (engine: Engine) =>
    engine.log
      .entries()
      .map((e) => e.data as AnalyticsTrace | undefined)
      .filter((d): d is AnalyticsTrace => d?.trace === 'analytics')
      .map(({ trigger, name, sent, reason }) => [trigger, name, sent, reason]);

  it('logs why each event was sent or not, for the debug panel', async () => {
    const engine = await ready('<div data-next-package-id="1"></div><div data-next-package-id="2"></div>');
    startAnalytics(engine, options);
    await engine.cart.addItem(1);
    await flush();
    expect(traces(engine)).toEqual([
      ['sdk.ready', 'page_viewed', true, 'Every page load'],
      ['sdk.ready', 'product_list_viewed', true, '2 packages on the page'],
      ['sdk.ready', 'product_viewed', false, '2 packages on the page, so product_list_viewed instead'],
      ['sdk.ready', 'product_added_to_cart', false, 'Nothing was added since the last report'],
      ['sdk.ready', 'product_removed_from_cart', false, 'Nothing was removed since the last report'],
      ['cart.calculated', 'product_removed_from_cart', false, 'Nothing was removed since the last report'],
      ['cart.calculated', 'product_added_to_cart', true, 'Added since the last report: Earbuds ×1 ×1'],
      ['cart.calculated', 'cart_updated', true, 'After every price update'],
    ]);
  });

  it('names the analytics event id on each trace of a sent event', async () => {
    const engine = await ready('<div data-next-package-id="1"></div>');
    const ids: string[] = [];
    engine.on('analytics', (e) => ids.push(e.data.event_id), { replay: true });
    startAnalytics(engine, options);
    const traced = engine.log
      .entries()
      .map((e) => e.data as AnalyticsTrace | undefined)
      .filter((d): d is AnalyticsTrace => d?.trace === 'analytics' && d.sent)
      .map((d) => d.id);
    expect(traced).toEqual(ids);
  });
});
