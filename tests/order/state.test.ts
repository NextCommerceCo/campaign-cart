import { describe, expect, it, vi } from 'vitest';
import { createCheckout } from '../../src/checkout/state/checkout';
import { upsellId } from '../../src/engine/order';
import { createOrder, orderValue } from '../../src/order/state';
import { format } from '../../src/engine/format';
import { publicOrder, purchaseId, REPORTED } from '../../src/engine/order';
import type { EngineEvent } from '../../src/engine/events/bus';
import type { CheckoutState } from '../../src/checkout/state/types';
import type { ApiOrderLine } from '../../src/engine/types';
import { fakeApi, type FakeApiOptions, json } from '../fixtures/api';
import { campaign } from '../fixtures/campaign';
import { makeEngine, type MakeEngine } from '../fixtures/engine';
import { ORDER, withUpsell } from '../fixtures/order';
import { fakeRules } from '../fixtures/rules';
import { MemoryStorage } from '../fixtures/storage';

const OFFER = [{ id: 'up', lines: [{ packageId: 2, quantity: 1 }], vouchers: ['UP50'], max: 5 }];

async function setup(opts: MakeEngine & { api?: FakeApiOptions } = {}) {
  const api = fakeApi(opts.api);
  const made = makeEngine({ ...opts, fetch: api.fetch });
  await made.engine.start();
  const order = made.engine.attach((ctx) => createOrder(ctx, made.engine.cart));
  const loaded = vi.fn();
  const paid = vi.fn();
  made.engine.on('order.loaded', (e) => loaded(e.data));
  made.engine.on('order.paid', (e) => paid(e.data));
  const gets = () => api.calls.filter((c) => c.method === 'GET' && c.url.includes('/orders/'));
  const upsells = () => api.calls.filter((c) => c.url.endsWith('/upsells/'));
  const events: EngineEvent[] = [];
  made.engine.on('*', (e) => events.push(e));
  const sent = (name: string) => events.filter((e) => e.name === name).map((e) => e.data);
  return { ...made, api, order, loaded, paid, gets, upsells, events, sent };
}

async function gatewayPending(session: MemoryStorage, checkout: Partial<CheckoutState>) {
  const { engine } = makeEngine({ session });
  await engine.start();
  await engine.cart.addItem(1);
  engine.attach((ctx) => ctx.update('checkout', checkout));
}

const PLAIN = { lines: [{ packageId: 2, quantity: 1 }] };

describe('order', () => {
  it('loads the order once and reuses it in the tab for 15 minutes', async () => {
    const session = new MemoryStorage();
    const first = await setup({ session });
    await first.order.load('R1');
    expect(first.engine.getState().order).toMatchObject({ status: 'ready', order: { number: 1001 } });
    const next = await setup({ session });
    await next.order.load('R1');
    expect(next.gets()).toHaveLength(0);
    expect(next.engine.getState().order?.order?.number).toBe(1001);
  });

  it('shows no order when it cannot load again after 15 minutes', async () => {
    const session = new MemoryStorage();
    const first = await setup({ session });
    await first.order.load('R1');
    const later = await setup({ session, api: { getOrder: () => json({ message: 'down' }, 500) } });
    vi.spyOn(later.engine.log, 'error').mockImplementation(() => {});
    const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 16 * 60 * 1000);
    await later.order.load('R1').finally(() => clock.mockRestore());
    expect(later.engine.getState().order).toMatchObject({ status: 'failed', order: undefined });
  });

  it('sends order.paid once per order, only when paid, and never on the failure landing', async () => {
    const local = new MemoryStorage();
    const first = await setup({ local });
    await first.order.load('R1');
    expect(first.paid).toHaveBeenCalledTimes(1);
    expect(first.paid.mock.calls[0]![0].number).toBe('1001');
    const again = await setup({ local });
    await again.order.load('R1');
    expect(again.loaded).toHaveBeenCalledTimes(1);
    expect(again.paid).not.toHaveBeenCalled();

    const unpaid = await setup({
      api: { getOrder: () => json({ ...ORDER, payment_complete_url: 'https://pay.test' }) },
    });
    await unpaid.order.load('R2');
    expect(unpaid.paid).not.toHaveBeenCalled();
  });

  it('sends no order.paid for an order the checkout already reported paid in this browser', async () => {
    const local = new MemoryStorage();
    const { engine: checkout } = makeEngine({ local });
    checkout.attach((ctx) => ctx.local.set(REPORTED, [purchaseId(ORDER)]));
    const page = await setup({ local });
    await page.order.load('R1');
    expect(page.loaded).toHaveBeenCalledTimes(1);
    expect(page.paid).not.toHaveBeenCalled();
    expect(page.engine.getState().order?.paidOrder).toBeUndefined();
  });

  it('completes the gateway checkout once, right after order.paid, with its id and the cart before it is emptied', async () => {
    const session = new MemoryStorage();
    const local = new MemoryStorage();
    await gatewayPending(session, { id: 'C1', pendingRef: 'R1', paymentMethod: 'card_token', pendingMethod: 'paypal' });
    const page = await setup({ session, local });
    await page.order.load('R1');
    const order = ['order.loaded', 'order.paid', 'checkout.completed'];
    expect(page.events.map((e) => e.name).filter((n) => order.includes(n))).toEqual(order);
    expect(page.sent('checkout.completed')).toEqual([
      expect.objectContaining({
        id: 'C1',
        ref_id: 'R1',
        payment_method: 'paypal',
        cart: expect.objectContaining({ lines: [expect.objectContaining({ package_id: 1, quantity: 1 })] }),
      }),
    ]);
    expect(page.engine.cart.lines()).toEqual([]);

    const reload = await setup({ session, local });
    await reload.order.load('R1');
    expect(reload.sent('checkout.completed')).toEqual([]);

    const unpaid = new MemoryStorage();
    await gatewayPending(unpaid, { id: 'C2', pendingRef: 'R1' });
    const gateway = await setup({
      session: unpaid,
      api: { getOrder: () => json({ ...ORDER, payment_complete_url: 'https://pay.test' }) },
    });
    await gateway.order.load('R1');
    expect(gateway.sent('checkout.completed')).toEqual([]);
  });

  it('sends order.loaded and order.paid with the order itself and the code applied at its checkout', async () => {
    const { engine, order, loaded, paid } = await setup();
    engine.attach((ctx) => ctx.update('order', { coupon: { refId: 'R1', code: 'SAVE10', codes: ['SAVE10'] } }));
    await order.load('R1');
    expect(loaded).toHaveBeenCalledWith(publicOrder(ORDER, ['SAVE10']));
    expect(paid).toHaveBeenCalledWith(publicOrder(ORDER, ['SAVE10']));

    const other = await setup();
    other.engine.attach((ctx) => ctx.update('order', { coupon: { refId: 'R0', code: 'SAVE10', codes: ['SAVE10'] } }));
    await other.order.load('R1');
    expect(other.loaded).toHaveBeenCalledWith(publicOrder(ORDER, []));
  });

  it('sends payment.failed once for the order sent to the gateway, with the method in the URL, without loading it', async () => {
    const session = new MemoryStorage();
    const local = new MemoryStorage();
    await gatewayPending(session, { pendingRef: 'R3', paymentMethod: 'card_token' });
    const params = { payment_failed: 'true', payment_method: 'paypal' };
    const landing = await setup({ session, local, params });
    landing.order.paymentFailed();
    expect(landing.sent('payment.failed')).toEqual([
      { method: 'paypal', ref_id: 'R3', error: { code: 'payment_failed' } },
    ]);
    expect(landing.gets()).toHaveLength(0);
    expect(landing.loaded).not.toHaveBeenCalled();
    expect(landing.engine.cart.lines()).toHaveLength(1);

    const reload = await setup({ session, local, params });
    reload.order.paymentFailed();
    expect(reload.sent('payment.failed')).toEqual([]);
  });

  it('names the saved payment method when the failed payment comes back without one', async () => {
    const session = new MemoryStorage();
    await gatewayPending(session, { pendingRef: 'R3', paymentMethod: 'klarna' });
    const landing = await setup({ session, params: { payment_failed: 'true' } });
    landing.order.paymentFailed();
    expect(landing.sent('payment.failed')).toEqual([
      { method: 'klarna', ref_id: 'R3', error: { code: 'payment_failed' } },
    ]);
  });

  it('names the express button the shopper paid with, not the method picked in the form', async () => {
    const session = new MemoryStorage();
    const api = fakeApi({ order: () => json({ ref_id: 'R5', payment_complete_url: 'https://pay.test/R5' }) });
    const { engine } = makeEngine({ session, fetch: api.fetch });
    await engine.start();
    await engine.cart.addItem(1);
    const checkout = engine.attach((ctx) => createCheckout(ctx, engine.cart, fakeRules().api));
    await checkout.placeOrder({
      expressMethod: 'paypal',
      failureUrl: 'https://shop.test/checkout/',
      pageUrl: 'https://shop.test/checkout/',
    });
    const landing = await setup({ session, params: { payment_failed: 'true', payment_method: 'None' } });
    landing.order.paymentFailed();
    expect(landing.sent('payment.failed')).toEqual([
      { method: 'paypal', ref_id: 'R5', error: { code: 'payment_failed' } },
    ]);
  });

  it('never takes a paid order for a failed payment, whatever the URL says', async () => {
    const page = await setup({ params: { payment_failed: 'true' } });
    await page.order.load('R4');
    expect(page.sent('payment.failed')).toEqual([]);
    expect(page.paid).toHaveBeenCalledTimes(1);
  });

  it('clears only the cart kept for that order’s gateway, and never on the failure landing', async () => {
    const gatewayOrder = async (session: MemoryStorage, failureUrl: string) => {
      const api = fakeApi({ order: () => json({ ref_id: 'R1', payment_complete_url: 'https://pay.test/R1' }) });
      const { engine } = makeEngine({ session, fetch: api.fetch });
      await engine.start();
      await engine.cart.addItem(1);
      const checkout = engine.attach((ctx) => createCheckout(ctx, engine.cart, fakeRules().api));
      ['email', 'first_name', 'last_name'].forEach((f, i) =>
        checkout.setField(f, ['jane@example.com', 'Jane', 'Doe'][i]!),
      );
      await checkout.placeOrder({ expressMethod: 'paypal', failureUrl, pageUrl: 'https://shop.test/checkout/' });
    };

    const paid = new MemoryStorage();
    await gatewayOrder(paid, 'https://shop.test/checkout/?payment_failed=true');
    const next = await setup({ session: paid });
    expect(next.engine.cart.lines()).toHaveLength(1);
    await next.order.load('R1');
    expect(next.engine.cart.lines()).toEqual([]);

    const failed = new MemoryStorage();
    await gatewayOrder(failed, 'https://shop.test/oops/');
    const unpaid = (ref: string) => json({ ...ORDER, ref_id: ref, payment_complete_url: `https://pay.test/${ref}` });
    const landing = await setup({ session: failed, api: { getOrder: unpaid } });
    await landing.order.load('R1');
    expect(landing.engine.cart.lines()).toHaveLength(1);
    expect(landing.paid).not.toHaveBeenCalled();

    const other = await setup();
    await other.engine.cart.addItem(2);
    await other.order.load('R1');
    expect(other.engine.cart.lines()).toHaveLength(1);
  });

  it('does not charge an offer twice when another order was loaded in between', async () => {
    const session = new MemoryStorage();
    const first = await setup({ session });
    await first.order.load('R1');
    expect(await first.order.accept(PLAIN, '/up-1/')).toBe('accepted');
    await first.order.load('R2');
    await first.order.load('R1');
    expect(await first.order.accept(PLAIN, '/up-1/')).toBe('repeat');
    expect(first.upsells()).toHaveLength(1);
  });

  it('accepts the picked offer × quantity once per page, with its vouchers', async () => {
    const session = new MemoryStorage();
    const { engine, order, upsells } = await setup({ session });
    await order.load('R1');
    await engine.selectors.register('upsell', OFFER, 'offer');
    await engine.selectors.setQuantity('upsell', 3);
    expect(await order.accept({ selectorId: 'upsell' }, '/up-1/')).toBe('accepted');
    expect(upsells()[0]!.body).toEqual({
      lines: [{ package_id: 2, quantity: 3 }],
      currency: 'USD',
      vouchers: ['UP50'],
    });
    expect(await order.accept({ selectorId: 'upsell' }, '/up-1/')).toBe('repeat');
    const back = await setup({ session });
    await back.order.load('R1');
    expect(await back.order.accept(PLAIN, '/up-1/')).toBe('repeat');
    expect(await back.order.accept(PLAIN, '/up-2/')).toBe('accepted');
    expect(upsells().length + back.upsells().length).toBe(2);
  });

  it('keeps the order as it was paid on this page, after an upsell changes it, and never saves it', async () => {
    const session = new MemoryStorage();
    const local = new MemoryStorage();
    const { engine, order } = await setup({ session, local });
    await order.load('R1');
    expect(engine.getState().order!.paidOrder).toEqual(ORDER);
    expect(await order.accept(PLAIN, '/up-1/')).toBe('accepted');
    expect(engine.getState().order).toMatchObject({ order: withUpsell(ORDER, 99, 1), paidOrder: ORDER });
    expect([...session.data.values()].join()).not.toContain('paidOrder');
    const next = await setup({ session, local });
    await next.order.load('R1');
    expect(next.engine.getState().order!.paidOrder).toBeUndefined();
  });

  it('leaves accepted upsells for analytics to mark reported, once per browser', async () => {
    const session = new MemoryStorage();
    const local = new MemoryStorage();
    const first = await setup({ session, local });
    await first.order.load('R1');
    await first.order.accept(PLAIN, '/up-1/');
    const next = await setup({ session, local });
    await next.order.load('R1');
    const raw = next.engine.getState().order!.order!;
    const ids = raw.lines!.filter((l) => l.is_upsell).map((l) => upsellId(raw, l));
    expect(ids).toEqual(['R1:99']);
    expect(next.order.reported()).toEqual(['1001']);
    expect(next.paid).not.toHaveBeenCalled();
    next.order.markReported(ids);
    const later = await setup({ session, local });
    await later.order.load('R1');
    expect(later.order.reported()).toEqual(['1001', 'R1:99']);
  });

  it('sends upsell.accepted with the offer as quoted, then order.updated with the order it made', async () => {
    const { engine, order, events } = await setup();
    await order.load('R1');
    await engine.selectors.register('upsell', OFFER, 'offer');
    await vi.waitFor(() => expect(engine.getState().selectors.upsell?.quotes?.up).toBeDefined());
    expect(await order.accept({ selectorId: 'upsell' }, '/up-1/')).toBe('accepted');
    const after = events.slice(events.findIndex((e) => e.name === 'upsell.accepted'));
    expect(after.map((e) => e.name)).toEqual(['upsell.accepted', 'order.updated']);
    expect(after[0]!.data).toEqual({
      ref_id: 'R1',
      page: '/up-1/',
      selector_id: 'upsell',
      option_id: 'up',
      lines: [expect.objectContaining({ package_id: 2, quantity: 1, product_id: 400, total: 44.5 })],
      currency: 'USD',
      total: 44.5,
    });
    expect(after[1]!.data).toEqual(publicOrder(withUpsell(ORDER, 99, 1)));
  });

  it('sends upsell.skipped and upsell.viewed with the offer, unpriced when only its package is known', async () => {
    const { order, sent } = await setup();
    await order.load('R1');
    order.view(PLAIN, '/up-1/');
    order.skip(PLAIN, '/up-1/');
    const offer = {
      ref_id: 'R1',
      page: '/up-1/',
      lines: [expect.objectContaining({ package_id: 2, quantity: 1 })],
      currency: 'USD',
    };
    expect(sent('upsell.viewed')).toEqual([offer]);
    expect(sent('upsell.skipped')).toEqual([offer]);
    expect(sent('upsell.skipped')[0]).not.toHaveProperty('lines.0.price');
  });

  it('takes an upsell as accepted when its request failed unanswered but the order now has it', async () => {
    let reads = 0;
    const upsold = withUpsell(ORDER, 99, 2, { product_id: 400 });
    const { order, sent, gets, upsells, engine } = await setup({
      api: {
        upsell: () => json({ message: 'Bad gateway' }, 502),
        getOrder: () => json(reads++ ? upsold : ORDER),
      },
    });
    await order.load('R1');
    expect(await order.accept(PLAIN, '/up-1/')).toBe('accepted');
    expect(gets()).toHaveLength(2);
    expect(sent('upsell.accepted')).toHaveLength(1);
    expect(sent('order.updated')).toEqual([publicOrder(upsold)]);
    expect(sent('upsell.failed')).toEqual([]);
    expect(sent('sdk.error')).toEqual([]);
    expect(engine.getState().order).toMatchObject({ status: 'ready', order: { lines: [{ id: 11 }, { id: 99 }] } });
    expect(await order.accept(PLAIN, '/up-1/')).toBe('repeat');
    expect(upsells()).toHaveLength(1);
  });

  it('takes a later offer as accepted only when the order has its own line, not an earlier offer’s late one', async () => {
    const first = withUpsell(ORDER, 99, 2, { product_id: 400 });
    const reads = [ORDER, ORDER, first, withUpsell(first, 100, 1, { product_id: 900 })];
    const { order, sent } = await setup({
      api: { upsell: () => json({ message: 'Bad gateway' }, 502), getOrder: () => json(reads.shift()) },
    });
    await order.load('R1');
    const plan = { lines: [{ packageId: 9, quantity: 1 }] };
    expect(await order.accept(PLAIN, '/up-1/')).toBe('failed');
    expect(await order.accept(plan, '/up-2/')).toBe('failed');
    expect(await order.accept(plan, '/up-2/')).toBe('accepted');
    expect(sent('upsell.failed')).toHaveLength(2);
    expect(sent('upsell.accepted')).toMatchObject([{ page: '/up-2/', lines: [{ package_id: 9 }] }]);
  });

  it('finds the offer’s line by its variant, a standalone product’s by its product, counting product units', async () => {
    const variants = { 1: 51, 2: 52 } as Record<number, number>;
    const packages = campaign.packages.map((p) => ({ ...p, product_variant_id: variants[p.ref_id] }));
    const accept = async (line: Partial<ApiOrderLine>, quantity: number, offer = PLAIN) => {
      let reads = 0;
      const upsold = withUpsell(ORDER, 99, quantity, line);
      const { order } = await setup({
        campaign: Promise.resolve({ ...campaign, packages }),
        api: { upsell: () => json({ message: 'Bad gateway' }, 502), getOrder: () => json(reads++ ? upsold : ORDER) },
      });
      await order.load('R1');
      return order.accept(offer, '/up-1/');
    };
    const one = { lines: [{ packageId: 1, quantity: 1 }] };
    expect(await accept({ product_id: 400, variant_id: null }, 1, one)).toBe('accepted');
    expect(await accept({ product_id: 400, variant_id: 52 }, 2)).toBe('accepted');
    expect(await accept({ product_id: 400, variant_id: 52 }, 1)).toBe('failed');
    expect(await accept({ product_id: 400, variant_id: 51 }, 2)).toBe('failed');
  });

  it('keeps an upsell failed when the order does not have it, or when the API refused it', async () => {
    const lost = await setup({ api: { upsell: () => Promise.reject(new TypeError('Failed to fetch')) as never } });
    await lost.order.load('R1');
    expect(await lost.order.accept(PLAIN, '/up-1/')).toBe('failed');
    expect(lost.gets()).toHaveLength(2);
    expect(lost.sent('upsell.failed')).toMatchObject([{ error: { code: 'network' } }]);

    const refused = await setup({ api: { upsell: () => json({ message: 'Card declined' }, 400) } });
    await refused.order.load('R1');
    expect(await refused.order.accept(PLAIN, '/up-1/')).toBe('failed');
    expect(refused.gets()).toHaveLength(1);
  });

  it('warns about an offer with nothing to add, and posts nothing', async () => {
    const { engine, order, upsells } = await setup();
    const warn = vi.spyOn(engine.log, 'warn').mockImplementation(() => {});
    await order.load('R1');
    expect(await order.accept({ selectorId: 'missing' }, '/up-1/')).toBe('failed');
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/\/up-1\/.*"missing".*nothing to add/));
    expect(upsells()).toHaveLength(0);
  });

  it('does not post an offer the order cannot take, or two at once', async () => {
    const unsupported = await setup({
      api: { getOrder: () => json({ ...ORDER, supports_post_purchase_upsells: false }) },
    });
    await unsupported.order.load('R1');
    expect(await unsupported.order.accept(PLAIN, '/up/')).toBe('unsupported');
    expect(unsupported.upsells()).toHaveLength(0);

    const { order, upsells } = await setup({ api: { delays: [0, 0, 30] } });
    await order.load('R1');
    const first = order.accept(PLAIN, '/up/');
    expect(await order.accept(PLAIN, '/other/')).toBe('busy');
    expect(await first).toBe('accepted');
    expect(upsells()).toHaveLength(1);
  });

  it('gives up on an order request that never answers, so the page can show', async () => {
    vi.useFakeTimers();
    const hang = ((_: string, init: RequestInit) =>
      new Promise((_, reject) =>
        init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))),
      )) as unknown as typeof fetch;
    const { engine } = makeEngine({ fetch: hang });
    await engine.start();
    const order = engine.attach((ctx) => createOrder(ctx, engine.cart));
    const loading = order.load('R1');
    await vi.advanceTimersByTimeAsync(10_000);
    await loading;
    expect(engine.getState().order?.status).toBe('failed');
    vi.useRealTimers();
  });

  it('keeps the shopper on track when an offer fails, and says why after sdk.error', async () => {
    const { engine, order, events } = await setup({ api: { upsell: () => json({ message: 'Card declined' }, 400) } });
    await order.load('R1');
    expect(await order.accept(PLAIN, '/up/')).toBe('failed');
    expect(engine.getState().order).toMatchObject({ status: 'ready', error: { message: 'Card declined' } });
    const after = events.slice(events.findIndex((e) => e.name === 'sdk.error'));
    expect(after.map((e) => e.name)).toEqual(['sdk.error', 'upsell.failed']);
    expect(after[1]!.data).toEqual({
      ref_id: 'R1',
      page: '/up/',
      lines: [expect.objectContaining({ package_id: 2, quantity: 1 })],
      currency: 'USD',
      error: { code: 'rejected', message: 'Card declined', status: 400 },
    });
  });

  it('sends a declined upsell as payment.failed with the gateway’s decline code, not as upsell.failed', async () => {
    const declined = json({ payment_response_code: 'insufficient_funds', payment_details: 'Insufficient funds' }, 400);
    const { order, sent } = await setup({ api: { upsell: () => declined } });
    await order.load('R1');
    expect(await order.accept(PLAIN, '/up/')).toBe('failed');
    const error = { code: 'declined', status: 400, decline_code: 'insufficient_funds', message: 'Insufficient funds' };
    expect(sent('payment.failed')).toEqual([{ method: 'card_token', ref_id: 'R1', error }]);
    expect(sent('upsell.failed')).toEqual([]);
    expect(sent('sdk.error')).toEqual([]);
    expect(sent('upsell.declined')).toMatchObject([{ ref_id: 'R1', page: '/up/', error }]);
  });

  it('answers the receipt’s order.* paths', async () => {
    const { engine, order } = await setup();
    const show = (path: string) => {
      const v = orderValue(engine.getState(), path);
      return v && format(v, 'USD', 'en');
    };
    expect(orderValue(engine.getState(), 'hasTax')).toEqual({ type: 'bool', value: false });
    await order.load('R1');
    expect(show('total')).toBe('$106.11');
    expect(show('subtotal')).toBe('$89.00');
    expect(show('tax')).toBe('$7.12');
    expect(show('shipping')).toBe('$9.99');
    expect(orderValue(engine.getState(), 'hasTax')).toEqual({ type: 'bool', value: true });
    expect(show('number')).toBe('1001');
    expect(show('paymentMethod')).toBe('Credit Card');
    expect(show('customer.name')).toBe('Jane Doe');
    expect(show('shippingAddress.city')).toBe('Austin');
    expect(show('billingAddress.name')).toBe('Ann Lee');
    expect(orderValue(engine.getState(), 'nope')).toBeUndefined();
  });
});
