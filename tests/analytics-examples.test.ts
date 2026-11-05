import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { startAnalytics } from '../src/analytics';
import { createCheckout } from '../src/checkout/state/checkout';
import type { Engine } from '../src/engine/engine';
import type { AnalyticsName } from '../src/engine/events/analytics';
import { createOrder } from '../src/order/state';
import { fakeApi, json } from './fixtures/api';
import { flush, makeEngine } from './fixtures/engine';
import { ORDER, withUpsell } from './fixtures/order';
import { fakeRules } from './fixtures/rules';
import { MemoryStorage } from './fixtures/storage';

const FILE = 'docs/analytics-examples.json';
const OPTIONS = { apiKey: 'pk_test', version: '1.0.0', nextCampaign: false, dataLayer: false };

const NAMES: Record<AnalyticsName, true> = {
  page_view: true,
  view_item: true,
  view_item_list: true,
  add_to_cart: true,
  remove_from_cart: true,
  update_cart: true,
  begin_checkout: true,
  generate_lead: true,
  add_shipping_info: true,
  add_payment_info: true,
  purchase: true,
  upsell_purchase: true,
  view_upsell: true,
  skip_upsell: true,
  view_promotion: true,
  select_promotion: true,
};

const examples: Record<string, unknown> = {};
const record = (engine: Engine) =>
  engine.on('analytics', (e) => {
    examples[e.data.name] ??= JSON.parse(JSON.stringify(e.data.params));
  });

async function page(html: string, engine = makeEngine({ local: new MemoryStorage() }).engine) {
  document.body.innerHTML = html;
  document.title = 'Olympus Earbuds';
  record(engine);
  await engine.start();
  startAnalytics(engine, OPTIONS);
  return engine;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('analytics examples', () => {
  it('records the params of every analytics event, as the Analytics Reference shows them', async () => {
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
    shop.events.emit('address.entered', {
      first_name: 'Jane',
      last_name: 'Doe',
      line1: '1 Main St',
      country: 'US',
      type: 'shipping',
    });
    shop.events.emit('checkout.submitted', { ...shop.cart.currentCheckout(), payment_method: 'card_token' });
    const promotion = { id: 'exit_intent', type: 'exit_intent' as const, name: 'Exit offer', creative: 'exit-offer' };
    shop.events.emit('promotion.viewed', promotion);
    shop.events.emit('promotion.clicked', { ...promotion, action: 'apply-coupon', coupon_code: 'SAVE10' });
    await shop.cart.clear();
    await flush();

    const fetch = fakeApi({ getOrder: () => json(withUpsell(ORDER, 99, 1)) }).fetch;
    const { engine: upsell } = makeEngine({ local: new MemoryStorage(), fetch });
    record(upsell);
    await upsell.start();
    upsell.order = upsell.attach((ctx) => createOrder(ctx, upsell.cart));
    await upsell.order.load('R1');
    startAnalytics(upsell, OPTIONS);
    upsell.events.emit('upsell.viewed', { ref_id: 'R1', page: '/upsell/', lines: [] });
    upsell.events.emit('upsell.skipped', { ref_id: 'R1', page: '/upsell/', lines: [{ package_id: 3, quantity: 1 }] });

    expect(Object.keys(NAMES).filter((name) => !(name in examples))).toEqual([]);
    const ordered = Object.fromEntries(Object.keys(NAMES).map((name) => [name, examples[name]]));
    if (process.env.UPDATE_DOCS || !existsSync(FILE)) writeFileSync(FILE, `${JSON.stringify(ordered, null, 2)}\n`);
    expect(JSON.parse(readFileSync(FILE, 'utf8'))).toEqual(ordered);
  });
});
