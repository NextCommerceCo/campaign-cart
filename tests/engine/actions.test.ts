import { describe, expect, it, vi } from 'vitest';
import { createActions, nextQuantity, parseItems } from '../../src/engine/actions';
import { flush, makeEngine } from '../fixtures/engine';

async function ready() {
  const { engine } = makeEngine();
  await engine.start();
  const navigate = vi.fn();
  const actions = createActions(engine, { page: () => '/upsell', navigate, url: (t) => `https://shop.test/${t}?x=1` });
  return { engine, actions, navigate };
}

const cards = [
  { id: 'one', lines: [{ packageId: 1, quantity: 1 }], vouchers: [], min: 1, max: 3 },
  { id: 'two', lines: [{ packageId: 2, quantity: 1 }], vouchers: ['DUO10'] },
];

describe('actions', () => {
  it('reads items as package x quantity, comma-separated, and skips what it cannot read', () => {
    expect(parseItems('1x3, 5')).toEqual([
      { packageId: 1, quantity: 3 },
      { packageId: 5, quantity: 1 },
    ]);
    expect(parseItems(' 7 X 2 ,abc, 0x1, 4x0')).toEqual([{ packageId: 7, quantity: 2 }]);
    expect(parseItems(undefined)).toEqual([]);
  });

  it('moves a quantity by +n or -n and sets it from a plain number', () => {
    expect(nextQuantity('+1', 2)).toBe(3);
    expect(nextQuantity('-1', 2)).toBe(1);
    expect(nextQuantity(5, 2)).toBe(5);
    expect(nextQuantity('', 2)).toBeUndefined();
    expect(nextQuantity('lots', 2)).toBeUndefined();
  });

  it('adds items, a package or a selector’s pick, and says why it added nothing', async () => {
    const { engine, actions } = await ready();
    expect(await actions.addItem({ items: '1x2, 9' })).toEqual({ ok: true });
    expect(engine.cart.lines()).toEqual([
      { package_id: 1, quantity: 2 },
      { package_id: 9, quantity: 1 },
    ]);
    expect(await actions.addItem({ package_id: 2, quantity: 1, replace: true })).toEqual({ ok: true });
    expect(engine.cart.lines()).toEqual([{ package_id: 2, quantity: 1 }]);
    expect(await actions.addItem({})).toMatchObject({ ok: false, errors: { items: expect.any(String) } });
    expect(await actions.addItem({ selector_id: 'main' })).toMatchObject({
      ok: false,
      errors: { selector_id: expect.any(String) },
    });
    await engine.selectors.register('main', cards, 'select', 'two');
    expect(await actions.addItem({ selector_id: 'main', replace: '' })).toEqual({ ok: true });
    expect(engine.getState().cart.groups['bundle:main']).toEqual({
      lines: [{ packageId: 2, quantity: 1 }],
      vouchers: ['DUO10'],
    });
  });

  it('steps a cart line within its limits, and a selector’s pick within its option’s', async () => {
    const { engine, actions } = await ready();
    await actions.addItem({ package_id: 1 });
    await actions.setQuantity({ package_id: 1, quantity: '+1' });
    expect(engine.cart.lines()).toEqual([{ package_id: 1, quantity: 2 }]);
    await actions.setQuantity({ package_id: 1, quantity: '+5', max_quantity: 3 });
    expect(engine.cart.lines()).toEqual([{ package_id: 1, quantity: 3 }]);
    await actions.setQuantity({ package_id: 1, quantity: '-9' });
    expect(engine.cart.lines()).toEqual([{ package_id: 1, quantity: 1 }]);
    expect(await actions.setQuantity({ quantity: '+1' })).toMatchObject({ ok: false });
    await engine.selectors.register('main', cards, 'select', 'one');
    await actions.setQuantity({ selector_id: 'main', quantity: '+1' });
    await actions.setQuantity({ selector_id: 'main', quantity: '+9' });
    expect(engine.getState().selectors.main!.quantities).toEqual({ one: 3 });
    expect(await actions.setQuantity({ selector_id: 'main', quantity: 'x' })).toMatchObject({ ok: false });
  });

  it('picks an option, and refuses one the selector does not have', async () => {
    const { engine, actions } = await ready();
    await engine.selectors.register('main', cards, 'select', 'one');
    expect(await actions.select({ selector_id: 'main', option_id: 'two' })).toEqual({ ok: true });
    expect(engine.getState().selectors.main!.picked).toBe('two');
    expect(await actions.select({ selector_id: 'main', option_id: 'six' })).toMatchObject({ ok: false });
  });

  it('applies and removes a code, and says when a code takes nothing off', async () => {
    const { engine, actions } = await ready();
    await actions.addItem({ package_id: 1 });
    expect(await actions.applyCoupon({ code: 'nope' })).toMatchObject({
      ok: false,
      errors: { code: expect.stringContaining('NOPE') },
    });
    expect(await actions.applyCoupon({ code: 'save10' })).toEqual({ ok: true });
    expect(engine.getState().cart.coupons).toEqual(['SAVE10']);
    expect(await actions.removeCoupon({ code: 'save10' })).toEqual({ ok: true });
    expect(engine.getState().cart.coupons).toEqual([]);
    expect(await actions.applyCoupon({ code: ' ' })).toMatchObject({ ok: false });
  });

  it('sets shipping, clears the cart, and removes a line', async () => {
    const { engine, actions } = await ready();
    await actions.addItem({ items: '1, 2' });
    await actions.removeItem({ package_id: 1 });
    expect(engine.cart.lines()).toEqual([{ package_id: 2, quantity: 1 }]);
    expect(await actions.setShipping({ shipping_id: 1 })).toEqual({ ok: true });
    expect(engine.getState().cart.shippingId).toBe(1);
    await actions.clear();
    expect(engine.cart.lines()).toEqual([]);
    expect(await actions.removeItem({})).toMatchObject({ ok: false });
  });

  it('refuses an upsell without an order on the page, and opens a page through the host', async () => {
    const { actions, navigate } = await ready();
    expect(await actions.acceptUpsell({ items: '7' })).toMatchObject({
      ok: false,
      errors: { order: expect.any(String) },
    });
    expect(await actions.skipUpsell()).toMatchObject({ ok: false });
    expect(await actions.go({ url: 'checkout.html' })).toEqual({ ok: true });
    expect(navigate).toHaveBeenCalledWith('https://shop.test/checkout.html?x=1');
    expect(await actions.go({})).toMatchObject({ ok: false });
    await flush();
  });
});
