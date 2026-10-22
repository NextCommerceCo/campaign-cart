import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startAnalytics } from '../src/analytics';
import type { Engine } from '../src/engine/engine';
import { createOrder } from '../src/engine/order';
import { fakeApi, json } from './fixtures/api';
import { flush, makeEngine } from './fixtures/engine';
import { ORDER, withUpsell } from './fixtures/order';
import { MemoryStorage } from './fixtures/storage';

type Win = Window & {
  NextDataLayer?: any[];
  dataLayer?: any[];
  NextDataLayerTransformFn?: unknown;
  nextCampaign?: unknown;
};
const win = window as Win;
const options = { apiKey: 'pk_test', version: '1.0.0', nextCampaign: false };
const names = () => (win.NextDataLayer ?? []).map((e) => e.event);

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
      campaign_name: 'Olympus',
      campaign_currency: 'USD',
      cart_total: '0',
      ecommerce: { currency: 'USD', value: 0, items: [] },
      attribution: { utm_source: 'fb', funnel: 'Olympus' },
    });
    expect(event.event_id).toMatch(/^\w+_1$/);
    expect(JSON.stringify(event)).not.toContain('jane@x.com');
    expect(win.dataLayer).toEqual([{ ecommerce: null }, event]);
  });

  it('leaves dataLayer alone when the page turned the GTM provider off, like 0.4.x', async () => {
    const engine = await ready();
    startAnalytics(engine, { ...options, dataLayer: false });
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

  it('turns cart changes after ready into add, swap, remove and cart-updated events', async () => {
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
      'dl_cart_updated',
      'dl_add_to_cart',
      'dl_cart_updated',
      'dl_package_swapped',
      'dl_cart_updated',
      'dl_remove_from_cart',
      'dl_cart_updated',
    ]);
    const swap = win.NextDataLayer!.find((e) => e.event === 'dl_package_swapped');
    expect(swap.ecommerce).toMatchObject({
      value_change: 40,
      items_removed: [{ item_id: '11' }],
      items_added: [{ item_id: '12' }],
    });
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('ignores cart changes made before ready, such as a forced cart', async () => {
    const engine = await ready('', { forcePackageId: '2' });
    startAnalytics(engine, options);
    await flush();
    expect(names()).toEqual(['dl_user_data', 'dl_cart_updated']);
    expect(win.NextDataLayer![0].ecommerce.items).toMatchObject([{ item_id: '12' }]);
    expect(win.NextDataLayer![1].ecommerce.items).toEqual([
      expect.objectContaining({ item_id: '12', item_product_id: '400', price: 44.5, discount: 54.5, quantity: 2 }),
    ]);
  });

  it('reports checkout steps in the 0.4.x shape', async () => {
    const engine = await ready('', {}, (e) => void e.cart.addItem(2));
    startAnalytics(engine, options);
    await flush();
    engine.events.emit('checkout.started', { lines: engine.cart.lines() });
    engine.events.emit('checkout.shipping-added', { tier: 'Standard' });
    engine.events.emit('checkout.payment-added', { method: 'card_token' });
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

  it('names the coupon and the shipping cost on cart-level events, like 0.4.x', async () => {
    const engine = await ready('', {}, (e) => void e.cart.addItem(2));
    startAnalytics(engine, options);
    await flush();
    await engine.cart.applyCoupon('SAVE10');
    await flush();
    engine.events.emit('checkout.started', { lines: engine.cart.lines() });
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
    const engine = await ready();
    startAnalytics(engine, options);
    engine.events.emit('order.loaded', { order, purchase: '1001', coupon: 'SAVE10' });
    const purchase = win.NextDataLayer!.find((e) => e.event === 'dl_purchase')!;
    expect(purchase.ecommerce.coupon).toBe('SAVE10');
    expect(purchase.ecommerce.items[0]).toMatchObject({
      item_id: 'SKU-31',
      item_brand: 'Olympus',
      item_product_id: '900',
      item_image: 'https://cdn.test/9.png',
    });
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
    expect(await run()).toEqual(['dl_user_data', 'dl_purchase', 'dl_upsell_purchase']);
    const [, purchase, upsell] = win.NextDataLayer!;
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
    engine.events.emit('upsell.viewed', { refId: 'R1', page: '/up/' });
    engine.events.emit('upsell.skipped', { refId: 'R1' });
    engine.events.emit('upsell.skipped', { refId: 'R1', packageId: 3 });
    expect(win.NextDataLayer!.slice(-3)).toMatchObject([
      { event: 'dl_viewed_upsell', order_id: 'R1', page_path: '/up/' },
      { event: 'dl_skipped_upsell', order_id: 'R1', upsell: { package_id: 'unknown' } },
      { event: 'dl_skipped_upsell', upsell: { package_id: '3', package_name: 'Earbuds case' } },
    ]);
  });

  it('reports the exit-intent popup the 0.4.x way', async () => {
    const engine = await ready();
    startAnalytics(engine, options);
    const image = { imageUrl: 'https://cdn.test/exit.png' };
    engine.events.emit('exit-intent.shown', image);
    engine.events.emit('exit-intent.clicked', image);
    engine.events.emit('exit-intent.action', { template: 'exit', action: 'apply-coupon', couponCode: 'EXIT10' });
    engine.events.emit('exit-intent.dismissed', { template: 'exit' });
    engine.events.emit('exit-intent.closed', image);
    expect(win.NextDataLayer!.slice(1)).toMatchObject([
      {
        event: 'dl_exit_intent_shown',
        event_category: 'engagement',
        event_label: image.imageUrl,
        exit_intent: { image_url: image.imageUrl, template: '' },
      },
      { event: 'dl_exit_intent_accepted', event_action: 'exit_intent_accepted' },
      {
        event: 'dl_exit_intent_action',
        event_action: 'exit_intent_apply-coupon',
        event_label: 'EXIT10',
        exit_intent: { action: 'apply-coupon', coupon_code: 'EXIT10' },
      },
      { event: 'dl_exit_intent_dismissed', event_label: 'exit' },
      { event: 'dl_exit_intent_closed' },
    ]);
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
