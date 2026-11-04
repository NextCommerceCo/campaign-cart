import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCheckout } from '../src/checkout/state/checkout';
import { exitIntent } from '../src/compat/exit-intent';
import type { Engine } from '../src/engine/engine';
import type { EventName } from '../src/engine/events';
import type { Campaign } from '../src/engine/types';
import { createOrder } from '../src/order/state';
import { fakeApi, json, type FakeApiOptions } from './fixtures/api';
import { campaign } from './fixtures/campaign';
import { flush, makeEngine } from './fixtures/engine';
import { ORDER } from './fixtures/order';
import { fakeRules } from './fixtures/rules';
import { MemoryStorage } from './fixtures/storage';

const FILE = 'docs/event-examples.json';

const PUBLIC: Record<Exclude<EventName, 'campaign.loaded' | 'analytics'>, true> = {
  'sdk.ready': true,
  'sdk.error': true,
  'selector.selected': true,
  'selector.deselected': true,
  'selector.calculating': true,
  'selector.calculated': true,
  'cart.updated': true,
  'cart.calculating': true,
  'cart.calculated': true,
  'cart.added': true,
  'cart.removed': true,
  'coupon.applied': true,
  'coupon.removed': true,
  'coupon.denied': true,
  'checkout.started': true,
  'user.entered': true,
  'user.updated': true,
  'address.entered': true,
  'address.updated': true,
  'shipping.selected': true,
  'payment.selected': true,
  'checkout.submitted': true,
  'order.created': true,
  'order.failed': true,
  'order.loaded': true,
  'upsell.viewed': true,
  'upsell.accepted': true,
  'upsell.skipped': true,
  'upsell.failed': true,
  'promotion.viewed': true,
  'promotion.clicked': true,
  'promotion.closed': true,
};

const CATALOG: Campaign = {
  ...campaign,
  packages: campaign.packages.map((p) => ({
    ...p,
    product_name: 'Olympus Earbuds',
    product_variant_id: 4000 + p.ref_id,
    product_variant_name: 'Black',
  })),
};

const examples: Record<string, unknown> = {};
const record = (engine: Engine) =>
  engine.on('*', (e) => {
    if (e.name in PUBLIC && !(e.name in examples)) examples[e.name] = JSON.parse(JSON.stringify(e.data));
  });

async function page(
  opts: { api?: FakeApiOptions; session?: Storage; local?: Storage; params?: Record<string, string> } = {},
) {
  const { engine } = makeEngine({ ...opts, campaign: Promise.resolve(CATALOG), fetch: fakeApi(opts.api).fetch });
  record(engine);
  await engine.start();
  return engine;
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('event examples', () => {
  it('records one payload per public event from real flows, as the Event Reference shows them', async () => {
    const down = makeEngine({ campaign: Promise.reject(new Error('Failed to fetch')) }).engine;
    record(down);
    await down.start();

    const session = new MemoryStorage();
    const local = new MemoryStorage();
    const landing = await page({ session, local, params: { forcePackageId: '1:1' } });
    await landing.cart.addItem(2);
    await landing.cart.removeItem(2);
    await landing.cart.applyCoupon('nope');
    await landing.cart.applyCoupon('save10');
    await landing.cart.removeCoupon('SAVE10');
    await landing.selectors.register(
      'main',
      [
        { id: 'one', lines: [{ packageId: 1, quantity: 1 }], vouchers: [] },
        { id: 'two', lines: [{ packageId: 2, quantity: 1 }], vouchers: [] },
      ],
      'select',
      'one',
    );
    await landing.cart.setGroup('toggle:9', { lines: [{ packageId: 9, quantity: 1 }], vouchers: [] });
    await landing.cart.setGroup('toggle:9', null, { dismiss: true });
    await flush();

    const declined = { order: () => json({ payment_response_code: '51', payment_details: 'Insufficient funds' }, 400) };
    const checkout = await page({ session, local, api: declined });
    const form = checkout.attach((ctx) => createCheckout(ctx, checkout.cart, fakeRules().api));
    form.begin();
    await form.loadCountries();
    form.setField('country', 'US');
    await flush();
    const shipping = {
      email: 'jane@example.com',
      first_name: 'Jane',
      last_name: 'Doe',
      line1: '1 Main St',
      city: 'Austin',
      state: 'CA',
      postcode: '90210',
    };
    for (const [name, value] of Object.entries(shipping)) form.setField(name, value);
    await form.leave('postcode');
    form.setField('city', 'Dallas');
    await form.leave('city');
    form.setField('email', 'jane.doe@example.com');
    await form.leave('email');
    await checkout.cart.setShipping(1);
    form.setPaymentMethod('paypal');
    form.setPaymentMethod('card');
    const urls = {
      failureUrl: 'https://shop.test/checkout/?payment_failed=true',
      pageUrl: 'https://shop.test/checkout/',
    };
    await form.placeOrder({ ...urls, tokenize: async () => 'tok_1' });

    const paid = await page({ session, local, api: { order: () => json(ORDER) } });
    const again = paid.attach((ctx) => createCheckout(ctx, paid.cart, fakeRules().api));
    await again.loadCountries();
    await again.placeOrder({ ...urls, tokenize: async () => 'tok_1' });

    const upsell = await page({ local });
    const order = upsell.attach((ctx) => createOrder(ctx, upsell.cart));
    await order.load('R1', '/upsell/');
    order.view('/upsell/');
    await order.accept({ lines: [{ packageId: 2, quantity: 1 }] }, '/upsell/');
    order.skip({ lines: [{ packageId: 3, quantity: 1 }] });
    const refused = await page({ local, api: { upsell: () => json({ message: 'Card declined' }, 400) } });
    const refusedOrder = refused.attach((ctx) => createOrder(ctx, refused.cart));
    await refusedOrder.load('R1');
    await refusedOrder.accept({ lines: [{ packageId: 2, quantity: 1 }] }, '/upsell-2/');

    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    document.body.innerHTML = `<template data-template="exit-offer"><button data-exit-intent-action="apply-coupon" data-coupon-code="SAVE10">Take 10% off</button></template>`;
    const popup = await page();
    exitIntent(popup, { template: 'exit-offer', maxTriggers: 2 });
    const leave = () => document.dispatchEvent(new MouseEvent('mouseout', { clientY: -1, relatedTarget: null }));
    leave();
    document.querySelector<HTMLElement>('[data-exit-intent-action]')!.click();
    await flush();
    leave();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(Object.keys(PUBLIC).filter((name) => !(name in examples))).toEqual([]);
    const ordered = Object.fromEntries(Object.keys(PUBLIC).map((name) => [name, examples[name]]));
    if (process.env.UPDATE_DOCS || !existsSync(FILE)) writeFileSync(FILE, `${JSON.stringify(ordered, null, 2)}\n`);
    expect(JSON.parse(readFileSync(FILE, 'utf8'))).toEqual(ordered);
  });
});
