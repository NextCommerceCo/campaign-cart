import { describe, expect, it, vi } from 'vitest';
import { createCheckout, type Lead, redirectFor } from '../../../src/checkout/state/checkout';
import { orderBody, paymentCode } from '../../../src/checkout/state/order-body';
import type { Scope } from '../../../src/checkout/state/rules';
import { createOrder } from '../../../src/order/state';
import { fakeApi, type FakeApiOptions, json, OPEN_CART } from '../../fixtures/api';
import { campaign } from '../../fixtures/campaign';
import { flush, makeEngine, type MakeEngine, wait } from '../../fixtures/engine';
import { fakeRules } from '../../fixtures/rules';
import { MemoryStorage } from '../../fixtures/storage';

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
const URLS = { failureUrl: 'https://shop.test/checkout?payment_failed=true', pageUrl: 'https://shop.test/checkout' };

async function setup(
  opts: MakeEngine & {
    api?: FakeApiOptions;
    geo?: string;
    rulesDown?: boolean;
    geoDelay?: number;
    lead?: Lead;
  } = {},
) {
  const api = fakeApi(opts.api);
  const made = makeEngine({ ...opts, fetch: api.fetch });
  await made.engine.start();
  const rules = fakeRules({ geo: opts.geo, down: opts.rulesDown, geoDelay: opts.geoDelay });
  const checkout = made.engine.attach((ctx) => createCheckout(ctx, made.engine.cart, rules.api, { lead: opts.lead }));
  const fill = (fields: Record<string, string>) => Object.entries(fields).forEach(([k, v]) => checkout.setField(k, v));
  const posts = (path: string) => api.calls.filter((c) => c.url.endsWith(path));
  return { ...made, api, rules, checkout, fill, posts };
}

describe('checkout', () => {
  it('turns page payment words into API codes', () => {
    expect(['credit', 'apple-pay', 'Klarna', 'card_token'].map(paymentCode)).toEqual([
      'card_token',
      'apple_pay',
      'klarna',
      'card_token',
    ]);
  });

  it('sends the shopper with the campaign’s language, not always English', async () => {
    const { engine, checkout, fill, posts } = await setup({
      campaign: Promise.resolve({ ...campaign, language: 'fr' }),
    });
    await engine.cart.addItem(1);
    fill({ email: 'jane@example.com', first_name: 'Jane', last_name: 'Doe' });
    await checkout.leave('last_name');
    expect(posts('/carts/')[0]!.body).toMatchObject({ user: { language: 'fr' } });
    const body = orderBody(engine.getState(), {
      method: 'card_token',
      token: 'tok_1',
      lines: engine.cart.lines(),
      vouchers: [],
      attribution: engine.attribution(),
      urls: URLS,
    });
    expect(body.user).toMatchObject({ language: 'fr' });
  });

  it('builds the 0.4.x order body for any method the form sends, and a short one for an express button', async () => {
    const { engine, checkout, fill } = await setup();
    await engine.cart.addItem(2);
    fill({ ...SHIPPING, line2: 'Apt 4', phone_number: '(415) 555-2671' });
    const body = (method: string, express = false) =>
      orderBody(engine.getState(), {
        method,
        express,
        token: method === 'card_token' ? 'tok_1' : undefined,
        lines: engine.cart.lines(),
        vouchers: [],
        attribution: engine.attribution(),
        urls: URLS,
      });
    expect(body('card_token')).toMatchObject({
      lines: [{ package_id: 2, quantity: 1 }],
      shipping_method: 1,
      payment_detail: { payment_method: 'card_token', card_token: 'tok_1' },
      user: { email: 'jane@example.com', first_name: 'Jane', language: 'en', accepts_marketing: true },
      shipping_address: { line1: '1 Main St', line2: 'Apt 4', line4: 'Austin', state: 'CA', postcode: '90210' },
      billing_same_as_shipping_address: true,
      success_url: 'https://shop.test/success',
      payment_failed_url: URLS.failureUrl,
    });
    expect(body('card_token')).not.toHaveProperty('billing_address');
    expect(body('card_token').user?.phone_number).toBe('(415) 555-2671');
    await checkout.leave('phone_number');
    expect(body('card_token').shipping_address?.phone_number).toBe('+14155552671');
    checkout.setSameAsShipping(false);
    fill({ billing_first_name: 'Ann', billing_line1: '2 Side St', billing_city: 'Reno' });
    expect(body('card_token').billing_address).toEqual({
      first_name: 'Ann',
      last_name: '',
      line1: '2 Side St',
      line4: 'Reno',
      country: 'US',
    });
    expect(body('paypal')).toMatchObject({
      payment_detail: { payment_method: 'paypal' },
      user: { email: 'jane@example.com' },
      shipping_address: { line1: '1 Main St' },
      billing_address: { first_name: 'Ann' },
    });
    expect(Object.keys(body('paypal', true)).sort()).toEqual(
      [
        'attribution',
        'currency',
        'lines',
        'payment_detail',
        'payment_failed_url',
        'shipping_method',
        'success_url',
        'vouchers',
      ].sort(),
    );
  });

  it('sends the shopper to the gateway as given, else the success page with ref_id and their params', () => {
    const here = new URL('https://shop.test/checkout');
    const params = { utm_source: 'fb', ref_id: 'OLD' };
    expect(
      redirectFor({ ref_id: 'R1', payment_complete_url: 'https://pay.test/3ds?sig=1' }, '/thanks', here, params),
    ).toBe('https://pay.test/3ds?sig=1');
    expect(redirectFor({ ref_id: 'R1' }, '/thanks', here, params)).toBe(
      'https://shop.test/thanks?ref_id=R1&utm_source=fb',
    );
    expect(redirectFor({ ref_id: 'R1' }, undefined, here, {})).toBe(
      'https://shop.test/checkout/confirmation/?ref_id=R1',
    );
  });

  it('keeps the form for the tab, without card data', async () => {
    const session = new MemoryStorage();
    const first = await setup({ session });
    first.fill({ email: 'jane@example.com', line1: '1 Main St' });
    first.checkout.setPaymentMethod('klarna');
    const next = await setup({ session });
    expect(next.engine.getState().checkout).toMatchObject({
      fields: { email: 'jane@example.com', line1: '1 Main St' },
      paymentMethod: 'klarna',
    });
  });

  it('keeps the step each page showed for the tab, and starts over after a paid order', async () => {
    const session = new MemoryStorage();
    const first = await setup({ session });
    await first.engine.cart.addItem(1);
    await first.checkout.loadCountries();
    first.fill(SHIPPING);
    first.checkout.setStep(1, '/information/');
    expect(first.checkout.nextStep()).toBe(true);
    const next = await setup({ session });
    expect(next.engine.getState().checkout).toMatchObject({ step: 2, steps: { '/information/': 1 } });
    next.checkout.setStep(2, '/shipping/');
    next.checkout.setStep(1, '/information/');
    expect(next.engine.getState().checkout!.steps).toEqual({ '/information/': 1, '/shipping/': 2 });
    await next.checkout.placeOrder({ ...URLS, tokenize: async () => 'tok' });
    expect((await setup({ session })).engine.getState().checkout!.steps).toBeUndefined();
  });

  it('offers the campaign’s countries and opens on the stored, linked, located, US or first one', async () => {
    const offered = {
      available_shipping_countries: [
        { code: 'GB', label: 'UK' },
        { code: 'US', label: 'USA' },
      ],
    };
    const campaign = Promise.resolve({ ...(await import('../../fixtures/campaign')).campaign, ...offered });
    const located = await setup({ campaign });
    await located.checkout.loadCountries();
    expect(located.engine.getState().checkout!.countries.map((c) => c.code)).toEqual(['US', 'GB']);
    expect(located.engine.getState().checkout!.fields.country).toBe('GB');
    expect(located.rules.calls.filter((c) => c.includes('/countries/GB'))).toEqual([]);

    const linked = await setup({ campaign, params: { country: 'us' } });
    await linked.checkout.loadCountries();
    expect(linked.engine.getState().checkout!.fields.country).toBe('US');
    expect(linked.rules.calls.some((c) => c.includes('/v1/geo'))).toBe(false);

    const down = await setup({ campaign, rulesDown: true });
    await down.checkout.loadCountries(['GB']);
    expect(down.engine.getState().checkout!.countries).toEqual([{ code: 'GB', name: 'UK' }]);
    expect(down.engine.getState().checkout!.rulesDown).toBe(true);
  });

  it('checks a field when it is left, clears it when typed in, and checks phone and postcode remotely', async () => {
    const { engine, checkout, fill } = await setup();
    await checkout.loadCountries();
    checkout.setField('country', 'US');
    await flush();
    checkout.setField('postcode', '123');
    await checkout.leave('postcode');
    await checkout.leave('line1');
    expect(engine.getState().checkout!.errors).toEqual({ postcode: { code: 'invalid' } });
    checkout.setField('postcode', '10001');
    expect(engine.getState().checkout!.errors).toEqual({});
    fill({ state: 'CA', phone_number: '(415) 555-2671' });
    await Promise.all([checkout.leave('state'), checkout.leave('phone_number')]);
    expect(engine.getState().checkout).toMatchObject({
      phones: { phone_number: { value: '+14155552671', country: 'US' } },
      errors: { postcode: { code: 'not_in_state', message: 'Enter a valid ZIP Code for California', warning: true } },
    });
  });

  it('forgets the state when the country changes', async () => {
    const { engine, fill } = await setup();
    fill({ country: 'US', state: 'CA' });
    fill({ country: 'GB' });
    expect(engine.getState().checkout!.fields).toMatchObject({ country: 'GB', state: '' });
  });

  it('saves the prospect once, when the email and both names are in, then reports contact changes', async () => {
    const session = new MemoryStorage();
    const { checkout, fill, posts, engine } = await setup({ session });
    const saved = vi.fn();
    const updated = vi.fn();
    engine.on('user.created', (e) => saved(e.data));
    engine.on('user.updated', (e) => updated(e.data));
    fill({ email: 'jane@example.com', first_name: 'J', last_name: 'Doe' });
    await checkout.leave('last_name');
    expect(posts('/carts/')).toHaveLength(0);
    checkout.setField('first_name', 'Jane');
    checkout.setField('last_name', 'Does');
    expect(posts('/carts/')).toHaveLength(0);
    await checkout.leave('last_name');
    expect(posts('/carts/')).toHaveLength(1);
    expect(posts('/carts/')[0]!.body).toMatchObject({ user: { email: 'jane@example.com', first_name: 'Jane' } });
    const user = {
      email: 'jane@example.com',
      first_name: 'Jane',
      last_name: 'Does',
      accepts_marketing: true,
      language: 'en',
      ip: '203.0.113.7',
      user_agent: 'Mozilla/5.0 (test)',
    };
    expect(saved).toHaveBeenCalledWith(user);
    expect(engine.getState().checkout?.openCart).toEqual(OPEN_CART);
    await checkout.leave('last_name');
    checkout.setField('email', 'jane@');
    await checkout.leave('email');
    expect(updated).not.toHaveBeenCalled();
    const next = await setup({ session });
    expect(next.engine.cart.currentCheckout().user).toEqual(user);
    const updates = vi.fn();
    next.engine.on('cart.updated', (e) => updates(e.data));
    await next.engine.cart.addItem(2);
    expect(updates.mock.calls[0]![0]).not.toHaveProperty('user');
    next.engine.on('user.updated', (e) => updated(e.data));
    next.checkout.setField('email', 'jane@example.org');
    await next.checkout.leave('email');
    expect(next.posts('/carts/')).toHaveLength(0);
    expect(updated).toHaveBeenCalledExactlyOnceWith({ ...user, email: 'jane@example.org' });
  });

  it('saves the lead on the email, the phone, both, the first field or never, as data-next-lead says', async () => {
    const created = async (lead: Lead, fields: Record<string, string>, leave: string) => {
      const { engine, checkout, fill, posts } = await setup({ lead });
      const users: unknown[] = [];
      engine.on('user.created', (e) => users.push(e.data));
      await engine.cart.addItem(1);
      fill({ country: 'US', ...fields });
      await checkout.leave(leave);
      return { users, body: posts('/carts/')[0]?.body.user };
    };
    const named = { first_name: 'Jane', last_name: 'Doe' };
    const email = { ...named, email: 'jane@example.com' };
    const phone = { ...named, phone_number: '(415) 555-2671' };

    expect((await created('email', email, 'last_name')).body).toMatchObject({ email: 'jane@example.com' });
    expect((await created('phone', email, 'last_name')).users).toEqual([]);
    const byPhone = await created('phone', phone, 'phone_number');
    expect(byPhone.body).toMatchObject({ phone_number: '+14155552671' });
    expect(byPhone.body).not.toHaveProperty('email');
    expect(byPhone.users).toMatchObject([{ first_name: 'Jane', phone: '+14155552671' }]);
    expect((await created('email+phone', email, 'last_name')).users).toEqual([]);
    expect((await created('email+phone', { ...email, ...phone }, 'phone_number')).users).toHaveLength(1);
    expect((await created('formStart', { first_name: 'J' }, 'first_name')).body).toMatchObject({ first_name: 'J' });
    expect((await created('off', { ...email, ...phone }, 'phone_number')).users).toEqual([]);
  });

  it('reports begin once, the address when it is valid then each change, and each change of payment method', async () => {
    const { engine, checkout, fill } = await setup();
    const seen: string[] = [];
    engine.on('*', (e) => /^(checkout|address|payment)\./.test(e.name) && seen.push(e.name));
    checkout.begin();
    await engine.cart.addItem(1);
    checkout.begin();
    await checkout.loadCountries();
    fill({ ...SHIPPING, postcode: '9021' });
    await checkout.leave('postcode');
    expect(seen).toEqual(['checkout.started']);
    fill({ postcode: '90210' });
    await checkout.leave('postcode');
    await checkout.leave('city');
    fill({ city: 'Dallas' });
    await checkout.leave('city');
    checkout.setPaymentMethod('paypal');
    checkout.setPaymentMethod('paypal');
    checkout.paymentReady();
    expect(seen).toEqual(['checkout.started', 'address.entered', 'address.updated', 'payment.selected']);
    expect(engine.getState().checkout!.cardReady).toBe(true);
  });

  it('reports the billing address once it is valid, only when it differs from the shipping address', async () => {
    const { engine, checkout, fill } = await setup();
    const seen: unknown[] = [];
    engine.on('address.entered', (e) => seen.push(e.data));
    await engine.cart.addItem(1);
    checkout.begin();
    await checkout.loadCountries();
    fill(SHIPPING);
    await checkout.leave('city');
    const billing = { first_name: 'Ann', last_name: 'Lee', line1: '2 Side St', city: 'Reno', state: 'NY' };
    fill({
      billing_country: 'US',
      ...Object.fromEntries(Object.entries(billing).map(([k, v]) => [`billing_${k}`, v])),
    });
    fill({ billing_postcode: '89501' });
    await checkout.leave('billing_postcode');
    const { email: _, ...address } = SHIPPING;
    expect(seen).toEqual([{ ...address, type: 'shipping' }]);
    checkout.setSameAsShipping(false);
    const billed = { ...billing, postcode: '89501', country: 'US' };
    expect(seen).toEqual([
      { ...address, type: 'shipping' },
      { ...billed, type: 'billing' },
    ]);
    expect(engine.cart.currentCheckout()).toMatchObject({ shipping_address: address, billing_address: billed });
    checkout.setSameAsShipping(true);
    expect(engine.cart.currentCheckout().billing_address).toBeUndefined();
  });

  it('reports each address once per tab: its changes on later pages, and again after a paid order', async () => {
    const session = new MemoryStorage();
    const page = async () => {
      const made = await setup({ session });
      const seen: string[] = [];
      made.engine.on('*', (e) => e.name.startsWith('address.') && seen.push(e.name));
      await made.engine.cart.addItem(1);
      made.checkout.begin();
      await made.checkout.loadCountries();
      return { ...made, seen };
    };
    const first = await page();
    first.fill(SHIPPING);
    await first.checkout.leave('city');
    const next = await page();
    await next.checkout.leave('city');
    expect(next.seen).toEqual([]);
    next.fill({ city: 'Dallas' });
    await next.checkout.leave('city');
    expect(next.seen).toEqual(['address.updated']);
    await next.checkout.placeOrder({ ...URLS, tokenize: async () => 'tok' });
    const after = await page();
    after.fill(SHIPPING);
    await after.checkout.leave('city');
    expect([first.seen, after.seen]).toEqual([['address.entered'], ['address.entered']]);
  });

  it('reports a phone change as an address update once the number is valid, for either address', async () => {
    const { engine, checkout, fill } = await setup();
    const updated: unknown[] = [];
    engine.on('address.updated', (e) => updated.push(e.data));
    await engine.cart.addItem(1);
    checkout.begin();
    fill(SHIPPING);
    await flush();
    checkout.setField('phone_number', '(415) 555-267');
    await checkout.leave('phone_number');
    expect(updated).toEqual([]);
    checkout.setField('phone_number', '(415) 555-2671');
    await checkout.leave('phone_number');
    checkout.setSameAsShipping(false);
    const billing = {
      first_name: 'Ann',
      last_name: 'Lee',
      line1: '2 Side St',
      city: 'Reno',
      state: 'NY',
      postcode: '89501',
    };
    fill(Object.fromEntries(Object.entries(billing).map(([k, v]) => [`billing_${k}`, v])));
    await checkout.leave('billing_postcode');
    checkout.setField('billing_phone_number', '4155552671');
    await checkout.leave('billing_phone_number');
    const { email: _, ...address } = SHIPPING;
    expect(updated).toEqual([
      { ...address, phone: '+14155552671', type: 'shipping' },
      { ...billing, country: 'US', phone: '+14155552671', type: 'billing' },
    ]);
  });

  it('reads the phone against a new country before reporting the address', async () => {
    const { engine, checkout, fill } = await setup();
    const updated: unknown[] = [];
    engine.on('address.updated', (e) => updated.push(e.data));
    await engine.cart.addItem(1);
    checkout.begin();
    fill({ ...SHIPPING, phone_number: '+1 415 555 2671' });
    await checkout.leave('phone_number');
    checkout.setField('country', 'TH');
    await flush();
    await checkout.leave('line1');
    const { first_name, last_name, line1, city } = SHIPPING;
    expect(updated).toEqual([
      { first_name, last_name, line1, city, country: 'TH', phone: '+14155552671', type: 'shipping' },
    ]);
  });

  it('says whether each submit passed its checks, and why an order the server refused failed', async () => {
    const answers = [
      json({ payment_response_code: '51', payment_details: 'Insufficient funds' }, 400),
      json({ message: 'Card expired' }, 400),
      json({}, 502),
    ];
    const { engine, checkout, fill } = await setup({ api: { order: () => answers.shift()! } });
    const submitted: unknown[] = [];
    const seen: string[] = [];
    const failed: unknown[] = [];
    engine.on('checkout.submitted', (e) => submitted.push([e.data.valid, Object.keys(e.data.errors)]));
    engine.on('*', (e) => /^(sdk\.error|checkout\.failed|order\.)/.test(e.name) && seen.push(e.name));
    engine.on('checkout.failed', (e) => failed.push(e.data));
    await engine.cart.addItem(1);
    checkout.begin();
    await checkout.loadCountries();
    checkout.setField('email', 'jane@');
    await checkout.placeOrder({ ...URLS, tokenize: async () => 'tok' });
    fill(SHIPPING);
    for (let i = 0; i < 3; i++) await checkout.placeOrder({ ...URLS, tokenize: async () => 'tok' });
    expect(submitted).toEqual([
      [false, expect.arrayContaining(['email'])],
      [true, []],
      [true, []],
      [true, []],
    ]);
    expect(seen).toEqual([
      'sdk.error',
      'checkout.failed',
      'sdk.error',
      'checkout.failed',
      'sdk.error',
      'checkout.failed',
    ]);
    expect(failed[0]).toMatchObject({
      id: engine.getState().checkout!.id,
      cart: { lines: [{ package_id: 1, quantity: 1 }] },
      payment_method: 'card_token',
      error: { code: 'declined', status: 400, message: 'Insufficient funds', decline_code: '51' },
    });
    expect(failed.map((f) => (f as { error: unknown }).error)).toEqual([
      expect.anything(),
      { code: 'rejected', status: 400, message: 'Card expired' },
      { code: 'server', status: 502, message: expect.stringContaining('502') },
    ]);
  });

  it('reports shipping once the fields the country requires are valid, for a country with no city', async () => {
    const { engine, checkout, fill } = await setup();
    const seen: string[] = [];
    engine.on('address.entered', (e) => seen.push(e.name));
    await engine.cart.addItem(1);
    checkout.begin();
    checkout.setField('country', 'SG');
    await flush();
    fill({ first_name: 'Jane', last_name: 'Doe', line1: '1 Raffles Pl' });
    await checkout.leave('line1');
    expect(seen).toEqual([]);
    fill({ postcode: '048616' });
    await checkout.leave('postcode');
    expect(seen).toEqual(['address.entered']);
  });

  it('shows the card message and warns the author when a card order has no card form', async () => {
    const { engine, checkout, fill, posts } = await setup();
    const warn = vi.spyOn(engine.log, 'warn');
    await engine.cart.addItem(1);
    fill(SHIPPING);
    await flush();
    expect(await checkout.placeOrder({ ...URLS })).toBeUndefined();
    expect(engine.getState().checkout?.errors.form).toEqual({ code: 'card' });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('payment_env_key'));
    expect(posts('/orders/')).toHaveLength(0);
  });

  it('stops before posting when the form is incomplete, and lets the shopper fix it', async () => {
    const { engine, checkout, posts } = await setup();
    await engine.cart.addItem(1);
    checkout.setField('email', 'jane@');
    expect(await checkout.placeOrder({ ...URLS, tokenize: async () => 'tok' })).toBeUndefined();
    expect(posts('/orders/')).toHaveLength(0);
    expect(engine.getState().checkout).toMatchObject({ status: 'idle', errors: { email: { code: 'invalid' } } });
    await engine.cart.addItem(2);
    expect(engine.cart.lines()).toHaveLength(2);
  });

  it('places one order at a time with a frozen cart, after the running calculation', async () => {
    let calculatingAtPost: boolean | undefined;
    const order = () => {
      calculatingAtPost = made.engine.getState().cart.calculating;
      return json({ ref_id: 'R1' });
    };
    const made = await setup({ api: { delays: [0, 0, 30], order } });
    const { engine, checkout, fill, posts } = made;
    await engine.cart.addItem(1);
    await checkout.loadCountries();
    fill(SHIPPING);
    void engine.cart.addItem(1);
    const tokenize = vi.fn(async () => 'tok_1');
    const first = checkout.placeOrder({ ...URLS, tokenize });
    const second = checkout.placeOrder({ ...URLS, tokenize });
    void engine.cart.addItem(9);
    expect(await second).toBeUndefined();
    expect(await first).toEqual({ ref_id: 'R1' });
    expect(calculatingAtPost).toBe(false);
    expect(tokenize).toHaveBeenCalledTimes(1);
    expect(posts('/orders/')).toHaveLength(1);
    expect(posts('/orders/')[0]!.body.lines).toEqual([{ package_id: 1, quantity: 2 }]);
  });

  it('forgets the cart and form after a paid order, without re-rendering the page', async () => {
    const session = new MemoryStorage();
    const { engine, checkout, fill } = await setup({ session });
    await engine.cart.addItem(1);
    await checkout.loadCountries();
    fill(SHIPPING);
    const rendered = vi.fn();
    const updated = vi.fn();
    let rendersWhenPlaced = -1;
    engine.subscribe(rendered);
    engine.on('cart.updated', updated);
    engine.on('order.created', () => (rendersWhenPlaced = rendered.mock.calls.length));
    await checkout.placeOrder({ ...URLS, tokenize: async () => 'tok' });
    await flush();
    expect(rendersWhenPlaced).toBeGreaterThan(0);
    expect(rendered).toHaveBeenCalledTimes(rendersWhenPlaced);
    expect(updated).not.toHaveBeenCalled();
    checkout.setField('email', 'again@example.com');
    expect(engine.getState().checkout!.fields).toEqual({});
    const next = makeEngine({ session }).engine;
    expect(next.cart.lines()).toEqual([]);
    expect(next.getState().cart.groups).toEqual({});
    const reloaded = await setup({ session });
    expect(reloaded.engine.getState().checkout!.fields).toEqual({});
    expect(reloaded.engine.cart.currentCheckout()).not.toHaveProperty('user');
    expect(reloaded.engine.getState().checkout).toMatchObject({ openCart: undefined, pendingRef: undefined });
  });

  it('sends the order it created with its coupons, and remembers them for the purchase on the next page', async () => {
    const session = new MemoryStorage();
    const { engine, checkout, fill } = await setup({ session });
    const created = vi.fn();
    engine.on('order.created', (e) => created(e.data));
    await engine.cart.addItem(1);
    await engine.cart.applyCoupon('SAVE10');
    await checkout.loadCountries();
    fill(SHIPPING);
    await checkout.placeOrder({ ...URLS, tokenize: async () => 'tok' });
    expect(created).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ ref_id: 'R1', coupons: ['SAVE10'], status_url: 'https://shop.test/status/R1' }),
    );
    const next = makeEngine({ session, fetch: fakeApi().fetch }).engine;
    await next.start();
    next.order = next.attach((ctx) => createOrder(ctx, next.cart));
    const paid = vi.fn();
    next.on('order.paid', (e) => paid(e.data));
    await next.order.load('R1');
    expect(paid).toHaveBeenCalledWith(expect.objectContaining({ coupons: ['SAVE10'] }));
  });

  it('keeps the cart when the gateway takes over, so a failed payment can retry', async () => {
    const session = new MemoryStorage();
    const gateway = () => json({ ref_id: 'R2', payment_complete_url: 'https://pay.test/R2' });
    const { engine, checkout } = await setup({ session, api: { order: gateway } });
    const seen: unknown[] = [];
    engine.on('*', (e) => /^(order|payment)\./.test(e.name) && seen.push([e.name, e.data]));
    await engine.cart.addItem(1);
    checkout.setField('email', 'jane@example.com');
    checkout.setField('first_name', 'Jane');
    checkout.setField('last_name', 'Doe');
    expect(await checkout.placeOrder({ ...URLS, expressMethod: 'paypal' })).toMatchObject({ ref_id: 'R2' });
    expect(seen).toEqual([['payment.redirected', { method: 'paypal', ref_id: 'R2', url: 'https://pay.test/R2' }]]);
    expect(engine.getState().checkout).toMatchObject({ status: 'placed', pendingRef: 'R2' });
    expect(engine.getState().checkout).not.toHaveProperty('failurePath');
    expect(makeEngine({ session }).engine.cart.lines()).toEqual([{ package_id: 1, quantity: 1 }]);
  });

  it('shows what the API said, then lets the shopper try again', async () => {
    const answers = [
      json({ message: ['Card expired', 'Try another'] }, 400),
      json({ payment_response_code: '51', payment_details: 'Insufficient funds' }, 400),
      json({ errors: { email: ['Email taken'], phone: 'Bad phone' } }, 400),
      json({}, 429),
      json({}, 502),
    ];
    const { engine, checkout, fill } = await setup({ api: { order: () => answers.shift()! } });
    await engine.cart.addItem(1);
    await checkout.loadCountries();
    fill(SHIPPING);
    const errors = [];
    for (let i = 0; i < 5; i++) {
      await checkout.placeOrder({ ...URLS, tokenize: async () => 'tok' });
      errors.push(engine.getState().checkout!.errors.form);
    }
    expect(errors).toEqual([
      { code: 'rejected', message: 'Card expired. Try another' },
      { code: 'declined', decline: '51', message: 'Insufficient funds' },
      { code: 'rejected', message: 'Email taken. Bad phone' },
      { code: 'too_many_requests' },
      { code: 'server' },
    ]);
    expect(engine.getState().checkout!.status).toBe('idle');
    expect(engine.getState().cart.frozen).toBe(false);
  });

  it('reports a card that cannot be tokenised without posting the order', async () => {
    const { engine, checkout, fill, posts } = await setup();
    await engine.cart.addItem(1);
    await checkout.loadCountries();
    fill(SHIPPING);
    await checkout.placeOrder({
      ...URLS,
      tokenize: async () => {
        throw new Error('Credit card tokenization timed out');
      },
    });
    expect(engine.getState().checkout!.errors.form).toEqual({
      code: 'card',
      message: 'Credit card tokenization timed out',
    });
    expect(posts('/orders/')).toHaveLength(0);
  });
  it('loads the billing country’s rules after a reload, and keeps a country picked during geo lookup', async () => {
    const session = new MemoryStorage();
    const first = await setup({ session });
    first.fill({ country: 'US' });
    first.checkout.setSameAsShipping(false);
    first.fill({ billing_country: 'GB' });
    const next = await setup({ session });
    await next.checkout.loadCountries();
    expect(Object.keys(next.engine.getState().checkout!.rules).sort()).toEqual(['GB', 'US']);

    const racing = await setup({ geoDelay: 30 });
    const loading = racing.checkout.loadCountries();
    await wait(5);
    racing.fill({ country: 'US', state: 'CA' });
    await loading;
    expect(racing.engine.getState().checkout!.fields).toMatchObject({ country: 'US', state: 'CA' });
  });

  it('reads a list of error objects from the API', async () => {
    const { engine, checkout, fill } = await setup({
      api: { order: () => json({ message: [{ message: 'Address is incomplete' }, 'Try again'] }, 400) },
    });
    await engine.cart.addItem(1);
    await checkout.loadCountries();
    fill(SHIPPING);
    await checkout.placeOrder({ ...URLS, tokenize: async () => 'tok' });
    expect(engine.getState().checkout!.errors.form).toEqual({
      code: 'rejected',
      message: 'Address is incomplete. Try again',
    });
  });
});

describe('one checkout per tab', () => {
  const page = async (session: MemoryStorage, opts: { api?: FakeApiOptions; lines?: boolean } = {}) => {
    const api = fakeApi(opts.api);
    const made = makeEngine({ session, fetch: api.fetch });
    await made.engine.start();
    const pages: unknown[] = [];
    const checkout = made.engine.attach((ctx) =>
      createCheckout(ctx, made.engine.cart, fakeRules().api, { opened: (c) => pages.push(c) }),
    );
    const started: string[] = [];
    made.engine.on('checkout.started', (e) => started.push(e.data.id));
    if (opts.lines !== false && !made.engine.cart.lines().length) await made.engine.cart.addItem(1);
    checkout.begin();
    const fill = (fields: Record<string, string>) =>
      Object.entries(fields).forEach(([k, v]) => checkout.setField(k, v));
    return { ...made, checkout, started, pages, fill, id: () => made.engine.getState().checkout!.id };
  };

  it('starts once across pages, steps and a return from the gateway, and anew after a paid order', async () => {
    const session = new MemoryStorage();
    const gateway = { order: () => json({ ref_id: 'R2', payment_complete_url: 'https://pay.test/R2' }) };
    const first = await page(session);
    expect(first.started).toEqual([first.id()]);
    expect(first.id()).toMatch(/^[0-9a-f]{32}$/);
    first.checkout.setStep(1);
    expect(first.checkout.nextStep()).toBe(false);
    first.fill(SHIPPING);
    await flush();
    expect(first.checkout.nextStep()).toBe(true);

    const step = await page(session, { api: gateway });
    expect(step.started).toEqual([]);
    expect(step.id()).toBe(first.id());
    await step.checkout.placeOrder({ ...URLS, expressMethod: 'paypal' });

    const back = await page(session);
    expect(back.started).toEqual([]);
    expect(back.id()).toBe(first.id());
    await back.checkout.placeOrder({ ...URLS, tokenize: async () => 'tok' });
    expect(back.engine.getState().checkout).toMatchObject({ id: undefined, reported: undefined });

    const after = await page(session);
    expect(after.started).toEqual([after.id()]);
    expect(after.id()).not.toBe(first.id());
    expect([first, step, back, after].map((p) => p.pages.length)).toEqual([1, 1, 1, 1]);
    expect(after.pages[0]).toMatchObject({ cart: { lines: [{ package_id: 1 }] } });
  });

  it('starts when the cart first has lines on a bound form, then reports the address already entered', async () => {
    const { engine, checkout, fill, started, pages } = await page(new MemoryStorage(), { lines: false });
    const seen: string[] = [];
    engine.on('*', (e) => /^(checkout|address)\./.test(e.name) && seen.push(e.name));
    await checkout.loadCountries();
    fill(SHIPPING);
    await checkout.leave('city');
    expect(seen).toEqual([]);
    await engine.cart.addItem(1);
    await engine.cart.addItem(2);
    expect(seen).toEqual(['checkout.started', 'address.entered']);
    expect(started).toHaveLength(1);
    expect(pages).toHaveLength(1);
  });

  it('calls the 0.4.x hook after checkout.started, when the cart fills after the form binds', async () => {
    const { engine } = makeEngine();
    await engine.start();
    const heard: string[] = [];
    const checkout = engine.attach((ctx) =>
      createCheckout(ctx, engine.cart, fakeRules().api, { opened: (c) => heard.push(`0.4.x ${c.id}`) }),
    );
    checkout.begin();
    engine.on('checkout.started', (e) => heard.push(`checkout.started ${e.data.id}`));
    await engine.cart.addItem(1);
    const id = engine.getState().checkout!.id;
    expect(heard).toEqual([`checkout.started ${id}`, `0.4.x ${id}`]);
  });

  it('sends checkout.continued with the step that passed, then moves to the next step', async () => {
    const { engine, checkout, fill } = await page(new MemoryStorage());
    const continued: unknown[] = [];
    engine.on('checkout.continued', (e) => continued.push(e.data));
    checkout.setStep(1);
    expect(checkout.nextStep()).toBe(false);
    expect(continued).toEqual([]);
    expect(engine.getState().checkout!.errors).toHaveProperty('email');
    fill(SHIPPING);
    await flush();
    expect(checkout.nextStep(true)).toBe(false);
    expect(engine.getState().checkout!.errors).toEqual({ phone_number: { code: 'blank' } });
    expect(checkout.nextStep()).toBe(true);
    expect(continued).toHaveLength(1);
    expect(continued[0]).toMatchObject({ id: engine.getState().checkout!.id, cart: { lines: [{ package_id: 1 }] } });
    expect(engine.getState().checkout!.step).toBe(2);
  });

  it('remembers what analytics reported for the checkout until an order is paid', async () => {
    const session = new MemoryStorage();
    const first = await page(session);
    expect(first.checkout.reported('add_shipping_info')).toBe(false);
    first.checkout.markReported('add_shipping_info');
    first.checkout.markReported('add_shipping_info');
    expect(first.engine.getState().checkout!.reported).toEqual(['add_shipping_info']);
    const next = await page(session);
    expect(next.checkout.reported('add_shipping_info')).toBe(true);
    expect(next.checkout.reported('add_payment_info')).toBe(false);
    await next.checkout.loadCountries();
    next.fill(SHIPPING);
    await next.checkout.placeOrder({ ...URLS, tokenize: async () => 'tok' });
    expect((await page(session)).checkout.reported('add_shipping_info')).toBe(false);
  });
});

describe('checkout payment', () => {
  const contact = { email: 'jane@example.com', first_name: 'Jane', last_name: 'Doe' };

  it('checks the whole form for a method chosen in the form and sends the shopper and addresses', async () => {
    const gateway = () => json({ ref_id: 'R2', payment_complete_url: 'https://pay.test/R2' });
    const { engine, checkout, fill, posts } = await setup({ api: { order: gateway } });
    await engine.cart.addItem(1);
    await checkout.loadCountries();
    checkout.setPaymentMethod('paypal');
    fill(contact);
    expect(await checkout.placeOrder({ ...URLS })).toBeUndefined();
    expect(Object.keys(engine.getState().checkout!.errors)).toEqual(expect.arrayContaining(['line1', 'city']));
    expect(posts('/orders/')).toHaveLength(0);
    fill(SHIPPING);
    expect(await checkout.placeOrder({ ...URLS })).toMatchObject({ ref_id: 'R2' });
    expect(posts('/orders/')[0]!.body).toMatchObject({
      payment_detail: { payment_method: 'paypal' },
      user: { email: 'jane@example.com', first_name: 'Jane' },
      shipping_address: { line1: '1 Main St', line4: 'Austin', postcode: '90210' },
      billing_same_as_shipping_address: true,
    });
  });

  it('lets an express button pay without the form, or after the checks nextConfig asks for', async () => {
    const pay = async (expressChecks?: Scope, fields: Record<string, string> = {}) => {
      const { engine, checkout, fill, posts } = await setup();
      await engine.cart.addItem(1);
      await checkout.loadCountries();
      fill(fields);
      const placed = await checkout.placeOrder({ ...URLS, expressMethod: 'apple-pay', expressChecks });
      return { placed, body: posts('/orders/')[0]?.body, errors: engine.getState().checkout!.errors };
    };
    const free = await pay();
    expect(free.placed).toMatchObject({ ref_id: 'R1' });
    expect(free.body.payment_detail).toEqual({ payment_method: 'apple_pay' });
    expect(free.body).not.toHaveProperty('user');
    expect(Object.keys((await pay(['email', 'first_name'], { first_name: 'Jane' })).errors)).toEqual(['email']);
    const listed = await pay(['email', 'first_name'], contact);
    expect(listed.placed).toMatchObject({ ref_id: 'R1' });
    expect(listed.body).not.toHaveProperty('shipping_address');
    expect(Object.keys((await pay('all', contact)).errors)).toEqual(expect.arrayContaining(['line1']));
  });
});

describe('checkout errors', () => {
  it('names the address rules and suggestions that could not load', async () => {
    const api = fakeApi();
    const send = (async (input: RequestInfo | URL, init?: RequestInit) =>
      String(input).includes('/addresses/autocomplete/') ? json({}, 503) : api.fetch(input, init)) as typeof fetch;
    const { engine } = makeEngine({ fetch: send });
    await engine.start();
    const failed: string[] = [];
    engine.on('sdk.error', (e) => failed.push(e.data.action));
    const checkout = engine.attach((ctx) => createCheckout(ctx, engine.cart, fakeRules({ down: true }).api));
    await checkout.loadCountries();
    await checkout.suggestAddresses('1 Main', 'US');
    expect(failed).toEqual(['address.load_rules', 'address.suggest']);
  });
});

describe('checkout phone', () => {
  const reads = (rules: { calls: string[] }) => rules.calls.filter((c) => c.startsWith('POST /v1/validate')).length;

  it('asks i18n-rules once per number and country, however many triggers ask', async () => {
    const { checkout, rules, fill } = await setup();
    fill({ country: 'US', phone_number: '(415) 555-2671' });
    await Promise.all([
      checkout.readPhone('phone_number'),
      checkout.readPhone('phone_number'),
      checkout.leave('phone_number'),
    ]);
    checkout.setField('phone_number', '415 555 2671');
    await checkout.readPhone('phone_number');
    expect(reads(rules)).toBe(1);
  });

  it("shows the service's message only once the shopper leaves the field", async () => {
    const { engine, checkout, fill } = await setup();
    fill({ country: 'US' });
    await flush();
    fill({ phone_number: '(201) 555-0123' });
    await checkout.readPhone('phone_number');
    expect(engine.getState().checkout!.errors).toEqual({});
    await checkout.leave('phone_number');
    expect(engine.getState().checkout!.errors.phone_number).toEqual({
      code: 'invalid',
      message: 'Enter a valid phone number, like (201) 555-0123',
      warning: true,
    });
    checkout.setField('phone_number', '(201) 555-012');
    expect(engine.getState().checkout!.errors).toEqual({});
  });

  it('keeps its own loose check for a number too short to be one', async () => {
    const { engine, checkout, fill } = await setup();
    await checkout.loadCountries();
    fill({ country: 'US', phone_number: '555-2671' });
    await flush();
    await checkout.leave('phone_number');
    expect(engine.getState().checkout!.errors.phone_number).toEqual({ code: 'invalid' });
  });

  it('reads the number again when the address country changes', async () => {
    const { engine, checkout, fill } = await setup();
    fill({ country: 'US', phone_number: '081 234 5678' });
    await checkout.leave('phone_number');
    expect(engine.getState().checkout!.errors.phone_number?.warning).toBe(true);
    checkout.setField('country', 'TH');
    expect(engine.getState().checkout!.errors.phone_number).toBeUndefined();
    await flush();
    expect(engine.getState().checkout!.phones.phone_number).toMatchObject({ value: '+66812345678', country: 'TH' });
  });

  it('forgets the E.164 number when its digits change, not when only its spacing does', async () => {
    const { engine, checkout, fill } = await setup();
    fill({ country: 'US', phone_number: '4155552671' });
    await checkout.readPhone('phone_number');
    checkout.setField('phone_number', '(415) 555-2671');
    expect(engine.getState().checkout!.phones.phone_number?.value).toBe('+14155552671');
    checkout.setField('phone_number', '(415) 555-267');
    expect(engine.getState().checkout!.phones).toEqual({});
  });

  it('writes a read number the way its country does: at home nationally, from abroad internationally', async () => {
    const { engine, checkout, fill } = await setup();
    fill({ country: 'US', phone_number: '4155552671' });
    await checkout.readPhone('phone_number');
    checkout.writePhone('phone_number');
    expect(engine.getState().checkout!.fields.phone_number).toBe('(415) 555-2671');
    fill({ phone_number: '+66812345678' });
    await checkout.readPhone('phone_number');
    checkout.writePhone('phone_number');
    expect(engine.getState().checkout!.fields.phone_number).toBe('+66 81 234 5678');
    expect(engine.getState().checkout!.phones.phone_number).toMatchObject({ value: '+66812345678', country: 'TH' });
  });

  it('reads a number typed with Thai digits and sends it in E.164', async () => {
    const { engine, checkout, fill, posts } = await setup();
    await engine.cart.addItem(1);
    fill({ ...SHIPPING, country: 'TH', state: '', postcode: '', phone_number: '๐๘๑ ๒๓๔ ๕๖๗๘' });
    await flush();
    expect(await checkout.placeOrder({ ...URLS, tokenize: async () => 'tok_1' })).toMatchObject({ ref_id: 'R1' });
    expect(posts('/orders/')[0]!.body.shipping_address.phone_number).toBe('+66812345678');
  });

  it('reads the billing phone against the billing country', async () => {
    const { engine, checkout, fill } = await setup();
    fill({ country: 'US' });
    checkout.setSameAsShipping(false);
    fill({ billing_country: 'TH', billing_phone_number: '0812345678' });
    await checkout.leave('billing_phone_number');
    expect(engine.getState().checkout!.phones.billing_phone_number).toMatchObject({
      value: '+66812345678',
      country: 'TH',
    });
  });
});

describe('checkout country rules', () => {
  it('places a Singapore order with no city, and drops a postcode Hong Kong does not have', async () => {
    const { engine, checkout, fill, posts } = await setup();
    await engine.cart.addItem(1);
    fill({ ...SHIPPING, country: 'SG', city: '', state: '', postcode: '018956' });
    await flush();
    expect(await checkout.placeOrder({ ...URLS, tokenize: async () => 'tok_1' })).toMatchObject({ ref_id: 'R1' });
    expect(posts('/orders/')[0]!.body.shipping_address).toMatchObject({ country: 'SG', postcode: '018956', line4: '' });

    const hk = await setup();
    await hk.engine.cart.addItem(1);
    hk.fill({ ...SHIPPING, country: 'US', postcode: '90210' });
    hk.fill({ country: 'HK', city: 'Kowloon', state: 'Kowloon City' });
    await flush();
    expect(await hk.checkout.placeOrder({ ...URLS, tokenize: async () => 'tok_1' })).toMatchObject({ ref_id: 'R1' });
    expect(hk.posts('/orders/')[0]!.body.shipping_address).not.toHaveProperty('postcode');
  });
});
