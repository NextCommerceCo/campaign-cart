import { describe, expect, it } from 'vitest';
import type { SelectorCard } from '../../src/engine/types';
import { format, resolve } from '../../src/engine/values';
import { fakeApi } from '../fixtures/api';
import { flush, makeEngine, wait } from '../fixtures/engine';
import { MemoryStorage } from '../fixtures/storage';

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
    await first.load();
    await first.selectors.register('main', CARDS, 'swap', 'two');
    expect(first.getState().selectors.main?.picked).toBe('two');

    const next = makeEngine({ session }).engine;
    next.restore();
    await next.selectors.register('main', CARDS, 'swap', 'one');
    expect(next.getState().selectors.main?.picked).toBe('two');

    const fresh = makeEngine().engine;
    await fresh.selectors.register('main', CARDS, 'select');
    expect(fresh.getState().selectors.main?.picked).toBe('one');
  });

  it('puts the pick in the cart with its vouchers and shipping in swap mode only', async () => {
    const { engine, api } = makeEngine();
    await engine.load();
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
    await engine.load();
    const seen: string[] = [];
    engine.on('selection.changed', (e) => seen.push(e.data.cardId));
    await engine.selectors.register('main', CARDS, 'swap');
    const calls = api.calls.length;
    await engine.selectors.pick('main', 'one');
    await engine.selectors.addToCart('main');
    expect(seen).toEqual(['one']);
    expect(api.calls).toHaveLength(calls);
  });

  it('prices offer cards with the upsell quote, not the package price', async () => {
    const { engine, api } = makeEngine();
    await engine.load();
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
    await engine.load();
    void engine.selectors.register('offer', [CARDS[1]!], 'offer');
    await wait(40);
    expect(api.calls).toHaveLength(3);
    expect(engine.getState().selectors.offer?.quotes).toEqual({ two: expect.anything() });
    expect(engine.getState().selectors.offer?.quoting).toBe(false);
  });

  it('falls back to package prices when the quote fails', async () => {
    const failing = (async () => new Response('{}', { status: 500 })) as typeof fetch;
    const { engine } = makeEngine({ fetch: failing });
    const errors: string[] = [];
    engine.on('error', (e) => errors.push(e.data.action));
    await engine.load();
    await engine.selectors.register('offer', CARDS, 'offer');
    await flush();
    expect(errors).toEqual(['quote']);
    expect(price(engine, 'bundle.one.price')).toBe('$49.00');
  });
});
