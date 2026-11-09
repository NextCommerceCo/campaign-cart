import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type Arrival, createDebug } from '../../src/debug/state';
import { publicOrder } from '../../src/engine/order/order';
import type { ApiOrder } from '../../src/engine/types';
import { makeEngine } from '../fixtures/engine';
import { ORDER } from '../fixtures/order';
import { MemoryStorage } from '../fixtures/storage';

const arrival = (path: string): Arrival => ({
  at: Date.now(),
  path,
  title: path,
  kind: 'page',
  scope: 's1',
  funnel: 'f1',
  reload: false,
  reset: false,
  lines: [],
});

const page = (session: Storage, path: string, extra: Partial<Arrival> = {}) => {
  const { engine } = makeEngine({ session, debug: true });
  const debug = engine.attach((ctx) => createDebug(ctx, { ...arrival(path), lines: engine.cart.lines(), ...extra }));
  return { engine, debug };
};

beforeEach(() => {
  vi.spyOn(console, 'debug').mockImplementation(() => {});
});

describe('debug journey', () => {
  it('records each page of the tab with what the shopper did there and the analytics it sent', async () => {
    const session = new MemoryStorage();
    const landing = page(session, '/landing/', { kind: 'product' });
    await landing.engine.start();
    await landing.engine.cart.addItem(1);
    await landing.engine.cart.setQuantity(1, 2);
    await landing.engine.cart.applyCoupon('nope');
    landing.engine.log.debug('analytics product_added_to_cart sent', {
      trace: 'analytics',
      name: 'product_added_to_cart',
      sent: true,
    });
    landing.engine.log.debug('analytics product_viewed not sent', {
      trace: 'analytics',
      name: 'product_viewed',
      sent: false,
    });

    const checkout = page(session, '/checkout/', { kind: 'checkout' });
    const [first, second] = checkout.debug.state().pages;
    expect(first).toMatchObject({ path: '/landing/', kind: 'product', units: 2, sent: ['product_added_to_cart'] });
    expect(first!.marks.map((m) => [m.tone, m.text])).toEqual([
      [undefined, 'Added Earbuds ×1 ×1'],
      [undefined, 'Earbuds ×1 ×1 → ×2'],
      ['warn', 'Coupon NOPE refused by the server'],
    ]);
    expect(second).toMatchObject({ path: '/checkout/', kind: 'checkout', units: 2, marks: [] });
  });

  it('flags a cart that did not reach the next page, and a page in another storage scope', async () => {
    const session = new MemoryStorage();
    const before = page(session, '/a/');
    await before.engine.start();
    await before.engine.cart.addItem(1);
    session.removeItem('next:test:cart');
    const lost = page(session, '/b/').debug.state().pages[1]!;
    expect(lost.marks).toMatchObject([{ tone: 'error', text: 'The cart (1 item) did not carry over from /a/' }]);
    const moved = page(session, '/c/', { scope: 's2' }).debug.state().pages[2]!;
    expect(moved.marks[0]!.text).toMatch(/^Storage scope changed from s1 to s2/);
    const reset = page(session, '/d/', { scope: 's2', reset: true }).debug.state().pages[3]!;
    expect(reset.marks.map((m) => m.text)).toEqual(['Saved data cleared with ?reset=1']);
  });

  it('notes, without a warning, a page of another funnel, which keeps its own cart', async () => {
    const session = new MemoryStorage();
    const before = page(session, '/demeter/checkout/', { funnel: 'Demeter' });
    await before.engine.start();
    await before.engine.cart.addItem(1);
    session.removeItem('next:test:cart');
    const other = page(session, '/apollo/checkout/', { funnel: 'Apollo', scope: 's2' }).debug.state().pages[1]!;
    expect(other.marks).toEqual([
      { at: expect.any(Number), text: 'Funnel changed from Demeter to Apollo, which keeps its own cart' },
    ]);
  });

  it('follows the order from checkout to the upsell, and flags an upsell page without one', async () => {
    const session = new MemoryStorage();
    const checkout = page(session, '/checkout/', { kind: 'checkout' });
    checkout.engine.events.emit(
      'order.created',
      publicOrder({ ref_id: 'R1', number: 1001, total_incl_tax: '49.00', currency: 'USD' } as ApiOrder),
    );
    expect(checkout.debug.state().pages[0]).toMatchObject({ order: 'R1', total: 49, units: 0 });
    expect(page(session, '/upsell/', { kind: 'upsell' }).debug.state().pages[1]!.marks[0]!.text).toBe(
      'No order here: an upsell page shows the order placed at checkout',
    );
    const { engine } = makeEngine({ session, debug: true, params: { ref_id: 'R1' } });
    const linked = engine.attach((ctx) => createDebug(ctx, { ...arrival('/upsell/'), kind: 'upsell', lines: [] }));
    expect(linked.state().pages[2]!.marks).toEqual([]);
    checkout.engine.attach((ctx) => ctx.update('order', { refId: 'R1', status: 'ready', accepted: [] }));
    const upsell = page(session, '/upsell/', { kind: 'upsell' });
    upsell.engine.events.emit('upsell.accepted', {
      ref_id: 'R1',
      page: '/upsell/',
      lines: [{ package_id: 2, quantity: 1 }],
    });
    expect(upsell.debug.state().pages[3]).toMatchObject({
      order: 'R1',
      upsell: 'accepted',
      marks: [{ tone: 'done', text: 'Upsell accepted: package 2' }],
    });
  });

  const order = (total: string) =>
    publicOrder({ ref_id: 'R1', number: 1001, total_incl_tax: total, currency: 'USD' } as ApiOrder);
  const accepted = (total?: number, lines = [{ package_id: 2, quantity: 1, total: 19.5 }]) => ({
    ref_id: 'R1',
    page: '/upsell/',
    lines,
    currency: 'USD',
    ...(total !== undefined && { total }),
  });

  it('records what each page added to the order: its total at checkout, an upsell after it', () => {
    const session = new MemoryStorage();
    page(session, '/checkout/', { kind: 'checkout' }).engine.events.emit('order.created', order('49.00'));
    const upsell = page(session, '/upsell/', { kind: 'upsell' });
    upsell.engine.events.emit('order.loaded', order('49.00'));
    upsell.engine.events.emit('upsell.accepted', accepted(19.5));
    upsell.engine.events.emit('order.updated', order('68.50'));
    page(session, '/declined/', { kind: 'upsell' }).engine.events.emit('order.loaded', order('68.50'));
    const { debug } = page(session, '/receipt/', { kind: 'receipt' });
    expect(debug.state().pages.map((p) => [p.path, p.total, p.earned])).toEqual([
      ['/checkout/', 49, 49],
      ['/upsell/', 68.5, 19.5],
      ['/declined/', 68.5, undefined],
      ['/receipt/', undefined, undefined],
    ]);
  });

  it("adds up two upsells accepted on one page from each upsell's own total, whatever the order's totals", () => {
    const session = new MemoryStorage();
    page(session, '/checkout/', { kind: 'checkout' }).engine.events.emit('order.created', order('49.00'));
    const { engine, debug } = page(session, '/upsell/', { kind: 'upsell' });
    engine.events.emit('upsell.accepted', accepted(19.5));
    engine.events.emit('order.updated', order('70.06'));
    engine.events.emit(
      'upsell.accepted',
      accepted(undefined, [
        { package_id: 3, quantity: 1, total: 10.1 },
        { package_id: 9, quantity: 1, total: 0.2 },
      ]),
    );
    engine.events.emit('order.updated', order('80.36'));
    expect(debug.state().pages[1]).toMatchObject({ upsell: 'accepted', total: 80.36, earned: 29.8 });
  });

  it('stops recording the page once stopped', () => {
    const { engine, debug } = page(new MemoryStorage(), '/checkout/', { kind: 'checkout' });
    debug.stop();
    engine.events.emit('order.created', order('49.00'));
    engine.log.debug('analytics page_viewed sent', { trace: 'analytics', name: 'page_viewed', sent: true });
    expect(debug.state().pages[0]).toMatchObject({ marks: [], sent: [] });
    expect(debug.state().pages[0]!.order).toBeUndefined();
  });

  it('marks a stopped submit, a refused order, a payment left unpaid at the gateway and a paid order on their page', () => {
    const { engine, debug } = page(new MemoryStorage(), '/checkout/', { kind: 'checkout' });
    const checkout = engine.cart.currentCheckout();
    const error = { code: 'declined' as const, message: 'Card declined' };
    engine.events.emit('checkout.invalid', { ...checkout, errors: { email: error } });
    engine.events.emit('checkout.failed', { ...checkout, error });
    engine.events.emit('payment.redirected', { method: 'paypal', ref_id: 'R1', url: 'https://pay.test/' });
    engine.events.emit('payment.failed', { method: 'paypal', ref_id: 'R1', error: { code: 'payment_failed' } });
    engine.events.emit('coupon.denied', { code: 'SAVE10', reason: 'duplicate' });
    engine.events.emit('order.paid', publicOrder(ORDER));
    expect(debug.state().pages[0]!.marks.map((m) => [m.tone, m.text])).toEqual([
      ['warn', 'Submit stopped: email'],
      ['warn', 'Order refused: Card declined'],
      [undefined, 'Left for the payment gateway to pay order R1'],
      ['warn', 'Payment for order R1 not completed at the gateway'],
      ['warn', 'Coupon SAVE10 is already on the cart'],
      ['done', 'Order 1001 paid'],
    ]);
  });

  it('folds a reload into its page, and starts a new step for a page opened again by a link', async () => {
    const session = new MemoryStorage();
    const first = page(session, '/checkout/');
    first.engine.log.debug('analytics page_viewed sent', { trace: 'analytics', name: 'page_viewed', sent: true });
    const again = page(session, '/checkout/', { reload: true });
    again.engine.log.debug('analytics page_viewed sent', { trace: 'analytics', name: 'page_viewed', sent: true });
    expect(again.debug.state().pages).toMatchObject([
      { path: '/checkout/', reloads: 1, sent: ['page_viewed', 'page_viewed'], marks: [{ text: 'Reloaded' }] },
    ]);
    expect(page(session, '/checkout/').debug.state().pages).toHaveLength(2);
  });

  it('keeps one warning for a problem a reload finds again', () => {
    const session = new MemoryStorage();
    page(session, '/upsell/', { kind: 'upsell' });
    page(session, '/upsell/', { kind: 'upsell', reload: true });
    const { debug } = page(session, '/upsell/', { kind: 'upsell', reload: true });
    expect(debug.state().pages[0]!.marks.map((m) => m.text)).toEqual([
      'No order here: an upsell page shows the order placed at checkout',
      'Reloaded',
      'Reloaded',
    ]);
  });

  it('keeps the panel as it was left, clears the journey to this page, and keeps the last 25 pages', () => {
    const session = new MemoryStorage();
    page(session, '/a/').debug.setPanel({ open: true, tab: 'cart' });
    const next = page(session, '/b/').debug;
    expect(next.state().panel).toEqual({ open: true, tab: 'cart', right: true });
    next.clear();
    expect(next.state().pages.map((p) => p.path)).toEqual(['/b/']);
    for (let i = 0; i < 30; i++) page(session, `/p${i}/`);
    const pages = page(session, '/last/').debug.state().pages;
    expect([pages.length, pages[0]!.path]).toEqual([25, '/p6/']);
  });
});
