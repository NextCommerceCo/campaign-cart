import { describe, expect, it, vi } from 'vitest';
import { createCheckout } from '../../src/engine/checkout';
import { createOrder, orderValue, purchaseId } from '../../src/engine/order';
import { format } from '../../src/engine/values';
import { fakeApi, type FakeApiOptions, json } from '../fixtures/api';
import { makeEngine, type MakeEngine } from '../fixtures/engine';
import { ORDER } from '../fixtures/order';
import { fakeRules } from '../fixtures/rules';
import { MemoryStorage } from '../fixtures/storage';

const OFFER = [{ id: 'up', lines: [{ packageId: 2, quantity: 1 }], vouchers: ['UP50'], max: 5 }];

async function setup(opts: MakeEngine & { api?: FakeApiOptions } = {}) {
  const api = fakeApi(opts.api);
  const made = makeEngine({ ...opts, fetch: api.fetch });
  await made.engine.start();
  const order = made.engine.attach((ctx) => createOrder(ctx, made.engine.cart));
  const loaded = vi.fn();
  made.engine.on('order.loaded', (e) => loaded(e.data));
  const gets = () => api.calls.filter((c) => c.method === 'GET' && c.url.includes('/orders/'));
  const upsells = () => api.calls.filter((c) => c.url.endsWith('/upsells/'));
  return { ...made, api, order, loaded, gets, upsells };
}

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

  it('reports a purchase once, only when paid, and never on the failure landing', async () => {
    const local = new MemoryStorage();
    const first = await setup({ local });
    await first.order.load('R1');
    expect(first.loaded).toHaveBeenLastCalledWith(expect.objectContaining({ purchase: '1001' }));
    first.order.markReported([purchaseId(ORDER)]);
    const again = await setup({ local });
    await again.order.load('R1');
    expect(again.loaded.mock.calls[0]![0].purchase).toBeUndefined();

    const unpaid = await setup({
      api: { getOrder: () => json({ ...ORDER, payment_complete_url: 'https://pay.test' }) },
    });
    await unpaid.order.load('R2');
    expect(unpaid.loaded.mock.calls[0]![0].purchase).toBeUndefined();
    const failed = await setup({ params: { payment_failed: 'true' } });
    await failed.order.load('R3');
    expect(failed.loaded.mock.calls[0]![0].purchase).toBeUndefined();
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
      await checkout.placeOrder({ method: 'paypal', failureUrl, pageUrl: 'https://shop.test/checkout/' });
    };

    const paid = new MemoryStorage();
    await gatewayOrder(paid, 'https://shop.test/checkout/?payment_failed=true');
    const next = await setup({ session: paid });
    expect(next.engine.cart.lines()).toHaveLength(1);
    await next.order.load('R1', '/upsell/');
    expect(next.engine.cart.lines()).toEqual([]);

    const failed = new MemoryStorage();
    await gatewayOrder(failed, 'https://shop.test/oops/');
    const landing = await setup({ session: failed });
    await landing.order.load('R1', '/oops/');
    expect(landing.engine.cart.lines()).toHaveLength(1);
    expect(landing.loaded.mock.calls[0]![0].purchase).toBeUndefined();

    const other = await setup();
    await other.engine.cart.addItem(2);
    await other.order.load('R1', '/receipt/');
    expect(other.engine.cart.lines()).toHaveLength(1);
  });

  it('does not charge an offer twice when another order was loaded in between', async () => {
    const session = new MemoryStorage();
    const first = await setup({ session });
    await first.order.load('R1');
    expect(await first.order.accept({ lines: [{ packageId: 2, quantity: 1 }] }, '/up-1/')).toBe('accepted');
    await first.order.load('R2');
    await first.order.load('R1');
    expect(await first.order.accept({ lines: [{ packageId: 2, quantity: 1 }] }, '/up-1/')).toBe('repeat');
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
    expect(await back.order.accept({ lines: [{ packageId: 2, quantity: 1 }] }, '/up-1/')).toBe('repeat');
    expect(await back.order.accept({ lines: [{ packageId: 2, quantity: 1 }] }, '/up-2/')).toBe('accepted');
    expect(upsells().length + back.upsells().length).toBe(2);
  });

  it('reports accepted upsells from the order on the next page, once each', async () => {
    const session = new MemoryStorage();
    const local = new MemoryStorage();
    const first = await setup({ session, local });
    await first.order.load('R1');
    first.order.markReported([purchaseId(ORDER)]);
    await first.order.accept({ lines: [{ packageId: 2, quantity: 1 }] }, '/up-1/');
    const next = await setup({ session, local });
    await next.order.load('R1');
    expect(next.loaded.mock.calls[0]![0]).toMatchObject({
      upsells: [{ id: 'R1:99', number: 1, line: { is_upsell: true } }],
    });
    expect(next.loaded.mock.calls[0]![0].purchase).toBeUndefined();
  });

  it('does not post an offer the order cannot take, or two at once', async () => {
    const unsupported = await setup({
      api: { getOrder: () => json({ ...ORDER, supports_post_purchase_upsells: false }) },
    });
    await unsupported.order.load('R1');
    expect(await unsupported.order.accept({ lines: [{ packageId: 2, quantity: 1 }] }, '/up/')).toBe('unsupported');
    expect(unsupported.upsells()).toHaveLength(0);

    const { order, upsells } = await setup({ api: { delays: [0, 0, 30] } });
    await order.load('R1');
    const first = order.accept({ lines: [{ packageId: 2, quantity: 1 }] }, '/up/');
    expect(await order.accept({ lines: [{ packageId: 2, quantity: 1 }] }, '/other/')).toBe('busy');
    expect(await first).toBe('accepted');
    expect(upsells()).toHaveLength(1);
  });

  it('keeps the shopper on track when an offer fails', async () => {
    const { engine, order } = await setup({ api: { upsell: () => json({ message: 'Card declined' }, 400) } });
    await order.load('R1');
    expect(await order.accept({ lines: [{ packageId: 2, quantity: 1 }] }, '/up/')).toBe('failed');
    expect(engine.getState().order).toMatchObject({ status: 'ready', error: { message: 'Card declined' } });
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
