import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCheckout } from '../../src/checkout/state/checkout';
import { legacyCheckoutEvents } from '../../src/compat/checkout';
import * as translator from '../../src/compat/legacy';
import { legacyEvents } from '../../src/compat/legacy/registry';
import { fakeApi, type FakeApiOptions, json } from '../fixtures/api';
import { flush, makeEngine } from '../fixtures/engine';
import { fakeRules } from '../fixtures/rules';

const SHIPPING = {
  country: 'US',
  email: 'jane@example.com',
  first_name: 'Jane',
  last_name: 'Doe',
  line1: '1 Main St',
  city: 'Austin',
  state: 'CA',
  postcode: '90210',
};
const URLS = { failureUrl: 'https://shop.test/checkout/', pageUrl: 'https://shop.test/checkout/' };
const NAMES = [
  'payment:tokenized',
  'payment:error',
  'express-checkout:started',
  'express-checkout:error',
  'express-checkout:completed',
  'checkout:express-completed',
  'express-checkout:failed',
  'checkout:express-failed',
];

afterEach(() => vi.restoreAllMocks());

async function page(api: FakeApiOptions = {}, lines = true) {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const { engine } = makeEngine({ fetch: fakeApi(api).fetch });
  await engine.start();
  if (lines) await engine.cart.addItem(1);
  const legacy = legacyEvents(engine, () => translator);
  legacyCheckoutEvents(engine, document.createElement('form'));
  const heard: Array<[string, unknown]> = [];
  for (const name of NAMES) legacy.on(name, (data) => heard.push([name, data]));
  const checkout = engine.attach((ctx) => createCheckout(ctx, engine.cart, fakeRules().api));
  checkout.begin();
  await checkout.loadCountries();
  Object.entries(SHIPPING).forEach(([name, value]) => checkout.setField(name, value));
  await flush();
  return { checkout, heard };
}

const declined = () => json({ payment_response_code: '51', payment_details: 'Insufficient funds' }, 400);

describe('0.4.x checkout payment events', () => {
  it('a declined card is a payment:error with its code, and a wallet failure for an express button', async () => {
    const card = await page({ order: declined });
    await card.checkout.placeOrder({ ...URLS, tokenize: async () => 'tok' });
    expect(card.heard).toEqual([
      ['payment:tokenized', { paymentMethod: 'credit-card' }],
      [
        'payment:error',
        {
          message: 'Insufficient funds',
          code: '51',
          details: { code: 'declined', status: 400, message: 'Insufficient funds', decline_code: '51' },
        },
      ],
    ]);

    const wallet = await page({ order: declined });
    await wallet.checkout.placeOrder({ ...URLS, expressMethod: 'apple-pay' });
    expect(wallet.heard.map(([name]) => name)).toEqual([
      'express-checkout:started',
      'payment:error',
      'express-checkout:failed',
      'checkout:express-failed',
    ]);
    expect(wallet.heard[2]![1]).toEqual({ method: 'apple_pay', error: 'Insufficient funds' });
  });

  it('a card that fails its checks is a payment:error, an express button on an empty cart an express error', async () => {
    const card = await page();
    await card.checkout.placeOrder({ ...URLS });
    expect(card.heard).toEqual([['payment:error', { message: 'Please check your card details and try again.' }]]);

    const empty = await page({}, false);
    await empty.checkout.placeOrder({ ...URLS, expressMethod: 'paypal' });
    expect(empty.heard).toEqual([['express-checkout:error', { method: 'paypal', error: 'Cart is empty' }]]);
  });

  it('an express order completes once, paid at once or at the gateway', async () => {
    const gateway = await page({ order: () => json({ ref_id: 'R9', payment_complete_url: 'https://pay.test/R9' }) });
    await gateway.checkout.placeOrder({ ...URLS, expressMethod: 'paypal' });
    expect(gateway.heard).toEqual([
      ['express-checkout:started', { method: 'paypal', itemCount: 1 }],
      [
        'express-checkout:completed',
        { method: 'paypal', order: { ref_id: 'R9', payment_complete_url: 'https://pay.test/R9' } },
      ],
      ['checkout:express-completed', { method: 'paypal', success: true }],
    ]);

    const paid = await page({ order: () => json({ ref_id: 'R1', payment_method: 'apple_pay' }) });
    await paid.checkout.placeOrder({ ...URLS, expressMethod: 'apple-pay' });
    expect(paid.heard.map(([name]) => name)).toEqual([
      'express-checkout:started',
      'express-checkout:completed',
      'checkout:express-completed',
    ]);
    expect(paid.heard[1]![1]).toMatchObject({ method: 'apple_pay', order: { ref_id: 'R1', paid: true } });
  });
});
