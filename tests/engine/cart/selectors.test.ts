import { describe, expect, it, vi } from 'vitest';
import type { SelectorCard } from '../../../src/engine/cart/types';
import { format } from '../../../src/engine/display/format';
import { resolve } from '../../../src/engine/display/values';
import { fakeApi } from '../../fixtures/api';
import { campaign } from '../../fixtures/campaign';
import { flush, makeEngine, wait } from '../../fixtures/engine';
import type { Selector } from '../../../src/engine/events/selectors';
import { MemoryStorage } from '../../fixtures/storage';

const CARDS: SelectorCard[] = [
  { id: 'one', lines: [{ packageId: 1, quantity: 1 }], vouchers: [] },
  { id: 'two', lines: [{ packageId: 2, quantity: 1 }], vouchers: ['BUNDLE'], shippingId: 2 },
];

type TestEngine = ReturnType<typeof makeEngine>['engine'];

const price = (engine: TestEngine, path: string) => {
  const v = resolve(engine, path);
  return v && format(v, 'USD', 'en');
};

const record = (engine: TestEngine) => {
  const seen: Array<[string, Selector]> = [];
  engine.on('*', (e) => {
    if (e.name.startsWith('selector.') && e.name !== 'selector.bound') seen.push([e.name, e.data as Selector]);
  });
  return seen;
};

const totals = (seen: Array<[string, Selector]>) => seen.map(([name, s]) => `${name} ${s.total ?? ''}`.trim());

async function landingWithOffer(local: Storage) {
  const { engine } = makeEngine({ fetch: fakeApi({ offers: { 1: 0.5 } }).fetch, local });
  await engine.start();
  await engine.selectors.register('main', CARDS, 'select', 'one');
  await flush();
  expect(price(engine, 'bundle.one.price')).toBe('$24.50');
}

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

  it('picks the ?forceBundleId card over the cart and the preferred one, on that page only', async () => {
    const session = new MemoryStorage();
    const first = makeEngine({ session }).engine;
    await first.start();
    await first.selectors.register('main', CARDS, 'swap', 'one');

    const forced = makeEngine({ session, params: { forceBundleId: 'two' } }).engine;
    await forced.start();
    await forced.selectors.register('main', CARDS, 'swap', 'one');
    expect(forced.getState().selectors.main?.picked).toBe('two');
    expect(forced.cart.lines()).toEqual([{ package_id: 2, quantity: 1 }]);

    const next = makeEngine({ session }).engine;
    expect(next.getState().visit.params.forceBundleId).toBeUndefined();
    await next.selectors.register('main', CARDS, 'swap', 'one');
    expect(next.getState().selectors.main?.picked).toBe('two');
  });

  it('reads ?forceBundleId per selector, and falls back with a warning when no card matches', async () => {
    const { engine } = makeEngine({ params: { forceBundleId: 'side:two,missing' } });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await engine.selectors.register('side', CARDS, 'select', 'one');
    await engine.selectors.register('main', CARDS, 'select', 'two');
    await engine.selectors.register('gift', CARDS, 'select');
    expect(engine.getState().selectors.side?.picked).toBe('two');
    expect(engine.getState().selectors.main?.picked).toBe('two');
    expect(engine.getState().selectors.gift?.picked).toBe('one');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('forceBundleId "missing" matches no card'));
    warn.mockRestore();
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

  it('marks a selector’s first bind with the option it picked, not selector.selected', async () => {
    const session = new MemoryStorage();
    const first = makeEngine({ session }).engine;
    await first.start();
    await first.selectors.register('main', CARDS, 'swap', 'two');

    const { engine } = makeEngine({ session, params: { forceBundleId: 'side:two' } });
    const seen: string[] = [];
    engine.on('*', (e) => {
      const s = e.data as Selector;
      if (e.name.startsWith('selector.')) seen.push(`${e.name} ${s.selector_id}:${s.option_id}`);
    });
    await engine.selectors.register('main', CARDS, 'swap', 'one');
    await engine.selectors.register('side', CARDS, 'select');
    await engine.selectors.register('gift', CARDS, 'select', 'two');
    await engine.selectors.register('plain', CARDS, 'select');
    await engine.selectors.register('main', CARDS, 'swap', 'one');
    expect(seen.filter((s) => !s.startsWith('selector.pric'))).toEqual([
      'selector.bound main:two',
      'selector.bound side:two',
      'selector.bound gift:two',
      'selector.bound plain:one',
    ]);
  });

  it('sends selector.viewed only when asked, once per selector a page, however often it is bound', async () => {
    const { engine } = makeEngine();
    await engine.start();
    const seen = record(engine);
    engine.selectors.view('main');
    await engine.selectors.register('main', CARDS, 'select', 'two');
    await engine.selectors.register('side', CARDS, 'select');
    expect(seen.filter(([name]) => name === 'selector.viewed')).toEqual([]);
    engine.selectors.view('main');
    await engine.selectors.register('main', CARDS, 'select', 'two');
    engine.selectors.view('main');
    engine.selectors.view('side');
    expect(
      seen.filter(([name]) => name === 'selector.viewed').map(([, s]) => `${s.selector_id}:${s.option_id}`),
    ).toEqual(['main:two', 'side:one']);
  });

  it('sends selector.selected only for a pick of another option, and does not resend a cart that already has it', async () => {
    const { engine, api } = makeEngine();
    await engine.start();
    const seen: string[] = [];
    engine.on('selector.selected', (e) => seen.push(e.data.option_id!));
    await engine.selectors.register('main', CARDS, 'swap');
    const calls = api.calls.length;
    await engine.selectors.pick('main', 'one');
    await engine.selectors.addToCart('main');
    expect(seen).toEqual([]);
    expect(api.calls).toHaveLength(calls);
    await engine.selectors.pick('main', 'two');
    await engine.selectors.pick('main', 'two');
    expect(seen).toEqual(['two']);
  });

  it('sends selector.updated when the picked option’s quantity or one of its slots changes', async () => {
    const { engine } = makeEngine();
    await engine.start();
    const cards = [
      { id: 'pair', lines: [{ packageId: 1, quantity: 2, configurable: true }], vouchers: [], max: 3 },
      { id: 'single', lines: [{ packageId: 1, quantity: 1, configurable: true }], vouchers: [] },
    ];
    await engine.selectors.register('main', cards, 'swap', 'pair');
    const seen: string[] = [];
    engine.on('*', (e) => {
      const s = e.data as Selector;
      if (e.name === 'selector.selected' || e.name === 'selector.updated')
        seen.push(`${e.name} ${s.option_id} ${s.lines.map((l) => `${l.package_id}x${l.quantity}`).join()}`);
    });
    await engine.selectors.setQuantity('main', 2);
    await engine.selectors.setQuantity('main', 2);
    await engine.selectors.setSlot('main', 'pair', 0, { packageId: 2 });
    await engine.selectors.setSlot('main', 'pair', 0, { packageId: 2 });
    await engine.selectors.setSlot('main', 'single', 0, { packageId: 2 });
    expect(seen).toEqual(['selector.updated pair 1x4', 'selector.updated pair 2x1,1x3']);
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

  it('quotes offers once the campaign arrives, keeps only the latest quote, and reuses a request still in flight', async () => {
    const api = fakeApi({ delays: [30, 0, 0], ignoreAbort: true });
    const { engine } = makeEngine({ fetch: api.fetch });
    void engine.selectors.register('offer', CARDS, 'offer');
    expect(api.calls).toHaveLength(0);
    await engine.start();
    void engine.selectors.register('offer', [CARDS[1]!], 'offer');
    await wait(40);
    expect(api.calls).toHaveLength(2);
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

  it('prices each card once a page: a later page shows the saved quotes and checks them once, a new quantity prices only its card', async () => {
    const local = new MemoryStorage();
    const page = async () => {
      const api = fakeApi();
      const { engine } = makeEngine({ fetch: api.fetch, local });
      await engine.start();
      await engine.selectors.register('main', CARDS, 'swap', 'one');
      await flush();
      const quotes = () => api.calls.filter((c) => !('shipping_method' in c.body)).length;
      return { engine, quotes };
    };
    const landing = await page();
    expect(landing.quotes()).toBe(2);
    const checkout = await page();
    expect(checkout.quotes()).toBe(2);
    expect(price(checkout.engine, 'bundle.two.price')).toBe(price(landing.engine, 'bundle.two.price'));
    await checkout.engine.selectors.setQuantity('main', 2);
    await flush();
    expect(checkout.quotes()).toBe(3);
    await checkout.engine.selectors.setQuantity('main', 1);
    await flush();
    expect(checkout.quotes()).toBe(3);
    vi.useFakeTimers({ now: Date.now() + 10 * 60 * 1000 + 1, toFake: ['Date'] });
    try {
      expect((await page()).quotes()).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('announces a price run for the options, and a later page priced from the cache at once, then again when fresh', async () => {
    const local = new MemoryStorage();
    const page = async () => {
      const { engine } = makeEngine({ fetch: fakeApi().fetch, local });
      const seen: Array<[string, Selector]> = [];
      engine.on('*', (e) => {
        if (e.name.startsWith('selector.') && e.name !== 'selector.bound') seen.push([e.name, e.data as Selector]);
      });
      await engine.start();
      await engine.selectors.register('main', CARDS, 'swap', 'one');
      await flush();
      return seen;
    };
    const first = await page();
    expect(first.map(([name]) => name)).toEqual(['selector.pricing', 'selector.priced']);
    for (const [, data] of first) expect(data).toMatchObject({ selector_id: 'main', type: 'bundle', option_id: 'one' });
    expect(first[0]![1].lines[0]).not.toHaveProperty('price');
    expect(first[1]![1].lines).toMatchObject([{ package_id: 1, price: expect.any(Number), total: expect.any(Number) }]);
    const second = await page();
    expect(second.map(([name]) => name)).toEqual(['selector.priced', 'selector.priced']);
    expect(second[0]![1].lines[0]).toHaveProperty('price');
  });

  it('shows a later page the saved prices at once, then checks every option once more and sends the fresh prices', async () => {
    const local = new MemoryStorage();
    await landingWithOffer(local);

    const { engine } = makeEngine({ fetch: fakeApi().fetch, local });
    await engine.start();
    const seen = record(engine);
    await engine.selectors.register('main', CARDS, 'select', 'one');
    expect(price(engine, 'bundle.one.price')).toBe('$24.50');
    await flush();
    expect(totals(seen)).toEqual(['selector.priced 24.5', 'selector.priced 49']);
    expect(price(engine, 'bundle.one.price')).toBe('$49.00');
  });

  it('prices again, without the saved prices, once the campaign’s packages or offers changed', async () => {
    const edited = { ...campaign, offers: [{ ref_id: 1, name: 'Half off', type: 'offer' }] };
    const local = new MemoryStorage();
    await landingWithOffer(local);
    const fresh = makeEngine({ fetch: fakeApi().fetch, local, campaign: Promise.resolve(edited) }).engine;
    await fresh.start();
    const seen = record(fresh);
    await fresh.selectors.register('main', CARDS, 'select', 'one');
    await flush();
    expect(totals(seen)).toEqual(['selector.pricing', 'selector.priced 49']);

    const cached = new MemoryStorage();
    await landingWithOffer(cached);
    const later = makeEngine({ fetch: fakeApi().fetch, local: cached, campaign: Promise.resolve(edited) }).engine;
    const after = record(later);
    await later.selectors.register('main', CARDS, 'select', 'one');
    await flush();
    after.splice(0);
    await later.start();
    await flush();
    expect(after.map(([name]) => name)).toEqual(['selector.pricing', 'selector.priced']);
  });

  it('keeps the saved prices of selectors priced at the same time', async () => {
    const local = new MemoryStorage();
    const cases = [{ id: 'case', lines: [{ packageId: 3, quantity: 1 }], vouchers: [] }];
    const page = async () => {
      const { engine } = makeEngine({ local });
      await engine.start();
      const seen = record(engine);
      void engine.selectors.register('main', CARDS, 'select');
      void engine.selectors.register('side', cases, 'select');
      await flush();
      return seen.filter(([name]) => name === 'selector.pricing').map(([, s]) => s.selector_id);
    };
    expect(await page()).toEqual(['main', 'side']);
    expect(await page()).toEqual([]);
  });

  it('lists every option at the quantity it would be added, priced once the option has a price', async () => {
    const { engine } = makeEngine({ fetch: fakeApi({ offers: { 1: 0.5 } }).fetch });
    await engine.start();
    const seen = record(engine);
    await engine.selectors.register('main', [CARDS[0]!, { ...CARDS[1]!, quantity: 2 }], 'select', 'one');
    engine.selectors.view('main');
    await flush();
    await engine.selectors.pick('main', 'two');
    const [viewed, calculating, calculated, selected] = seen.map(([, s]) => s);
    expect(viewed).toMatchObject({
      option_id: 'one',
      currency: 'USD',
      options: [
        { option_id: 'one', lines: [{ package_id: 1, quantity: 1, product_id: 400 }] },
        { option_id: 'two', lines: [{ package_id: 2, quantity: 2, product_id: 400 }] },
      ],
    });
    expect(viewed).not.toHaveProperty('total');
    for (const option of [...viewed!.options!, ...calculating!.options!]) {
      expect(option).not.toHaveProperty('total');
      expect(option.lines[0]).not.toHaveProperty('price');
    }
    expect(calculated).toMatchObject({
      option_id: 'one',
      total: 24.5,
      options: [
        { option_id: 'one', total: 24.5, original_total: 49, lines: [{ package_id: 1, quantity: 1, total: 24.5 }] },
        { option_id: 'two', total: 178, original_total: 178, lines: [{ package_id: 2, quantity: 2, total: 178 }] },
      ],
    });
    expect(selected).toMatchObject({ option_id: 'two', total: 178, lines: [{ package_id: 2, quantity: 2 }] });
  });

  it('lists every selector on the page as its events carry it', async () => {
    const { engine } = makeEngine();
    await engine.start();
    const calculated: Selector[] = [];
    engine.on('selector.priced', (e) => calculated.push(e.data));
    await engine.selectors.register('main', CARDS, 'swap', 'two');
    await engine.selectors.register('offer', [CARDS[0]!], 'offer');
    await flush();
    const listed = engine.selectors.list();
    expect(listed.map((s) => [s.selector_id, s.type, s.option_id])).toEqual([
      ['main', 'bundle', 'two'],
      ['offer', 'offer', 'one'],
    ]);
    expect(listed[1]).toMatchObject({ total: 24.5, options: [{ option_id: 'one', total: 24.5 }] });
    expect(listed).toEqual(calculated);
  });

  it.each([
    ['finds its pick in the saved cart', 'main'],
    ['puts its pick in the saved cart', 'side'],
  ])(
    'prices the options once when a swap selector %s with a coupon, and again only when a coupon changes',
    async (_, id) => {
      const session = new MemoryStorage();
      const first = makeEngine({ session }).engine;
      await first.start();
      await first.selectors.register('main', CARDS, 'swap', 'two');
      expect(await first.cart.applyCoupon('SAVE10')).toBe(true);

      const { engine } = makeEngine({ session });
      const seen: string[] = [];
      engine.on('*', (e) => {
        if (e.name.startsWith('selector.') && e.name !== 'selector.bound') seen.push(e.name);
      });
      await engine.start();
      expect(engine.getState().cart.coupons).toEqual(['SAVE10']);
      await engine.selectors.register(id, CARDS, 'swap');
      await flush();
      await engine.cart.addItem(3);
      await flush();
      expect(seen.splice(0)).toEqual(['selector.pricing', 'selector.priced']);
      await engine.cart.removeCoupon('SAVE10');
      await flush();
      expect(seen).toEqual(['selector.pricing', 'selector.priced']);
    },
  );

  it('keeps a swap selector as it is while the cart is frozen', async () => {
    const { engine } = makeEngine();
    await engine.start();
    await engine.selectors.register('main', CARDS, 'swap', 'one');
    await flush();
    const picked = vi.fn();
    engine.on('selector.selected', picked);
    engine.on('selector.updated', picked);
    engine.cart.freeze(true);
    await engine.selectors.pick('main', 'two');
    await engine.selectors.setQuantity('main', 2);
    expect(picked).not.toHaveBeenCalled();
    expect(engine.getState().selectors.main!.picked).toBe('one');
    engine.cart.freeze(false);
    await engine.selectors.pick('main', 'two');
    expect(picked).toHaveBeenCalledTimes(1);
  });

  it('names the picked option and its products, priced once the option has a price', async () => {
    const { engine } = makeEngine({ fetch: fakeApi().fetch });
    await engine.start();
    const seen: Selector[] = [];
    engine.on('selector.viewed', (e) => seen.push(e.data));
    engine.on('selector.selected', (e) => seen.push(e.data));
    await engine.selectors.register('main', CARDS, 'select', 'one');
    engine.selectors.view('main');
    await flush();
    await engine.selectors.pick('main', 'two');
    expect(seen).toMatchObject([
      {
        selector_id: 'main',
        type: 'bundle',
        option_id: 'one',
        currency: 'USD',
        lines: [{ package_id: 1, quantity: 1, product_id: 400 }],
      },
      {
        option_id: 'two',
        total: 89,
        lines: [{ package_id: 2, quantity: 1, product_id: 400, price: expect.any(Number), total: expect.any(Number) }],
      },
    ]);
    expect(seen[0]!.lines[0]).not.toHaveProperty('price');
    expect(seen[0]).not.toHaveProperty('total');
  });

  it('falls back to package prices when pricing fails', async () => {
    const failing = (async () => new Response('{}', { status: 500 })) as typeof fetch;
    const { engine } = makeEngine({ fetch: failing });
    const errors: string[] = [];
    engine.on('sdk.error', (e) => errors.push(e.data.action));
    await engine.start();
    await engine.selectors.register('offer', CARDS, 'offer');
    await flush();
    expect(errors).toEqual(['selector.price']);
    expect(price(engine, 'bundle.one.price')).toBe('$49.00');
  });

  it('gives a selector and its picked option by id', async () => {
    const { engine } = makeEngine();
    await engine.start();
    expect([engine.selectors.get('main'), engine.selectors.picked('main')]).toEqual([undefined, undefined]);
    await engine.selectors.register('main', CARDS, 'select', 'two');
    expect(engine.selectors.get('main')).toMatchObject({ mode: 'select', picked: 'two' });
    expect(engine.selectors.picked('main')).toEqual(CARDS[1]);
  });
});
