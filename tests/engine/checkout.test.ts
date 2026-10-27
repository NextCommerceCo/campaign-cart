import { describe, expect, it, vi } from 'vitest';
import { createCheckout, orderBody, paymentCode, redirectFor } from '../../src/engine/checkout';
import { createOrder } from '../../src/engine/order';
import { fakeApi, type FakeApiOptions, json } from '../fixtures/api';
import { flush, makeEngine, type MakeEngine, wait } from '../fixtures/engine';
import { fakeRules } from '../fixtures/rules';
import { MemoryStorage } from '../fixtures/storage';

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
  opts: MakeEngine & { api?: FakeApiOptions; geo?: string; rulesDown?: boolean; geoDelay?: number } = {},
) {
  const api = fakeApi(opts.api);
  const made = makeEngine({ ...opts, fetch: api.fetch });
  await made.engine.start();
  const rules = fakeRules({ geo: opts.geo, down: opts.rulesDown, geoDelay: opts.geoDelay });
  const checkout = made.engine.attach((ctx) => createCheckout(ctx, made.engine.cart, rules.api));
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

  it('builds the 0.4.x order body, and a short one for express methods', async () => {
    const { engine, checkout, fill } = await setup();
    await engine.cart.addItem(2);
    fill({ ...SHIPPING, line2: 'Apt 4', phone_number: '(415) 555-2671' });
    const body = (method: string) =>
      orderBody(engine.getState(), {
        method,
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
    expect(Object.keys(body('paypal')).sort()).toEqual(
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

  it('offers the campaign’s countries and opens on the stored, linked, located, US or first one', async () => {
    const offered = {
      available_shipping_countries: [
        { code: 'GB', label: 'UK' },
        { code: 'US', label: 'USA' },
      ],
    };
    const campaign = Promise.resolve({ ...(await import('../fixtures/campaign')).campaign, ...offered });
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

  it('saves the prospect once, when the email and both names are in', async () => {
    const session = new MemoryStorage();
    const { checkout, fill, posts, engine } = await setup({ session });
    const saved = vi.fn();
    engine.on('prospect.saved', (e) => saved(e.data));
    fill({ email: 'jane@example.com', first_name: 'J', last_name: 'Doe' });
    await checkout.leave('last_name');
    expect(posts('/carts/')).toHaveLength(0);
    checkout.setField('first_name', 'Jane');
    checkout.setField('last_name', 'Does');
    expect(posts('/carts/')).toHaveLength(0);
    await checkout.leave('last_name');
    expect(posts('/carts/')).toHaveLength(1);
    expect(posts('/carts/')[0]!.body).toMatchObject({ user: { email: 'jane@example.com', first_name: 'Jane' } });
    expect(saved).toHaveBeenCalledWith({
      cart: { id: 7, checkout_url: 'https://shop.test/c/7' },
      email: 'jane@example.com',
    });
    const next = await setup({ session });
    next.checkout.setField('last_name', 'Doe');
    await next.checkout.leave('last_name');
    expect(next.posts('/carts/')).toHaveLength(0);
  });

  it('reports begin, shipping and payment once each', async () => {
    const { engine, checkout, fill } = await setup();
    const seen: string[] = [];
    engine.on('*', (e) => e.name.startsWith('checkout.') && seen.push(e.name));
    checkout.begin();
    await engine.cart.addItem(1);
    checkout.begin();
    fill(SHIPPING);
    fill({ city: 'Dallas' });
    checkout.paymentReady('credit');
    checkout.paymentReady('credit');
    expect(seen).toEqual(['checkout.started', 'checkout.shipping-added', 'checkout.payment-added']);
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
    engine.on('order.placed', () => (rendersWhenPlaced = rendered.mock.calls.length));
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
  });

  it('remembers the coupon of a placed order for its purchase report on the next page, like 0.4.x', async () => {
    const session = new MemoryStorage();
    const { engine, checkout, fill } = await setup({ session });
    await engine.cart.addItem(1);
    await engine.cart.applyCoupon('SAVE10');
    await checkout.loadCountries();
    fill(SHIPPING);
    await checkout.placeOrder({ ...URLS, tokenize: async () => 'tok' });
    const next = makeEngine({ session, fetch: fakeApi().fetch }).engine;
    await next.start();
    next.order = next.attach((ctx) => createOrder(ctx, next.cart));
    const loaded = vi.fn();
    next.on('order.loaded', (e) => loaded(e.data));
    await next.order.load('R1');
    expect(loaded).toHaveBeenCalledWith(expect.objectContaining({ purchase: '1001', coupon: 'SAVE10' }));
  });

  it('keeps the cart when the gateway takes over, so a failed payment can retry', async () => {
    const session = new MemoryStorage();
    const gateway = () => json({ ref_id: 'R2', payment_complete_url: 'https://pay.test/R2' });
    const { engine, checkout } = await setup({ session, api: { order: gateway } });
    await engine.cart.addItem(1);
    checkout.setField('email', 'jane@example.com');
    checkout.setField('first_name', 'Jane');
    checkout.setField('last_name', 'Doe');
    expect(await checkout.placeOrder({ ...URLS, method: 'paypal' })).toMatchObject({ ref_id: 'R2' });
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
