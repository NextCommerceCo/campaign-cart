import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { boot, type NextApi } from '../../src/boot';
import { bindAll } from '../../src/bindings';
import { createCheckout } from '../../src/checkout/state/checkout';
import { legacyCheckoutEvents } from '../../src/compat/checkout';
import { legacyEvents, type LegacyDecimal } from '../../src/compat/legacy';
import type { Checkout, EngineEvent } from '../../src/engine/events';
import { bindOrder } from '../../src/order';
import { ADDRESSES, fakeApi, json } from '../fixtures/api';
import { campaign } from '../fixtures/campaign';
import { flush, makeEngine } from '../fixtures/engine';
import { ORDER, withUpsell } from '../fixtures/order';
import { fakeRules } from '../fixtures/rules';
import { FakeObserver } from '../bindings/observer';

const config = { apiKey: 'pk_test', apiBase: 'https://api.test', funnel: '', debug: false, reset: false };

beforeEach(() => {
  vi.stubGlobal('fetch', fakeApi().fetch);
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  delete (window as { nextReady?: unknown }).nextReady;
  sessionStorage.clear();
  localStorage.clear();
  history.replaceState(null, '', '/');
});

/** The payloads `name` delivers to a `next.on` listener added now. */
function heard(source: { on(name: any, fn: (data: any) => void): unknown }, name: string) {
  const payloads: any[] = [];
  source.on(name, (data) => payloads.push(data));
  return payloads;
}

describe('getCartData (0.4.x shape)', () => {
  it('lists lines with packageId the way the variant picker reads them', async () => {
    const next = boot(config, Promise.resolve(campaign));
    await flush();
    await next.addItem({ packageId: 2, quantity: 1 });
    const data = next.getCartData();
    expect(data.cartLines).toEqual([
      {
        packageId: 2,
        quantity: 1,
        name: 'Earbuds ×2',
        image: 'https://cdn.test/2.png',
        price: '89.00',
        total: '89.00',
      },
    ]);
    expect(data.items).toBe(data.cartLines);
    expect(data.cartTotals.total).toBe('89.00');
  });

  it('gives no totals after a failed price, as before the first price, for lines never priced together', async () => {
    const api = fakeApi();
    let failing = false;
    vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) =>
      failing && String(input).includes('/carts/calculate')
        ? Promise.resolve(new Response('{}', { status: 502 }))
        : api.fetch(input, init),
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const next = boot(config, Promise.resolve(campaign));
    await flush();
    await next.addItem({ packageId: 2 });
    expect(next.getCartData().cartTotals.total).toBe('89.00');
    failing = true;
    await next.addItem({ packageId: 9 });
    const data = next.getCartData();
    expect(data.cartLines.map((l) => [l.packageId, l.total])).toEqual([
      [2, undefined],
      [9, undefined],
    ]);
    expect(data.cartTotals).toEqual({
      subtotal: undefined,
      total: undefined,
      discount: undefined,
      currency: undefined,
    });
  });

  it('lists a code entered on an empty cart as applied at once, as 0.4.x did', async () => {
    const next = boot(config, Promise.resolve(campaign));
    await flush();
    expect(await next.applyCoupon('save10')).toBe(true);
    expect(next.getCartData().appliedCoupons).toEqual(['SAVE10']);
  });
});

describe('shipping methods (shop-three-step page script)', () => {
  it('lists, sets and reads the shipping method', async () => {
    const next = boot(config, Promise.resolve(campaign));
    await flush();
    expect(next.getShippingMethods()).toEqual(campaign.shipping_methods);
    await next.setShippingMethod(1);
    expect(next.getState().cart.shippingId).toBe(1);
    expect(next.getSelectedShippingMethod()).toEqual(campaign.shipping_methods[0]);
  });
});

describe('0.4.x event names', () => {
  it('cart:updated carries the priced cart in the 0.4.x shape, and the emptied cart', async () => {
    const next = boot(config, Promise.resolve(campaign));
    await flush();
    const updated = heard(next, 'cart:updated');
    await next.addItem({ packageId: 2, quantity: 1 });
    await next.actions.applyCoupon('SAVE10');
    await vi.waitFor(() => expect(updated.at(-1)?.vouchers).toEqual(['SAVE10']));
    const cart = updated.at(-1);
    expect(cart).toMatchObject({
      items: [
        {
          packageId: 2,
          quantity: 1,
          title: 'Earbuds ×2',
          price: 89,
          qty: 2,
          price_total: '89.00',
          package_price: '89.00',
          total: '89.00',
          is_upsell: false,
        },
      ],
      totalQuantity: 1,
      isEmpty: false,
      currency: 'USD',
      voucherDiscounts: [{ name: 'SAVE10', amount: '10.00' }],
      hasDiscounts: true,
      shippingMethod: { id: 1, code: 'standard', name: 'Standard', hasDiscounts: false },
      summary: { lines: [{ package_id: 2, name: 'Earbuds ×2', qty: 2 }] },
      isCalculating: false,
    });
    const totals: LegacyDecimal[] = [cart.subtotal, cart.totalDiscount, cart.total];
    expect(totals.map((d) => d.toNumber())).toEqual([89, 10, 79]);
    expect([cart.total.toFixed(2), `${cart.total}`, JSON.stringify(cart.total)]).toEqual(['79.00', '79', '"79"']);
    expect(updated.every((c) => !c.isCalculating)).toBe(true);

    await next.actions.clear();
    expect(updated.at(-1)).toMatchObject({ items: [], isEmpty: true, totalQuantity: 0, vouchers: [] });
    expect(updated.at(-1).total.toNumber()).toBe(0);
  });

  it('cart item events: one per operation with the package as 0.4.43 sent it, and none for a swap-mode bundle selector', async () => {
    document.body.innerHTML = `<div data-next-bundle-selector data-next-selector-id="main">
      <div data-next-bundle-card data-next-bundle-id="one" data-next-bundle-items='[{"packageId":1,"quantity":1}]'></div>
      <div id="two" data-next-bundle-card data-next-bundle-id="two" data-next-bundle-items='[{"packageId":2,"quantity":1}]'></div></div>`;
    const next = boot(config, Promise.resolve(campaign));
    await flush();
    const added = heard(next, 'cart:item-added');
    const removed = heard(next, 'cart:item-removed');
    const changed = heard(next, 'cart:quantity-changed');
    await next.addItem({ packageId: 9, quantity: 1 });
    await next.actions.addItem(9, 2);
    await next.actions.setQuantity(9, 5);
    await next.actions.setQuantity(9, 4);
    await next.actions.removeItem(9);
    document.querySelector<HTMLElement>('#two')!.click();
    await flush();
    expect(next.getState().cart.groups['bundle:main']?.lines).toEqual([{ packageId: 2, quantity: 1 }]);
    expect(added).toEqual([
      { packageId: 9, quantity: 1, source: 'direct' },
      { packageId: 9, quantity: 2, source: 'direct' },
    ]);
    expect(changed).toEqual([
      { packageId: 9, quantity: 5, oldQuantity: 3 },
      { packageId: 9, quantity: 4, oldQuantity: 5 },
    ]);
    expect(removed).toEqual([{ packageId: 9 }]);
  });

  it('a quantity set to zero sends cart:item-removed and cart:quantity-changed, as 0.4.43’s quantity control did; emptying or replacing the cart sends no item event', async () => {
    const next = boot(config, Promise.resolve(campaign));
    await flush();
    await next.addItem({ packageId: 9, quantity: 2 });
    const added = heard(next, 'cart:item-added');
    const removed = heard(next, 'cart:item-removed');
    const changed = heard(next, 'cart:quantity-changed');
    await next.actions.setQuantity(9, 0);
    expect(removed).toEqual([{ packageId: 9 }]);
    expect(changed).toEqual([{ packageId: 9, quantity: 0, oldQuantity: 2 }]);
    await next.swapCart([{ packageId: 9, quantity: 1 }]);
    await next.clearCart();
    await next.addItem({ packageId: 1 });
    await next.actions.clear();
    expect(added).toEqual([{ packageId: 1, quantity: 1, source: 'direct' }]);
    expect(removed).toHaveLength(1);
    expect(changed).toHaveLength(1);
  });

  it('item events keep the cart action that made them when a synced toggle follows a swap pick', async () => {
    document.body.innerHTML = `<div data-next-bundle-selector data-next-selector-id="main">
      <div data-next-bundle-card data-next-bundle-id="one" data-next-bundle-items='[{"packageId":1,"quantity":1}]'></div>
      <div id="two" data-next-bundle-card data-next-bundle-id="two" data-next-bundle-items='[{"packageId":2,"quantity":1}]'></div></div>
      <div id="plan" data-next-toggle-card data-next-package-id="9" data-next-product-sync="400"></div>`;
    const next = boot(config, Promise.resolve(campaign));
    await flush();
    document.querySelector<HTMLElement>('#plan')!.click();
    await flush();
    const added = heard(next, 'cart:item-added');
    const removed = heard(next, 'cart:item-removed');
    document.querySelector<HTMLElement>('#two')!.click();
    await flush();
    expect(next.getState().cart.groups).toMatchObject({
      'bundle:main': { lines: [{ packageId: 2, quantity: 1 }] },
      'toggle:9': { lines: [{ packageId: 9, quantity: 2 }] },
    });
    expect(added).toEqual([{ packageId: 9, quantity: 1 }]);
    expect(removed).toEqual([]);
  });

  it('item events and action:success keep the click or call that made them when a synced toggle follows', async () => {
    document.body.innerHTML = `<button id="add" data-next-action="add-to-cart" data-next-package-id="1">Add</button>
      <div data-next-toggle-card data-next-package-id="9" data-next-product-sync="400" data-next-selected="true"></div>`;
    const next = boot(config, Promise.resolve(campaign));
    await flush();
    const added = heard(next, 'cart:item-added');
    const changed = heard(next, 'cart:quantity-changed');
    const success = heard(next, 'action:success');
    document.querySelector<HTMLElement>('#add')!.click();
    await flush();
    await next.actions.setQuantity(1, 3);
    await flush();
    expect(next.getState().cart.groups['toggle:9']?.lines).toEqual([{ packageId: 9, quantity: 3 }]);
    expect(added).toEqual([
      { packageId: 1, quantity: 1, source: 'direct' },
      { packageId: 9, quantity: 1 },
      { packageId: 9, quantity: 2 },
    ]);
    expect(changed).toEqual([{ packageId: 1, quantity: 3, oldQuantity: 1 }]);
    expect(success).toEqual([{ action: 'AddToCartEnhancer', data: { element: document.getElementById('add') } }]);
  });

  it('cart:item-added names the selector a select-mode add-to-cart button took its card from', async () => {
    document.body.innerHTML = `<div data-next-bundle-selector data-next-selector-id="main" data-next-selection-mode="select">
      <div data-next-bundle-card data-next-bundle-id="one" data-next-bundle-items='[{"packageId":1,"quantity":1}]'></div></div>
      <button id="add" data-next-action="add-to-cart" data-next-selector-id="main">Add</button>`;
    const next = boot(config, Promise.resolve(campaign));
    await flush();
    const added = heard(next, 'cart:item-added');
    document.querySelector<HTMLElement>('#add')!.click();
    await flush();
    expect(added).toEqual([{ packageId: 1, quantity: 1, source: 'selector' }]);
  });

  it('action:success names the add-to-cart button or coupon field that did its work, as 0.4.43; never a page script’s call', async () => {
    document.body.innerHTML = `<button id="add" data-next-action="add-to-cart" data-next-package-id="1">Add</button>
      <div data-next-bundle-selector data-next-selector-id="main" data-next-selection-mode="select">
        <div data-next-bundle-card data-next-bundle-id="one" data-next-bundle-items='[{"packageId":2,"quantity":1}]'></div></div>
      <button id="bundle" data-next-action="add-to-cart" data-next-selector-id="main">Add bundle</button>
      <div id="coupon" data-next-coupon><input><button>Apply</button></div>`;
    const next = boot(config, Promise.resolve(campaign));
    await flush();
    const success = heard(next, 'action:success');
    const el = (id: string) => document.getElementById(id)!;
    await next.addItem({ packageId: 3 });
    await next.actions.addItem(3);
    el('add').click();
    el('bundle').click();
    await flush();
    const coupon = (code: string) => {
      el('coupon').querySelector('input')!.value = code;
      el('coupon').querySelector('button')!.click();
    };
    coupon('SAVE10');
    await vi.waitFor(() => expect(next.getState().cart.coupons).toEqual(['SAVE10']));
    coupon('NOPE');
    await vi.waitFor(() => expect(success).toHaveLength(4));
    await next.actions.applyCoupon('SAVE5');
    await next.applyCoupon('NOPE2');
    await flush();
    expect(success).toEqual([
      { action: 'AddToCartEnhancer', data: { element: el('add') } },
      { action: 'AddToCartEnhancer', data: { element: el('bundle') } },
      { action: 'CouponEnhancer', data: { element: el('coupon') } },
      { action: 'CouponEnhancer', data: { element: el('coupon') } },
    ]);
  });

  it('coupon events carry the code, a refusal its message, and clearing the cart sends no coupon:removed', async () => {
    const next = boot(config, Promise.resolve(campaign));
    await flush();
    await next.addItem({ packageId: 1 });
    const applied = heard(next, 'coupon:applied');
    const removed = heard(next, 'coupon:removed');
    const refused = heard(next, 'coupon:validation-failed');
    await next.actions.applyCoupon('save10');
    await next.actions.applyCoupon('SAVE10');
    expect(await next.applyCoupon('nope')).toBe(false);
    await next.actions.removeCoupon('SAVE10');
    await next.actions.applyCoupon('SAVE10');
    await next.actions.clear();
    expect(applied).toEqual([{ code: 'SAVE10' }, { code: 'SAVE10' }]);
    expect(refused).toEqual([
      { code: 'SAVE10', message: 'Coupon SAVE10 is already applied.' },
      { code: 'NOPE', message: "Coupon NOPE isn't valid for this order." },
    ]);
    expect(removed).toEqual([{ code: 'SAVE10' }]);
  });

  it('selection events fire for a selector shown, picked or stepped, and toggles list what is on', async () => {
    const { engine } = makeEngine();
    await engine.start();
    const legacy = legacyEvents(engine);
    const bundle = heard(legacy, 'bundle:selection-changed');
    const single = heard(legacy, 'selector:selection-changed');
    const picked = heard(legacy, 'bundle:selected');
    const item = heard(legacy, 'selector:item-selected');
    const stepped = heard(legacy, 'bundle:quantity-changed');
    const singleStepped = heard(legacy, 'selector:quantity-changed');
    const offers = heard(legacy, 'upsell-selector:item-selected');
    const cards = [
      { id: 'one', lines: [{ packageId: 1, quantity: 1 }], vouchers: [] },
      {
        id: 'two',
        lines: [
          { packageId: 2, quantity: 1 },
          { packageId: 3, quantity: 1 },
        ],
        vouchers: [],
      },
    ];
    await engine.selectors.register('main', cards, 'select');
    await engine.selectors.pick('main', 'two');
    await engine.selectors.setQuantity('main', 2);
    expect(bundle).toEqual([
      { selectorId: 'main', items: [{ packageId: 1, quantity: 1 }] },
      {
        selectorId: 'main',
        items: [
          { packageId: 2, quantity: 1 },
          { packageId: 3, quantity: 1 },
        ],
      },
      {
        selectorId: 'main',
        items: [
          { packageId: 2, quantity: 2 },
          { packageId: 3, quantity: 2 },
        ],
      },
    ]);
    expect(single).toEqual([
      { selectorId: 'main', packageId: 1, quantity: 1 },
      { selectorId: 'main' },
      { selectorId: 'main' },
    ]);
    expect(picked).toEqual([bundle[1]]);
    expect(item).toEqual([
      { selectorId: 'main', packageId: 2, previousPackageId: 1, mode: 'select', pendingAction: true },
    ]);
    expect(stepped).toEqual([{ ...bundle[2], bundleId: 'two', quantity: 2 }]);
    expect(singleStepped).toEqual([{ selectorId: 'main' }]);
    expect(offers).toEqual([]);

    await engine.selectors.register('upsell', cards, 'offer');
    await engine.selectors.pick('upsell', 'two');
    const options = heard(legacy, 'upsell:option-selected');
    const quantities = heard(legacy, 'upsell:quantity-changed');
    await engine.selectors.pick('upsell', 'one');
    await engine.selectors.setQuantity('upsell', 3);
    expect(offers).toEqual([
      { selectorId: 'upsell', packageId: 2 },
      { selectorId: 'upsell', packageId: 1 },
    ]);
    expect(options).toEqual([{ selectorId: 'upsell', packageId: 1 }]);
    expect(quantities).toEqual([{ selectorId: 'upsell', quantity: 3, packageId: 1 }]);

    document.body.innerHTML = `<div id="plan" data-next-toggle-card data-next-package-id="9"></div>`;
    const next = boot(config, Promise.resolve(campaign));
    await flush();
    const toggled = heard(next, 'toggle:selection-changed');
    const switched = heard(next, 'toggle:toggled');
    document.querySelector<HTMLElement>('#plan')!.click();
    await flush();
    document.querySelector<HTMLElement>('#plan')!.click();
    await flush();
    expect(toggled).toEqual([{ selected: [9] }, { selected: [] }]);
    expect(switched).toEqual([
      { packageId: 9, added: true },
      { packageId: 9, added: false },
    ]);
  });

  it('selection events of a selector bound off screen fire at bind, before its selector.viewed, as 0.4.43', async () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    document.body.innerHTML = `<div data-next-bundle-selector data-next-selector-id="main">
      <div data-next-bundle-card data-next-bundle-id="one" data-next-bundle-items='[{"packageId":1,"quantity":1}]'></div></div>`;
    const { engine } = makeEngine();
    await engine.start();
    const single = heard(legacyEvents(engine), 'selector:selection-changed');
    const viewed = vi.fn();
    engine.on('selector.viewed', viewed);
    bindAll(document, engine, vi.fn());
    await flush();
    expect(single).toEqual([{ selectorId: 'main', packageId: 1, quantity: 1 }]);
    expect(viewed).not.toHaveBeenCalled();
  });

  it('selector:item-selected names the previous pick whichever order the listeners run in', async () => {
    const { engine } = makeEngine();
    await engine.start();
    const on = engine.on.bind(engine);
    const named: Array<() => void> = [];
    vi.spyOn(engine, 'on').mockImplementation(((name: string, fn: (e: EngineEvent) => void, options?: object) => {
      if (name === '*') return on('*', fn, options);
      named.push(() => on('*', (e) => e.name === name && fn(e)));
      return () => {};
    }) as never);
    const legacy = legacyEvents(engine);
    const item = heard(legacy, 'selector:item-selected');
    named.forEach((add) => add());
    const cards = [1, 2].map((id) => ({ id: `c${id}`, lines: [{ packageId: id, quantity: 1 }], vouchers: [] }));
    await engine.selectors.register('main', cards, 'select');
    await engine.selectors.pick('main', 'c2');
    await engine.selectors.pick('main', 'c1');
    expect(item.map((i) => i.previousPackageId)).toEqual([1, 2]);
  });

  it('a lazy chunk’s 0.4.x names reach only the engine that loaded it', async () => {
    const engines = await Promise.all(
      [0, 1].map(async () => {
        const { engine } = makeEngine();
        await engine.start();
        return { engine, legacy: legacyEvents(engine) };
      }),
    );
    legacyCheckoutEvents(engines[0]!.engine, document.createElement('form'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const heardBy = engines.map(({ legacy }) => heard(legacy, 'payment:tokenized'));
    const checkout: Checkout = { id: 'c1', cart: { lines: [], coupons: [] } };
    for (const { engine } of engines)
      engine.events.emit('checkout.submitted', { ...checkout, payment_method: 'card_token' });
    expect(heardBy).toEqual([[{ paymentMethod: 'credit-card' }], []]);
  });

  it('shipping events carry the method id and the campaign’s method', async () => {
    const next = boot(config, Promise.resolve(campaign));
    await flush();
    const changed = heard(next, 'shipping:method-changed');
    const selected = heard(next, 'shipping:method-selected');
    await next.addItem({ packageId: 1 });
    await flush();
    const order: string[] = [];
    for (const name of ['cart:updated', 'shipping:method-changed']) next.on(name as never, () => order.push(name));
    await next.actions.setShipping(1);
    await vi.waitFor(() => expect(changed).toEqual([{ methodId: 1, method: campaign.shipping_methods[0] }]));
    expect(selected).toEqual([{ shippingId: '1' }]);
    expect(order).toEqual(['cart:updated', 'shipping:method-changed']);
  });

  it('checkout:started carries the form under 0.4.x field names', async () => {
    const { engine } = makeEngine();
    await engine.start();
    await engine.cart.addItem(2);
    const legacy = legacyEvents(engine);
    legacyCheckoutEvents(engine, document.createElement('form'));
    const started = heard(legacy, 'checkout:started');
    const checkout = engine.attach((ctx) =>
      createCheckout(ctx, engine.cart, fakeRules().api, { opened: legacy.checkoutStarted }),
    );
    checkout.setField('email', 'jane@example.com');
    checkout.setField('first_name', 'Jane');
    checkout.setField('line1', '1 Main St');
    checkout.setField('billing_postcode', '73301');
    checkout.begin();
    expect(started).toEqual([
      {
        formData: { email: 'jane@example.com', fname: 'Jane', address1: '1 Main St', billing_postal: '73301' },
        paymentMethod: 'credit-card',
        isProcessing: false,
        step: 1,
      },
    ]);
  });

  it('payment events: a card token, a refused or failed order, and wallet orders', async () => {
    const { engine } = makeEngine();
    await engine.start();
    const legacy = legacyEvents(engine);
    legacyCheckoutEvents(engine, document.createElement('form'));
    const tokenized = heard(legacy, 'payment:tokenized');
    const started = heard(legacy, 'express-checkout:started');
    const refused = heard(legacy, 'express-checkout:error');
    const errors = heard(legacy, 'payment:error');
    const completed = heard(legacy, 'express-checkout:completed');
    const done = heard(legacy, 'checkout:express-completed');
    const failed = heard(legacy, 'express-checkout:failed');
    const checkout: Checkout = { id: 'c1', cart: { lines: [], coupons: [] } };
    const emit = engine.events.emit.bind(engine.events);
    const placedBy = (express: boolean) => engine.attach((ctx) => ctx.update('checkout', { express }));
    placedBy(false);
    emit('checkout.invalid', {
      ...checkout,
      payment_method: 'card_token',
      errors: { form: { code: 'card', message: 'Enter a valid card number' } },
    });
    emit('checkout.submitted', { ...checkout, payment_method: 'card_token' });
    placedBy(true);
    emit('checkout.submitted', { ...checkout, payment_method: 'paypal' });
    emit('checkout.invalid', { ...checkout, payment_method: 'apple_pay', errors: { form: { code: 'empty_cart' } } });
    const declined = { code: 'declined', status: 400, message: 'Your card was declined.', decline_code: '05' } as const;
    placedBy(false);
    emit('payment.failed', { method: 'card_token', error: declined });
    placedBy(true);
    emit('checkout.failed', {
      ...checkout,
      payment_method: 'paypal',
      error: { code: 'network', message: 'Failed to fetch' },
    });
    placedBy(false);
    emit('payment.redirected', { method: 'card_token', ref_id: 'R8', url: 'https://pay.test/3ds' });
    placedBy(true);
    emit('payment.redirected', { method: 'paypal', ref_id: 'R9', url: 'https://pay.test/R9' });
    expect(tokenized).toEqual([{ paymentMethod: 'credit-card' }]);
    expect(started).toEqual([{ method: 'paypal', itemCount: 0 }]);
    expect(refused).toEqual([{ method: 'apple_pay', error: 'Cart is empty' }]);
    expect(errors).toEqual([
      { message: 'Enter a valid card number' },
      { message: 'Your card was declined.', code: '05', details: declined },
      {
        message: 'Failed to process order. Please try again.',
        details: { code: 'network', message: 'Failed to fetch' },
      },
    ]);
    expect(failed).toEqual([{ method: 'paypal', error: 'Failed to fetch' }]);
    expect(completed).toEqual([
      { method: 'paypal', order: { ref_id: 'R9', payment_complete_url: 'https://pay.test/R9' } },
    ]);
    expect(done).toEqual([{ method: 'paypal', success: true }]);
  });

  it('payment:tokenized says once a page that it no longer sends token and pmData', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { engine } = makeEngine();
    await engine.start();
    const legacy = legacyEvents(engine);
    legacyCheckoutEvents(engine, document.createElement('form'));
    const one = heard(legacy, 'payment:tokenized');
    const two = heard(legacy, 'payment:tokenized');
    const checkout: Checkout = { id: 'c1', cart: { lines: [], coupons: [] } };
    for (let i = 0; i < 2; i++) engine.events.emit('checkout.submitted', { ...checkout, payment_method: 'card_token' });
    expect([...one, ...two]).toEqual(Array(4).fill({ paymentMethod: 'credit-card' }));
    expect(engine.log.entries().filter((e) => e.message.includes('payment:tokenized'))).toEqual([
      expect.objectContaining({
        level: 'warn',
        message: 'next.on: "payment:tokenized" no longer sends token and pmData',
      }),
    ]);
  });

  it('wallet events follow the express button, also when the form has the same method picked', async () => {
    const shipping = {
      country: 'US',
      email: 'jane@example.com',
      first_name: 'Jane',
      last_name: 'Doe',
      line1: '1 Main St',
      city: 'Austin',
      state: 'CA',
      postcode: '90210',
    };
    const place = async (expressMethod?: string) => {
      const order = () => json({ ref_id: 'R9', payment_complete_url: 'https://pay.test/R9' });
      const { engine } = makeEngine({ fetch: fakeApi({ order }).fetch });
      await engine.start();
      await engine.cart.addItem(1);
      const legacy = legacyEvents(engine);
      legacyCheckoutEvents(engine, document.createElement('form'));
      const started = heard(legacy, 'express-checkout:started');
      const completed = heard(legacy, 'checkout:express-completed');
      const checkout = engine.attach((ctx) => createCheckout(ctx, engine.cart, fakeRules().api));
      await checkout.loadCountries();
      Object.entries(shipping).forEach(([name, value]) => checkout.setField(name, value));
      checkout.setPaymentMethod('paypal');
      await flush();
      const urls = { failureUrl: 'https://shop.test/checkout/', pageUrl: 'https://shop.test/checkout/' };
      expect(await checkout.placeOrder({ ...urls, expressMethod })).toMatchObject({ ref_id: 'R9' });
      return { started, completed };
    };
    expect(await place('paypal')).toEqual({
      started: [{ method: 'paypal', itemCount: 1 }],
      completed: [{ method: 'paypal', success: true }],
    });
    expect(await place()).toEqual({ started: [], completed: [] });
  });

  it('order:completed carries the order from the API on the page after the checkout, paid or not', async () => {
    history.replaceState(null, '', '/thank-you/?ref_id=R1');
    const next = boot(config, Promise.resolve(campaign));
    const completed = heard(next, 'order:completed');
    await vi.waitFor(() => expect(completed).toEqual([{ ...ORDER, ref_id: 'R1' }]));

    const unpaid = { ...ORDER, ref_id: 'R2', payment_complete_url: 'https://pay.test/R2' };
    vi.stubGlobal('fetch', fakeApi({ getOrder: () => json(unpaid) }).fetch);
    history.replaceState(null, '', '/checkout/?ref_id=R2&payment_failed=true');
    const failedPage = boot(config, Promise.resolve(campaign));
    const returned = heard(failedPage, 'order:completed');
    await vi.waitFor(() => expect(returned).toEqual([unpaid]));
  });

  describe('upsells', () => {
    async function upsellPage(api = fakeApi()) {
      history.replaceState(null, '', '/upsell/?ref_id=R1');
      document.body.innerHTML = `<div id="first" data-next-upsell data-next-package-id="3"><button data-next-upsell-action="add">Add</button></div>
        <div id="second" data-next-upsell data-next-package-id="9"><button data-next-upsell-action="skip">No</button></div>`;
      const { engine } = makeEngine({ fetch: api.fetch, params: { ref_id: 'R1' }, session: sessionStorage });
      await engine.start();
      const legacy = legacyEvents(engine);
      const names = ['initialized', 'viewed', 'adding', 'accepted', 'added', 'skipped', 'error'] as const;
      const seen = Object.fromEntries(names.map((n) => [n, heard(legacy, `upsell:${n}`)]));
      const failed = heard(legacy, 'action:failed');
      bindAll(document, engine, () => {});
      await bindOrder(engine, vi.fn());
      await flush();
      const click = (selector: string) => document.querySelector<HTMLElement>(selector)!.click();
      return { seen, failed, click };
    }

    it('carry the package and the order, upsell:viewed once a page, and only upsell:added for an accepted offer, as 0.4.43', async () => {
      const { seen, click } = await upsellPage();
      click('#first button');
      click('#first button');
      await vi.waitFor(() => expect(seen.added).toHaveLength(1));
      click('#second button');
      const offer = (id: string) => document.getElementById(id);
      expect(seen).toEqual({
        initialized: [
          { packageId: 3, element: offer('first') },
          { packageId: 9, element: offer('second') },
        ],
        viewed: [{ pagePath: '/upsell/', orderId: 'R1' }],
        adding: [{ packageId: 3 }],
        accepted: [],
        added: [{ packageId: 3, quantity: 1, order: withUpsell(ORDER, 99, 1), willRedirect: false }],
        skipped: [{ packageId: 9, orderId: 'R1' }],
        error: [],
      });
    });

    it('upsell:error and action:failed carry the failure', async () => {
      const api = fakeApi({ upsell: () => json({ message: 'Card declined' }, 400) });
      const { seen, failed, click } = await upsellPage(api);
      click('#first button');
      await vi.waitFor(() => expect(seen.error).toHaveLength(1));
      expect(seen.error).toEqual([{ packageId: 3, error: 'Card declined' }]);
      expect(failed).toEqual([{ action: 'AcceptUpsellEnhancer', error: expect.any(Error) }]);
    });
  });

  it('SDK events: campaign:loaded once with the campaign, and the ones a page listening late still gets', async () => {
    history.replaceState(null, '', '/lp/?currency=eur');
    boot(config, Promise.resolve(campaign));
    await flush();
    const seen: Record<string, unknown[]> = {};
    const names = ['campaign:loaded', 'currency:fallback', 'sdk:url-parameters-processed', 'error:occurred'];
    (window as unknown as { nextReady: unknown[] }).nextReady = [
      (next: NextApi) => names.forEach((name) => (seen[name] = heard(next, name))),
    ];
    boot(config, Promise.reject(Object.assign(new Error('down'), { status: 503 })));
    await vi.waitFor(() => expect(seen['sdk:url-parameters-processed']).toEqual([{}]));
    expect(seen['campaign:loaded']).toEqual([campaign]);
    expect(seen['currency:fallback']).toEqual([{ requested: 'EUR', actual: 'USD', reason: 'cached' }]);
    expect(seen['error:occurred']).toEqual([
      { message: 'down', code: expect.any(String), details: expect.objectContaining({ action: 'campaign.load' }) },
    ]);

    const next = boot(config, Promise.resolve(campaign));
    const fallback = heard(next, 'currency:fallback');
    const loaded = heard(next, 'campaign:loaded');
    await flush();
    expect(fallback).toEqual([{ requested: 'EUR', actual: 'USD', reason: 'cached' }]);
    expect(loaded).toEqual([campaign]);
    localStorage.clear();
    const fresh = heard(boot(config, Promise.resolve(campaign)), 'currency:fallback');
    await flush();
    expect(fresh).toEqual([{ requested: 'EUR', actual: 'USD', reason: 'api' }]);
  });
});

describe('0.4.x page moments', () => {
  it('widgets send timer:expired, accordion:* and scroll-hint:updated', async () => {
    document.body.innerHTML = `<div data-next-timer data-duration="1" data-persistence-id="sale"></div>
      <div id="faq" data-next-accordion="faq"><button data-next-accordion-trigger="faq">Q</button><div data-next-accordion-panel="faq">A</div></div>
      <div class="cart-items"><div id="list" class="cart-items__list"></div><div data-next-component="scroll-hint"></div></div>`;
    const list = document.getElementById('list')!;
    Object.defineProperties(list, { scrollHeight: { value: 400 }, clientHeight: { value: 100 } });
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'Date'] });
    try {
      const next = boot(config, Promise.resolve(campaign));
      const seen = Object.fromEntries(
        ['timer:expired', 'accordion:opened', 'accordion:closed', 'accordion:toggled', 'scroll-hint:updated'].map(
          (name) => [name, heard(next, name)],
        ),
      );
      await vi.waitFor(() => expect(seen['scroll-hint:updated']).toHaveLength(1));
      document.querySelector<HTMLElement>('[data-next-accordion-trigger]')!.click();
      document.querySelector<HTMLElement>('[data-next-accordion-trigger]')!.click();
      vi.advanceTimersByTime(1500);
      const faq = document.getElementById('faq');
      expect(seen).toEqual({
        'timer:expired': [{ persistenceId: 'sale' }],
        'accordion:opened': [{ id: 'faq', element: faq }],
        'accordion:closed': [{ id: 'faq', element: faq }],
        'accordion:toggled': [
          { id: 'faq', isOpen: true, element: faq },
          { id: 'faq', isOpen: false, element: faq },
        ],
        'scroll-hint:updated': [{ isVisible: true, scrollTop: 0, scrollHeight: 400, clientHeight: 100 }],
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('the checkout page sends checkout:form-initialized, express buttons, revealed location fields and address blocks', async () => {
    document.body.innerHTML = `<div data-next-express-checkout="container"></div>
      <form data-next-checkout="form"><input data-next-checkout-field="email">
      <div data-next-address="shipping"></div>
      <input data-next-checkout-field="address1"><div id="where" data-next-component="location"></div></form>`;
    const form = document.querySelector('form')!;
    const shown = vi.fn();
    form.addEventListener('checkout:location-fields-shown', shown);
    const next = boot(
      config,
      Promise.resolve({
        ...campaign,
        available_express_payment_methods: [{ code: 'paypal', label: 'PayPal' }],
        available_shipping_countries: [{ code: 'US', label: 'United States' }],
      }),
    );
    const seen = Object.fromEntries(
      [
        'checkout:form-initialized',
        'express-checkout:initialized',
        'checkout:location-fields-shown',
        'address:fields-rendered',
      ].map((name) => [name, heard(next, name)]),
    );
    await vi.waitFor(() => expect(seen['checkout:form-initialized']).toEqual([{ form }]));
    const paypal = document.querySelector('button[data-next-express-checkout="paypal"]');
    expect(seen['express-checkout:initialized']).toEqual([{ method: 'paypal', element: paypal }]);
    await vi.waitFor(() =>
      expect(seen['address:fields-rendered']).toEqual([
        { form: 'shipping', country: 'US', fields: expect.arrayContaining(['fname', 'postal']) },
      ]),
    );
    await vi.waitFor(() => expect(document.getElementById('where')!.classList).toContain('next-location-hidden'));
    const line1 = document.querySelector<HTMLInputElement>('[data-next-checkout-field="address1"]')!;
    line1.value = '1 Main St';
    line1.dispatchEvent(new Event('input', { bubbles: true }));
    line1.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => expect(seen['checkout:location-fields-shown']).toEqual([{}]));
    expect(shown).toHaveBeenCalledTimes(1);
  });

  it('address:autocomplete-filled carries the suggestion that filled the address', async () => {
    (window as unknown as { nextConfig: unknown }).nextConfig = { addressConfig: { enableAutocomplete: true } };
    document.body.innerHTML = `<form data-next-checkout="form"><input data-next-checkout-field="email">
      <input data-next-checkout-field="address1"><input data-next-checkout-field="city"></form>`;
    try {
      const next = boot(config, Promise.resolve(campaign));
      const filled = heard(next, 'address:autocomplete-filled');
      const input = document.querySelector<HTMLInputElement>('[data-next-checkout-field="address1"]')!;
      await vi.waitFor(() => expect(document.querySelector('form')!.noValidate).toBe(true));
      input.focus();
      input.value = '1 Main';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await vi.waitFor(() => expect(document.querySelector('.pac-item-nextcommerce')).not.toBeNull());
      document.querySelector<HTMLElement>('.pac-item-nextcommerce')!.click();
      expect(filled).toEqual([{ type: 'shipping', components: ADDRESSES[0] }]);
    } finally {
      delete (window as unknown as { nextConfig?: unknown }).nextConfig;
    }
  });

  it('says a 0.4.x name is no longer sent, and why', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const next = boot(config, Promise.resolve(campaign));
    next.on('cart:package-swapped' as never, vi.fn());
    expect(warn.mock.calls.map(([text]) => text)).toEqual([
      '[next] next.on: "cart:package-swapped" is no longer sent: package selectors are gone; listen for cart.added and cart.removed',
    ]);
  });

  it('says upsell:accepted is no longer sent: offers send upsell:added', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const next = boot(config, Promise.resolve(campaign));
    next.on('upsell:accepted' as never, vi.fn());
    expect(warn.mock.calls.map(([text]) => text)).toEqual([
      '[next] next.on: "upsell:accepted" is no longer sent: offers send upsell:added',
    ]);
  });
});

describe('coupons (0.4.x)', () => {
  it('refuses a code the server gives nothing for, under the old event name too', async () => {
    const next = boot(config, Promise.resolve(campaign));
    await flush();
    await next.addItem({ packageId: 1 });
    const failed = vi.fn();
    next.on('coupon:validation-failed' as never, failed);
    expect(await next.applyCoupon('nope')).toBe(false);
    expect(failed).toHaveBeenCalledWith(
      { code: 'NOPE', message: "Coupon NOPE isn't valid for this order." },
      expect.anything(),
    );
    expect(next.getState().cart.coupons).toEqual([]);
  });
});

describe('exitIntent', () => {
  const leave = () => document.dispatchEvent(new MouseEvent('mouseout', { clientY: -1, relatedTarget: null }));

  it('shows an image popup on exit, runs the action on click, and only once per session', async () => {
    const next = boot(config, Promise.resolve(campaign));
    await flush();
    const action = vi.fn(() => next.applyCoupon('EXIT10'));
    const shown = heard(next, 'exit-intent:shown');
    const clicked = heard(next, 'exit-intent:clicked');
    await next.exitIntent({ image: 'https://cdn.test/exit.png', action, showCloseButton: true });

    leave();
    expect(shown).toEqual([{ imageUrl: 'https://cdn.test/exit.png', template: '' }]);
    expect(document.querySelector('.exit-intent-overlay')).not.toBeNull();
    expect(document.querySelector('.exit-intent-close')).not.toBeNull();

    document.querySelector<HTMLElement>('.exit-intent-popup img')!.click();
    await flush();
    expect(action).toHaveBeenCalledTimes(1);
    expect(clicked).toEqual([{ imageUrl: 'https://cdn.test/exit.png' }]);
    expect(next.getCartData().appliedCoupons).toEqual(['EXIT10']);
    expect(document.querySelector('.exit-intent-popup')).toBeNull();

    leave();
    expect(shown).toHaveLength(1);
  });

  it('runs template buttons and closes on Escape or the close button, under the 0.4.x names', async () => {
    document.body.innerHTML = `<template data-template="exit-intent">
      <div class="exit-intent-popup__dialog"><button data-exit-intent-action="apply-coupon" data-coupon-code="EXIT10">Apply</button></div></template>
      <div id="banner" data-next-promotion="hero"></div>`;
    const next = boot(config, Promise.resolve(campaign));
    await flush();
    const seen = Object.fromEntries(
      ['shown', 'clicked', 'action', 'dismissed', 'closed'].map((n) => [n, heard(next, `exit-intent:${n}`)]),
    );
    await next.exitIntent({ template: 'exit-intent', maxTriggers: 3, showCloseButton: true });

    leave();
    document.querySelector<HTMLElement>('[data-exit-intent-action]')!.click();
    await flush();
    expect(next.getCartData().appliedCoupons).toEqual(['EXIT10']);
    leave();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.exit-intent-popup')).toBeNull();
    leave();
    document.querySelector<HTMLElement>('.exit-intent-close')!.click();
    document.querySelector<HTMLElement>('#banner')!.click();
    const popup = { imageUrl: '', template: 'exit-intent' };
    expect(seen).toEqual({
      shown: [popup, popup, popup],
      clicked: [],
      action: [{ action: 'apply-coupon', couponCode: 'EXIT10' }],
      dismissed: [popup],
      closed: [popup],
    });
  });

  it('names the image and the template of a popup given both, as 0.4.43 did', async () => {
    document.body.innerHTML = `<template data-template="exit-intent"><p>Wait!</p></template>`;
    const next = boot(config, Promise.resolve(campaign));
    await flush();
    const seen = Object.fromEntries(['shown', 'dismissed', 'closed'].map((n) => [n, heard(next, `exit-intent:${n}`)]));
    const image = 'https://cdn.test/exit.png';
    await next.exitIntent({ image, template: 'exit-intent', maxTriggers: 2, showCloseButton: true });
    leave();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    leave();
    document.querySelector<HTMLElement>('.exit-intent-close')!.click();
    const popup = { imageUrl: image, template: 'exit-intent' };
    expect(seen).toEqual({ shown: [popup, popup], dismissed: [popup], closed: [popup] });
  });

  it('sends exit-intent:action for a custom button once its action has run, as 0.4.43 did', async () => {
    document.body.innerHTML = `<template data-template="exit-intent"><button data-exit-intent-action="custom">Go</button></template>`;
    const next = boot(config, Promise.resolve(campaign));
    await flush();
    const action = heard(next, 'exit-intent:action');
    const clicked = heard(next, 'promotion.clicked');
    let finish!: () => void;
    await next.exitIntent({ template: 'exit-intent', action: () => new Promise<void>((r) => (finish = r)) });
    leave();
    document.querySelector<HTMLElement>('[data-exit-intent-action]')!.click();
    expect(clicked).toHaveLength(1);
    expect(action).toEqual([]);
    finish();
    await flush();
    expect(action).toEqual([{ action: 'custom' }]);
  });

  it('sends exit-intent:action for a custom button whose action removes the popup, once the action has run', async () => {
    document.body.innerHTML = `<template data-template="exit-intent"><button data-exit-intent-action="custom">Go</button></template>`;
    const next = boot(config, Promise.resolve(campaign));
    await flush();
    const action = heard(next, 'exit-intent:action');
    const remove: () => void = await next.exitIntent({ template: 'exit-intent', action: () => remove() });
    leave();
    document.querySelector<HTMLElement>('[data-exit-intent-action]')!.click();
    await flush();
    expect(document.querySelector('.exit-intent-popup')).toBeNull();
    expect(action).toEqual([{ action: 'custom' }]);
  });

  it('closes the popup without exit-intent:dismissed or exit-intent:closed when the page removes it', async () => {
    const next = boot(config, Promise.resolve(campaign));
    await flush();
    const seen = ['dismissed', 'closed'].map((n) => heard(next, `exit-intent:${n}`));
    const remove = await next.exitIntent({ image: 'https://cdn.test/exit.png' });
    leave();
    remove();
    expect(document.querySelector('.exit-intent-popup')).toBeNull();
    expect(seen).toEqual([[], []]);
  });

  it('uses up no trigger when its template is not on the page', async () => {
    const next = boot(config, Promise.resolve(campaign));
    await flush();
    await next.exitIntent({ template: 'missing' });
    leave();
    expect(document.querySelector('.exit-intent-popup')).toBeNull();
    expect(next.getState().visit.exitIntentShown).toBe(0);
  });

  it('stays off on touch devices by default', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const next = boot(config, Promise.resolve(campaign));
    await next.exitIntent({ image: 'https://cdn.test/exit.png' });
    leave();
    expect(document.querySelector('.exit-intent-popup')).toBeNull();
  });
});
