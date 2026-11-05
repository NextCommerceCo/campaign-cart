import { describe, expect, it, vi } from 'vitest';
import { createCheckout } from '../../src/checkout/state/checkout';
import { ApiError } from '../../src/engine/api';
import { createOrder } from '../../src/order/state';
import { fakeApi } from '../fixtures/api';
import { flush, makeEngine, wait } from '../fixtures/engine';
import { campaign } from '../fixtures/campaign';
import { fakeRules } from '../fixtures/rules';
import { MemoryStorage } from '../fixtures/storage';

const toggle = (id: number) => ({ lines: [{ packageId: id, quantity: 1 }], vouchers: [] });

describe('Engine', () => {
  it('runs headless', () => {
    expect(typeof (globalThis as { document?: unknown }).document).toBe('undefined');
  });
  it('adopts the loader’s campaign request', async () => {
    const { engine } = makeEngine();
    const names: string[] = [];
    engine.on('*', (e) => names.push(e.name));
    await engine.start();
    expect(engine.getState().campaign?.name).toBe('Olympus');
    expect(names).toEqual(['campaign.loaded', 'sdk.ready']);
  });
  it('is ready once: from the snapshot before the campaign request returns, else after it', async () => {
    const local = new MemoryStorage();
    await makeEngine({ local }).engine.start();
    let answer!: (c: typeof campaign) => void;
    const cached = makeEngine({ local, campaign: new Promise((r) => (answer = r)) }).engine;
    const ready = vi.fn();
    cached.on('sdk.ready', ready);
    const started = cached.start();
    expect(ready).toHaveBeenCalledTimes(1);
    answer(campaign);
    await started;
    expect(ready).toHaveBeenCalledTimes(1);

    const failed = makeEngine({ campaign: Promise.reject(new Error('down')) }).engine;
    failed.on('sdk.ready', ready);
    await failed.start();
    expect(ready).toHaveBeenCalledTimes(1);
  });
  it('clears saved state on reset and starts the cart from ?forcePackageId', async () => {
    const local = new MemoryStorage();
    const session = new MemoryStorage();
    const first = makeEngine({ local, session }).engine;
    await first.start();
    await first.cart.addItem(1);
    const reset = makeEngine({ local, session, reset: true }).engine;
    expect(reset.getState().campaign).toBeUndefined();
    expect(reset.cart.lines()).toEqual([]);
    await first.cart.addItem(1);
    const forced = makeEngine({ local, session, params: { forcePackageId: '2:3' } }).engine;
    expect(forced.cart.lines()).toEqual([{ package_id: 2, quantity: 3 }]);
  });
  it('reports a failed campaign request as an error event', async () => {
    const { engine } = makeEngine({ campaign: Promise.reject(new Error('down')) });
    const errors: unknown[] = [];
    engine.on('sdk.error', (e) => errors.push(e.data));
    await engine.start();
    expect(errors).toEqual([{ action: 'campaign.load', code: 'network', message: 'down' }]);
  });
  it('reports a declined payment with the gateway’s decline code', () => {
    const { engine } = makeEngine();
    const errors: unknown[] = [];
    engine.on('sdk.error', (e) => errors.push(e.data));
    const declined = new ApiError('POST /orders/R1/upsells/ → 400', 400, {
      payment_response_code: '51',
      payment_details: 'Insufficient funds',
    });
    engine.attach((ctx) => ctx.fail('upsell.add', declined));
    expect(errors).toEqual([
      {
        action: 'upsell.add',
        code: 'declined',
        status: 400,
        message: 'POST /orders/R1/upsells/ → 400',
        decline_code: '51',
      },
    ]);
  });
  it('is ready with what the page shows then', async () => {
    const session = new MemoryStorage();
    const first = makeEngine({ session }).engine;
    await first.start();
    await first.cart.addItem(2);
    const { engine } = makeEngine({ session });
    const ready = vi.fn();
    engine.on('sdk.ready', (e) => ready(e.data));
    await engine.start();
    expect(ready).toHaveBeenCalledWith({
      campaign: { id: 1310, name: 'Olympus', currency: 'USD', language: 'en' },
      cart: expect.objectContaining({ lines: [expect.objectContaining({ package_id: 2, quantity: 1 })] }),
      selectors: [],
    });
  });
  it('shows the checkout and the order a page loaded as their events carry them', async () => {
    const { engine } = makeEngine();
    expect(engine.snapshot()).toEqual({ cart: { lines: [], coupons: [], quantity: 0 }, selectors: [] });
    await engine.start();
    await engine.cart.addItem(1);
    const sent: Record<string, unknown> = {};
    engine.on('*', (e) => (sent[e.name] = e.data));
    engine.attach((ctx) => createCheckout(ctx, engine.cart, fakeRules().api)).begin();
    const order = engine.attach((ctx) => createOrder(ctx, engine.cart));
    engine.attach((ctx) => ctx.update('order', { coupon: { refId: 'R1', code: 'SAVE10', codes: ['SAVE10'] } }));
    await order.load('R1');
    const snapshot = engine.snapshot();
    expect(snapshot).toMatchObject({ checkout: sent['checkout.started'], order: sent['order.loaded'] });
    expect(snapshot.order).toMatchObject({ ref_id: 'R1', coupons: ['SAVE10'] });
  });
  it('prices a saved cart with the campaign copy when the campaign request fails', async () => {
    const local = new MemoryStorage();
    const session = new MemoryStorage();
    const first = makeEngine({ local, session }).engine;
    await first.start();
    await first.cart.addItem(2);
    const second = makeEngine({ local, session, campaign: Promise.reject(new Error('down')) }).engine;
    vi.spyOn(second.log, 'error').mockImplementation(() => {});
    await second.start();
    await second.cart.settled();
    expect(second.getState().cart.summary?.lines).toHaveLength(1);
  });

  it('restores the cart from this tab and the campaign snapshot on the next page', async () => {
    const local = new MemoryStorage();
    const session = new MemoryStorage();
    const first = makeEngine({ local, session }).engine;
    await first.start();
    await first.cart.addItem(2);
    const second = makeEngine({ local, session }).engine;
    expect(second.getState().campaign).toBeDefined();
    expect(second.getState().campaign?.name).toBe('Olympus');
    expect(second.cart.lines()).toEqual([{ package_id: 2, quantity: 1 }]);
    expect(second.getState().cart.summary).toBeUndefined();
  });
  it('starts a new tab with an empty cart', async () => {
    const local = new MemoryStorage();
    const first = makeEngine({ local }).engine;
    await first.cart.addItem(2);
    const newTab = makeEngine({ local }).engine;
    expect(newTab.cart.lines()).toEqual([]);
  });
  it('does not restore a campaign snapshot older than 10 minutes', async () => {
    const local = new MemoryStorage();
    let now = 0;
    await makeEngine({ local, now: () => now }).engine.start();
    now = 11 * 60 * 1000;
    expect(makeEngine({ local, now: () => now }).engine.getState().campaign).toBeUndefined();
  });
  it('keeps the snapshot in sessionStorage when localStorage is full, and reads it back', async () => {
    const local = new MemoryStorage('after-probe');
    const session = new MemoryStorage();
    const first = makeEngine({ local, session });
    const degraded: unknown[] = [];
    first.engine.on('sdk.error', (e) => degraded.push(e.data));
    await first.engine.start();
    expect(degraded).toEqual([{ action: 'storage.write', code: 'unavailable', message: 'local: QuotaExceededError' }]);
    expect(makeEngine({ local, session }).engine.getState().campaign).toBeDefined();
  });
  it('reports blocked storage at boot to late subscribers', () => {
    const { engine } = makeEngine({ session: new MemoryStorage('always') });
    const degraded: unknown[] = [];
    engine.on('sdk.error', (e) => degraded.push(e.data), { replay: true });
    expect(degraded).toEqual([
      { action: 'storage.write', code: 'unavailable', message: 'session: unavailable' },
      { action: 'storage.write', code: 'unavailable', message: 'local: unavailable' },
    ]);
  });
  it('keeps URL params for the session but not one-shot ones', () => {
    const session = new MemoryStorage();
    makeEngine({ session, params: { utm_source: 'fb', banner: 'n', reset: '1' } });
    const next = makeEngine({ session, params: { step: '2' } }).engine;
    expect(next.getState().visit.params).toEqual({ utm_source: 'fb', banner: 'n', step: '2' });
  });

  it('notifies subscribers once per tick, after every change', async () => {
    const { engine } = makeEngine();
    const notified = vi.fn();
    engine.subscribe(notified);
    void engine.cart.addItem(1);
    void engine.cart.applyCoupon('SAVE10');
    engine.selectors.register('main', [{ id: 'one', lines: [], vouchers: [] }], 'select');
    expect(notified).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(notified).toHaveBeenCalledTimes(1);
  });

  it('does not extend the snapshot lifetime by restoring it', async () => {
    const local = new MemoryStorage();
    let now = 0;
    await makeEngine({ local, now: () => now }).engine.start();
    now = 9 * 60 * 1000;
    expect(makeEngine({ local, now: () => now }).engine.getState().campaign).toBeDefined();
    now = 11 * 60 * 1000;
    expect(makeEngine({ local, now: () => now }).engine.getState().campaign).toBeUndefined();
  });

  it('never keeps ref_id beyond the page that has it', () => {
    const session = new MemoryStorage();
    makeEngine({ session, params: { ref_id: 'R1', utm_source: 'fb' } });
    const next = makeEngine({ session }).engine;
    expect(next.getState().visit.params).toEqual({ utm_source: 'fb' });
  });

  it('counts exit-intent popups for the tab', () => {
    const session = new MemoryStorage();
    const first = makeEngine({ session }).engine;
    first.visit.noteExitIntentShown();
    const next = makeEngine({ session }).engine;
    expect(next.getState().visit.exitIntentShown).toBe(1);
  });

  it('keeps a countdown running across pages of the tab, and starts it over once it has run out', () => {
    const session = new MemoryStorage();
    let now = 1000;
    expect(makeEngine({ session, now: () => now }).engine.visit.timerStart('offer', 60_000)).toBe(1000);
    now = 31_000;
    expect(makeEngine({ session, now: () => now }).engine.visit.timerStart('offer', 60_000)).toBe(1000);
    now = 61_000;
    expect(makeEngine({ session, now: () => now }).engine.visit.timerStart('offer', 60_000)).toBe(1000);
    expect(makeEngine({ session, now: () => now }).engine.visit.timerStart('offer', 60_000)).toBe(61_000);
  });

  it('stays in debug mode for the tab across storage scopes until ?debug=0', () => {
    const session = new MemoryStorage();
    const first = makeEngine({ session, debug: true }).engine;
    expect([first.debug, first.log.level]).toEqual([true, 'debug']);
    const next = makeEngine({ session, storagePrefix: 'next:other' }).engine;
    expect([next.debug, next.log.level]).toEqual([true, 'debug']);
    expect(makeEngine({ session, debug: false }).engine.debug).toBe(false);
    expect(makeEngine({ session }).engine.debug).toBe(false);
    expect([...session.data.keys()].filter((k) => k.startsWith('next:debug'))).toEqual([]);
  });

  it('logs every API call by method, path and status, without the query or body', async () => {
    const { engine } = makeEngine({
      fetch: (url) => Promise.resolve(new Response('{}', { status: String(url).includes('/orders/') ? 500 : 200 })),
    });
    await engine.attach((ctx) => ctx.api.autocomplete('1 Main St', 'US'));
    await engine.attach((ctx) => ctx.api.createOrder({} as never)).catch(() => {});
    const calls = engine.log.entries().filter((e) => e.message.startsWith('api '));
    expect(calls.map((e) => e.message.replace(/\d+ ms/, 'N ms'))).toEqual([
      'api GET /api/v1/addresses/autocomplete/ → 200 in N ms',
      'api POST /api/v1/orders/ → 500 in N ms',
    ]);
    expect(calls.every((e) => e.level === 'debug' && e.data === undefined)).toBe(true);
  });

  it('gives events a short context: the page, campaign, session, flat attribution and browser', async () => {
    const visit = {
      landingPage: 'https://shop.test/olympus/?email=jane@x.com',
      referrer: 'https://www.facebook.com/',
      device: 'test',
      deviceType: 'desktop' as const,
      fbp: 'fb.1.1.123',
    };
    const { engine } = makeEngine({ visit, params: { utm_source: 'facebook', fbclid: 'IwAR0' } });
    await engine.start();
    expect(engine.eventContext()).toEqual({
      page_location: 'https://shop.test/',
      page_title: 'Shop',
      page_referrer: '',
      campaign: { id: 1310, name: 'Olympus', currency: 'USD', language: 'en' },
      session_id: expect.stringMatching(/^[0-9a-f]{32}$/),
      attribution: {
        utm_source: 'facebook',
        funnel: 'Olympus',
        landing_page: 'https://shop.test/olympus/',
        fbclid: 'IwAR0',
        fbp: 'fb.1.1.123',
      },
      browser: { user_agent: 'test', language: 'en-US', device_type: 'desktop' },
    });
  });
});
