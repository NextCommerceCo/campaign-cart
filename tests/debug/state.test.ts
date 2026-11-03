import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type Arrival, createDebug } from '../../src/debug/state';
import { makeEngine } from '../fixtures/engine';
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
    landing.engine.log.debug('analytics add_to_cart sent', { trace: 'analytics', name: 'add_to_cart', sent: true });
    landing.engine.log.debug('analytics view_item not sent', { trace: 'analytics', name: 'view_item', sent: false });

    const checkout = page(session, '/checkout/', { kind: 'checkout' });
    const [first, second] = checkout.debug.state().pages;
    expect(first).toMatchObject({ path: '/landing/', kind: 'product', units: 2, sent: ['add_to_cart'] });
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
    checkout.engine.events.emit('order.placed', {
      order: { ref_id: 'R1', number: 1001, total_incl_tax: '49.00', currency: 'USD' },
    });
    expect(checkout.debug.state().pages[0]).toMatchObject({ order: 'R1', total: '49.00', units: 0 });
    expect(page(session, '/upsell/', { kind: 'upsell' }).debug.state().pages[1]!.marks[0]!.text).toBe(
      'No order here: an upsell page shows the order placed at checkout',
    );
    const { engine } = makeEngine({ session, debug: true, params: { ref_id: 'R1' } });
    const linked = engine.attach((ctx) => createDebug(ctx, { ...arrival('/upsell/'), kind: 'upsell', lines: [] }));
    expect(linked.state().pages[2]!.marks).toEqual([]);
    checkout.engine.attach((ctx) => ctx.update('order', { refId: 'R1', status: 'ready', accepted: [] }));
    const upsell = page(session, '/upsell/', { kind: 'upsell' });
    upsell.engine.events.emit('upsell.accepted', { refId: 'R1', lines: [{ package_id: 2, quantity: 1 }] });
    expect(upsell.debug.state().pages[3]).toMatchObject({
      order: 'R1',
      upsell: 'accepted',
      marks: [{ tone: 'done', text: 'Upsell accepted: package 2' }],
    });
  });

  it('folds a reload into its page, and starts a new step for a page opened again by a link', async () => {
    const session = new MemoryStorage();
    const first = page(session, '/checkout/');
    first.engine.log.debug('analytics page_view sent', { trace: 'analytics', name: 'page_view', sent: true });
    const again = page(session, '/checkout/', { reload: true });
    again.engine.log.debug('analytics page_view sent', { trace: 'analytics', name: 'page_view', sent: true });
    expect(again.debug.state().pages).toMatchObject([
      { path: '/checkout/', reloads: 1, sent: ['page_view', 'page_view'], marks: [{ text: 'Reloaded' }] },
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
