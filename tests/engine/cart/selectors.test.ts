import { describe, expect, it } from 'vitest';
import type { SelectorCard } from '../../../src/engine/types';
import { format, resolve } from '../../../src/engine/values';
import { fakeApi } from '../../fixtures/api';
import { flush, makeEngine, wait } from '../../fixtures/engine';
import { MemoryStorage } from '../../fixtures/storage';

const CARDS: SelectorCard[] = [
  { id: 'one', lines: [{ packageId: 1, quantity: 1 }], vouchers: [] },
  { id: 'two', lines: [{ packageId: 2, quantity: 1 }], vouchers: ['BUNDLE'], shippingId: 2 },
];

const price = (engine: ReturnType<typeof makeEngine>['engine'], path: string) => {
  const v = resolve(engine, path);
  return v && format(v, 'USD', 'en');
};

describe('selectors', () => {
  it('picks the card already in the cart, then the preferred one, then the first', async () => {
    const session = new MemoryStorage();
    const first = makeEngine({ session }).engine;
    await first.start();
    await first.selectors.register('main', CARDS, 'swap', 'two');
    expect(first.getState().selectors.main?.picked).toBe('two');

    const next = makeEngine({ session }).engine;
    await next.selectors.register('main', CARDS, 'swap', 'one');
    expect(next.getState().selectors.main?.picked).toBe('two');

    const fresh = makeEngine().engine;
    await fresh.selectors.register('main', CARDS, 'select');
    expect(fresh.getState().selectors.main?.picked).toBe('one');
  });

  it('puts the pick in the cart with its vouchers and shipping in swap mode only', async () => {
    const { engine, api } = makeEngine();
    await engine.start();
    await engine.selectors.register('main', CARDS, 'swap', 'two');
    expect(engine.cart.lines()).toEqual([{ package_id: 2, quantity: 1 }]);
    expect(api.calls.at(-1)?.body).toMatchObject({ vouchers: ['BUNDLE'], shipping_method: 2 });

    await engine.selectors.register('side', CARDS, 'select');
    expect(engine.getState().cart.groups['bundle:side']).toBeUndefined();
    await engine.selectors.addToCart('side');
    expect(engine.getState().cart.groups['bundle:side']?.lines).toEqual(CARDS[0]!.lines);
  });

  it('announces a pick once and does not resend a cart that already has it', async () => {
    const { engine, api } = makeEngine();
    await engine.start();
    const seen: string[] = [];
    engine.on('selection.changed', (e) => seen.push(e.data.cardId));
    await engine.selectors.register('main', CARDS, 'swap');
    const calls = api.calls.length;
    await engine.selectors.pick('main', 'one');
    await engine.selectors.addToCart('main');
    expect(seen).toEqual(['one']);
    expect(api.calls).toHaveLength(calls);
  });

  it('multiplies the picked card by its quantity, within its limits, and keeps it across a reload', async () => {
    const session = new MemoryStorage();
    const { engine, api } = makeEngine({ session });
    await engine.start();
    const card = { id: 'one', lines: [{ packageId: 1, quantity: 1 }], vouchers: [], quantity: 2, min: 1, max: 3 };
    await engine.selectors.register('main', [card], 'swap');
    expect(engine.cart.lines()).toEqual([{ package_id: 1, quantity: 2 }]);
    await engine.selectors.setQuantity('main', 9);
    expect(engine.cart.lines()).toEqual([{ package_id: 1, quantity: 3 }]);
    expect(price(engine, 'bundle.main.price')).toBe('$147.00');
    await engine.selectors.setQuantity('main', 0);
    expect(engine.cart.lines()).toEqual([{ package_id: 1, quantity: 1 }]);
    await engine.selectors.setQuantity('main', 3);

    const next = makeEngine({ session, fetch: api.fetch }).engine;
    await next.selectors.register('main', [card], 'swap');
    expect(next.cart.lines()).toEqual([{ package_id: 1, quantity: 3 }]);
  });

  it('turns a configurable item into one slot per unit, each with its own variant and properties', async () => {
    const session = new MemoryStorage();
    const { engine, api } = makeEngine({ session });
    await engine.start();
    const card = { id: 'two', lines: [{ packageId: 1, quantity: 2, configurable: true }], vouchers: [] };
    await engine.selectors.register('main', [card], 'swap');
    expect(engine.cart.lines()).toEqual([{ package_id: 1, quantity: 2 }]);
    await engine.selectors.setSlot('main', 'two', 1, { packageId: 2, properties: { number: '23' } });
    expect(engine.cart.lines()).toEqual([
      { package_id: 1, quantity: 1 },
      { package_id: 2, quantity: 1, properties: { number: '23' } },
    ]);
    const next = makeEngine({ session, fetch: api.fetch }).engine;
    await next.selectors.register('main', [card], 'swap');
    expect(next.getState().selectors.main?.slots?.two).toEqual([
      { packageId: 1 },
      { packageId: 2, properties: { number: '23' } },
    ]);
    expect(next.cart.lines()).toEqual(engine.cart.lines());
  });

  it('restores the exact bundle the shopper picked, not a smaller one times a quantity', async () => {
    const session = new MemoryStorage();
    const tiers = [1, 2, 3].map((n) => ({ id: `buy${n}`, lines: [{ packageId: 1, quantity: n }], vouchers: [] }));
    const first = makeEngine({ session }).engine;
    await first.start();
    await first.selectors.register('main', tiers, 'swap', 'buy3');
    const next = makeEngine({ session }).engine;
    await next.selectors.register('main', tiers, 'swap', 'buy1');
    expect(next.getState().selectors.main).toMatchObject({ picked: 'buy3', quantities: { buy3: 1 } });
  });

  it('never shows a quote for another quantity', async () => {
    let fail = false;
    const api = fakeApi();
    const send = ((url: string, init: RequestInit) =>
      fail ? Promise.resolve(new Response('{}', { status: 500 })) : api.fetch(url, init)) as typeof fetch;
    const { engine } = makeEngine({ fetch: send });
    await engine.start();
    await engine.selectors.register('offer', [{ ...CARDS[0]!, max: 5 }], 'offer');
    await flush();
    expect(price(engine, 'bundle.offer.price')).toBe('$24.50');
    fail = true;
    const requote = engine.selectors.setQuantity('offer', 3);
    expect(price(engine, 'bundle.offer.price')).toBe('');
    await requote;
    expect(price(engine, 'bundle.offer.price')).toBe('$147.00');
  });

  it('re-prices an offer when its quantity changes', async () => {
    const { engine, api } = makeEngine();
    await engine.start();
    await engine.selectors.register('offer', [{ ...CARDS[0]!, max: 5 }], 'offer');
    await flush();
    await engine.selectors.setQuantity('offer', 2);
    await flush();
    expect(api.calls.at(-1)?.body.lines).toEqual([{ package_id: 1, quantity: 2 }]);
    expect(price(engine, 'bundle.offer.price')).toBe('$49.00');
  });

  it('prices offer cards with the upsell quote, not the package price', async () => {
    const { engine, api } = makeEngine();
    await engine.start();
    void engine.selectors.register('offer', CARDS, 'offer');
    expect(engine.getState().selectors.offer?.quoting).toBe(true);
    expect(price(engine, 'bundle.one.price')).toBe('');
    expect(resolve(engine, 'bundle.one.isSelected')).toEqual({ type: 'bool', value: true });
    await flush();
    expect(api.calls.map((c) => c.url)).toEqual([
      'https://api.test/api/v1/carts/calculate/?upsell=true',
      'https://api.test/api/v1/carts/calculate/?upsell=true',
    ]);
    expect(api.calls[1]?.body).toMatchObject({ lines: [{ package_id: 2, quantity: 1 }], vouchers: ['BUNDLE'] });
    expect(price(engine, 'bundle.one.price')).toBe('$24.50');
    expect(price(engine, 'bundle.two.discountAmount')).toBe('$44.50');
    expect(engine.cart.lines()).toEqual([]);
  });

  it('quotes offers once the campaign arrives, and keeps only the latest quote', async () => {
    const api = fakeApi({ delays: [30, 0, 0], ignoreAbort: true });
    const { engine } = makeEngine({ fetch: api.fetch });
    void engine.selectors.register('offer', CARDS, 'offer');
    expect(api.calls).toHaveLength(0);
    await engine.start();
    void engine.selectors.register('offer', [CARDS[1]!], 'offer');
    await wait(40);
    expect(api.calls).toHaveLength(3);
    expect(engine.getState().selectors.offer?.quotes).toEqual({ two: expect.anything() });
    expect(engine.getState().selectors.offer?.quoting).toBe(false);
  });

  it('prices swap cards with the server’s offers and the shopper’s coupons, like 0.4.x', async () => {
    const api = fakeApi({ offers: { 1: 0.5 } });
    const { engine } = makeEngine({ fetch: api.fetch });
    await engine.start();
    await engine.selectors.register('main', CARDS, 'swap', 'two');
    await flush();
    expect(price(engine, 'bundle.one.price')).toBe('$24.50');
    expect(price(engine, 'bundle.one.originalPrice')).toBe('$49.00');
    expect(resolve(engine, 'bundle.one.hasDiscount')).toEqual({ type: 'bool', value: true });
    const before = api.calls.length;
    await engine.cart.applyCoupon('SAVE10');
    await flush();
    const quotes = api.calls.slice(before).filter((c) => c.body.lines.length === 1 && !('shipping_method' in c.body));
    expect(quotes.map((c) => c.body.vouchers)).toEqual([['SAVE10'], ['BUNDLE', 'SAVE10']]);
  });

  it('reads bundle.<id> from a card with that id before a selector with that id', async () => {
    const { engine } = makeEngine();
    await engine.start();
    await engine.selectors.register('upsell-1x', [{ ...CARDS[1]!, id: 'upsell-1x-card', vouchers: [] }], 'select');
    await engine.selectors.register('offer', [{ ...CARDS[0]!, id: 'upsell-1x' }], 'offer');
    await flush();
    expect(price(engine, 'bundle.upsell-1x.price')).toBe('$24.50');
    expect(price(engine, 'bundle.offer.price')).toBe('$24.50');
  });

  it('falls back to package prices when the quote fails', async () => {
    const failing = (async () => new Response('{}', { status: 500 })) as typeof fetch;
    const { engine } = makeEngine({ fetch: failing });
    const errors: string[] = [];
    engine.on('error', (e) => errors.push(e.data.action));
    await engine.start();
    await engine.selectors.register('offer', CARDS, 'offer');
    await flush();
    expect(errors).toEqual(['quote']);
    expect(price(engine, 'bundle.one.price')).toBe('$49.00');
  });
});
