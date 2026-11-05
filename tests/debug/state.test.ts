import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type Arrival, createDebug } from '../../src/debug/state';
import { publicOrder } from '../../src/engine/order';
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

  it('follows the order from checkout to the upsell, and flags an upsell page without one', async () => {
    const session = new MemoryStorage();
    const checkout = page(session, '/checkout/', { kind: 'checkout' });
    checkout.engine.events.emit(
      'order.created',
      publicOrder({ ref_id: 'R1', number: 1001, total_incl_tax: '49.00', currency: 'USD' } as ApiOrder),
    );
    expect(checkout.debug.state().pages[0]).toMatchObject({ order: 'R1', total: '49.00', units: 0 });
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

  it('marks a refused order, a payment left unpaid at the gateway and a paid order on their page', () => {
    const { engine, debug } = page(new MemoryStorage(), '/checkout/', { kind: 'checkout' });
    const checkout = engine.cart.currentCheckout();
    const error = { code: 'declined' as const, message: 'Card declined' };
    engine.events.emit('checkout.failed', { ...checkout, error });
    engine.events.emit('payment.redirected', { method: 'paypal', ref_id: 'R1', url: 'https://pay.test/' });
    engine.events.emit('payment.failed', { method: 'paypal', ref_id: 'R1', error: { code: 'payment_failed' } });
    engine.events.emit('coupon.denied', { code: 'SAVE10', reason: 'duplicate' });
    engine.events.emit('order.paid', publicOrder(ORDER));
    expect(debug.state().pages[0]!.marks.map((m) => [m.tone, m.text])).toEqual([
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

  it('keeps the panel as it was left, clears the journey to this page, and keeps the last 25 pages', () => {
    const session = new MemoryStorage();
    page(session, '/a/').debug.setPanel({ open: true, tab: 'cart' });
    const next = page(session, '/b/').debug;
    expect(next.state().panel).toEqual({ open: true, tab: 'cart', right: false });
    next.clear();
    expect(next.state().pages.map((p) => p.path)).toEqual(['/b/']);
    for (let i = 0; i < 30; i++) page(session, `/p${i}/`);
    const pages = page(session, '/last/').debug.state().pages;
    expect([pages.length, pages[0]!.path]).toEqual([25, '/p6/']);
  });
});
