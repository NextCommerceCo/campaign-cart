import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { startAnalytics } from '../src/analytics';
import { NAMES as DATA_LAYER } from '../src/compat/analytics';
import { createCheckout } from '../src/checkout/state/checkout';
import type { Engine } from '../src/engine/engine';
import type { TrackingName } from '../src/engine/events/analytics';
import { WIRING } from '../src/debug/tabs/providers';
import { createOrder } from '../src/order/state';
import { fakeApi, json } from './fixtures/api';
import { flush, makeEngine } from './fixtures/engine';
import { ORDER, withUpsell } from './fixtures/order';
import { fakeRules } from './fixtures/rules';
import { MemoryStorage } from './fixtures/storage';

const FILE = 'docs/analytics-examples.json';
const OPTIONS = { apiKey: 'pk_test', version: '1.0.0', nextCampaign: false };

const NAMES: Record<TrackingName, true> = {
  page_viewed: true,
  product_viewed: true,
  product_list_viewed: true,
  product_added_to_cart: true,
  product_removed_from_cart: true,
  cart_updated: true,
  checkout_started: true,
  checkout_contact_info_submitted: true,
  checkout_shipping_address_submitted: true,
  checkout_shipping_method_submitted: true,
  checkout_payment_info_submitted: true,
  checkout_completed: true,
  upsell_completed: true,
  upsell_viewed: true,
  upsell_skipped: true,
  promotion_viewed: true,
  promotion_selected: true,
};

const examples: Partial<Record<TrackingName, unknown>> = {};
const objects: Partial<Record<TrackingName, string>> = {};
const CHECKOUT_ID = '7c1e4d2a9b3f4e5d8a6c0b1f2e3d4c5a';

const record = (engine: Engine) =>
  engine.on('analytics', (e) => {
    const data = JSON.parse(JSON.stringify(e.data.data));
    if (e.data.object === 'checkout') data.id = CHECKOUT_ID;
    examples[e.data.event_type] ??= data;
    objects[e.data.event_type] ??= e.data.object;
  });

async function page(html: string, engine = makeEngine({ local: new MemoryStorage() }).engine) {
  document.body.innerHTML = html;
  document.title = 'Olympus Earbuds';
  record(engine);
  await engine.start();
  startAnalytics(engine, OPTIONS);
  return engine;
}

/** The fields that differ on every run, fixed so the example stays put. */
const STABLE = {
  event_id: '3f2b8c1d9e7a4b6c8d5e2f1a0b9c8d7e',
  event_time: '2026-11-04T08:30:00.000Z',
  campaign_session_id: '0b8f3c2d1e4a4f6b9c7d5e3f2a1b0c9d',
};

type Push = { event?: string; attribution: { metadata: object } };
const win = window as Window & { dataLayer?: Push[] };

const dataLayerPush = (name: TrackingName) => {
  const push = win.dataLayer!.find((p) => p.event === DATA_LAYER[name]);
  if (!push) return undefined;
  const metadata = { ...push.attribution.metadata, sdk_version: OPTIONS.version, conversion_timestamp: 1793781000000 };
  return JSON.parse(JSON.stringify({ ...push, ...STABLE, attribution: { ...push.attribution, metadata } }));
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('analytics examples', () => {
  it('records the object, data, triggers and dataLayer push of every tracking event, as the Analytics Reference shows them', async () => {
    win.dataLayer = [];
    await page('<div data-next-package-id="1"></div><div data-next-package-id="2"></div>');
    await page('<div data-next-package-id="1"></div>');

    const shop = await page('');
    await shop.cart.setGroup('bundle:main', { lines: [{ packageId: 1, quantity: 1 }], vouchers: [] });
    await flush();
    shop.checkout = shop.attach((ctx) => createCheckout(ctx, shop.cart, fakeRules().api));
    shop.checkout.begin();
    shop.events.emit('user.created', {
      email: 'jane@example.com',
      first_name: 'Jane',
      last_name: 'Doe',
      accepts_marketing: false,
      language: 'en',
      user_agent: 'UA',
    });
    const shippingAddress = { first_name: 'Jane', last_name: 'Doe', line1: '1 Main St', country: 'US' };
    shop.attach((ctx) => ctx.update('checkout', { shippingAddress }));
    shop.events.emit('address.entered', { ...shippingAddress, type: 'shipping' });
    await shop.cart.setShipping(1);
    await flush();
    shop.events.emit('checkout.submitted', { ...shop.cart.currentCheckout(), payment_method: 'card_token' });
    const promotion = { id: 'exit_intent', type: 'exit_intent' as const, name: 'Exit offer', creative: 'exit-offer' };
    shop.events.emit('promotion.viewed', promotion);
    shop.events.emit('promotion.clicked', { ...promotion, action: 'apply-coupon', coupon_code: 'SAVE10' });
    await shop.cart.clear();
    await flush();

    const local = new MemoryStorage();
    const { engine: paid } = makeEngine({ local, fetch: fakeApi({ getOrder: () => json(ORDER) }).fetch });
    await paid.start();
    await paid.attach((ctx) => createOrder(ctx, paid.cart)).load('R1');

    const fetch = fakeApi({ getOrder: () => json(withUpsell(ORDER, 99, 1)) }).fetch;
    const { engine: upsell } = makeEngine({ local, fetch });
    record(upsell);
    await upsell.start();
    upsell.order = upsell.attach((ctx) => createOrder(ctx, upsell.cart));
    await upsell.order.load('R1');
    startAnalytics(upsell, OPTIONS);
    upsell.events.emit('upsell.viewed', { ref_id: 'R1', page: '/upsell/', lines: [] });
    upsell.events.emit('upsell.skipped', { ref_id: 'R1', page: '/upsell/', lines: [{ package_id: 3, quantity: 1 }] });

    expect(Object.keys(NAMES).filter((name) => !(name in examples))).toEqual([]);
    const ordered = Object.fromEntries(
      (Object.keys(NAMES) as TrackingName[]).map((name) => [
        name,
        {
          triggers: WIRING.find((w) => w.tracking === name)?.from ?? [],
          object: objects[name],
          data: examples[name],
          dataLayer: dataLayerPush(name),
        },
      ]),
    );
    expect(Object.entries(ordered).filter(([, e]) => !e.dataLayer || !e.triggers.length)).toEqual([]);
    if (process.env.UPDATE_DOCS || !existsSync(FILE)) writeFileSync(FILE, `${JSON.stringify(ordered, null, 2)}\n`);
    expect(JSON.parse(readFileSync(FILE, 'utf8'))).toEqual(ordered);
  });
});
