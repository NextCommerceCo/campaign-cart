import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bindAll } from '../../src/bindings';
import { bindOrder } from '../../src/order';
import { fakeApi, type FakeApiOptions, json } from '../fixtures/api';
import { flush, makeEngine } from '../fixtures/engine';
import { ORDER } from '../fixtures/order';
import { FakeObserver, visible } from '../bindings/observer';

const mount = (file: string, api: FakeApiOptions = {}) =>
  mountHtml(readFileSync(`tests/fixtures/pages/${file}`, 'utf8'), api);

async function mountHtml(html: string, api: FakeApiOptions = {}) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  document.head.innerHTML = doc.head.innerHTML;
  document.body.innerHTML = doc.body.innerHTML;
  const fake = fakeApi(api);
  const { engine } = makeEngine({ fetch: fake.fetch, params: { ref_id: 'R1' }, session: sessionStorage });
  await engine.start();
  bindAll(document, engine, () => {});
  const navigate = vi.fn();
  await bindOrder(engine, navigate);
  await flush();
  const $ = (s: string) => document.querySelector<HTMLElement>(s)!;
  const upsells = () => fake.calls.filter((c) => c.url.endsWith('/upsells/'));
  const events: string[] = [];
  const sent: Array<{ name: string; data: unknown }> = [];
  engine.on(
    '*',
    (e) => {
      events.push(e.name);
      sent.push({ name: e.name, data: e.data });
    },
    { replay: true },
  );
  const dataOf = (name: string) => sent.filter((e) => e.name === name).map((e) => e.data);
  return { engine, navigate, $, upsells, events, dataOf, calls: fake.calls };
}

beforeEach(() => {
  history.replaceState(null, '', '/apollo/upsell-bundle-stepper/?ref_id=R1');
  sessionStorage.clear();
  vi.stubGlobal('IntersectionObserver', undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

const NEXT = `${location.origin}/apollo/upsell-bundle-tier-pills/?ref_id=R1`;

describe('upsell page (starter upsell-single, selector beside the offer)', () => {
  it('adds the card of the selector named by data-next-bundle-selector-id, with its voucher', async () => {
    history.replaceState(null, '', '/olympus/upsell-single/?ref_id=R1');
    const { $, upsells, navigate } = await mount('starter/olympus-upsell-single.html');
    $('[data-next-upsell-action="add"]').click();
    await vi.waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(upsells()[0]!.body).toEqual({
      lines: [{ package_id: 12, quantity: 1 }],
      currency: 'USD',
      vouchers: ['LIFE50'],
    });
  });
});

describe('upsell page (apollo stepper, 0.4.43 markup)', () => {
  it('prices the offer for the stepped quantity and adds it once', async () => {
    const { $, upsells, navigate, events, dataOf } = await mount('apollo/upsell-bundle-stepper.html');
    const offer = $('[data-next-upsell="offer"]');
    expect(offer.classList).toContain('next-available');
    expect(dataOf('upsell.viewed')).toEqual([
      {
        ref_id: 'R1',
        page: '/apollo/upsell-bundle-stepper/',
        selector_id: 'upsell-bundle',
        option_id: 'upsell-bundle-1x',
        lines: [expect.objectContaining({ package_id: 3, quantity: 1, total: 20 })],
        currency: 'USD',
        total: 20,
      },
    ]);
    $('[data-next-quantity-increase]').click();
    await flush();
    await flush();
    expect($('[data-next-quantity-display]').textContent).toBe('2');
    expect($('[data-next-display="bundle.upsell-bundle.price"]').textContent).toBe('$40.00');
    $('[data-next-upsell-action="add"]').click();
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith(NEXT));
    expect(upsells()[0]!.body).toEqual({
      lines: [{ package_id: 3, quantity: 2 }],
      currency: 'USD',
      vouchers: ['UP50'],
    });
    expect(offer.classList).toContain('next-success');
    expect(events.slice(events.indexOf('upsell.accepted'))).toEqual(['upsell.accepted', 'order.updated']);
    expect(dataOf('upsell.accepted')).toMatchObject([{ lines: [{ package_id: 3, quantity: 2 }], total: 40 }]);
    expect(dataOf('upsell.viewed')).toHaveLength(1);
  });

  it('sends upsell.viewed with the offer’s price when the price arrives after the order', async () => {
    const { calls, dataOf } = await mount('apollo/upsell-bundle-stepper.html', { delays: [50] });
    expect(calls[0]!.url).toContain('/carts/calculate/');
    expect(dataOf('upsell.viewed')).toEqual([]);
    await vi.waitFor(() => expect(dataOf('upsell.viewed')).toHaveLength(1));
    expect(dataOf('upsell.viewed')[0]).toMatchObject({ lines: [{ package_id: 3, total: 20 }], total: 20 });
  });

  it('sends upsell.viewed, unpriced, before the skip of a shopper who answers before the price arrives', async () => {
    const { $, navigate, dataOf, events } = await mount('apollo/upsell-bundle-stepper.html', { delays: [50] });
    $('[data-next-upsell-action="skip"]').click();
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith(NEXT));
    expect(events.filter((name) => name.startsWith('upsell.'))).toEqual([
      'upsell.shown',
      'upsell.viewed',
      'upsell.skipped',
    ]);
    expect(dataOf('upsell.viewed')[0]).toMatchObject({ lines: [{ package_id: 3, quantity: 1 }] });
    expect(dataOf('upsell.viewed')[0]).not.toHaveProperty('total');
    await new Promise((r) => setTimeout(r, 80));
    expect(dataOf('upsell.viewed')).toHaveLength(1);
  });

  it('sends upsell.viewed before the accept of a shopper who answers before the price arrives', async () => {
    const { $, navigate, events } = await mount('apollo/upsell-bundle-stepper.html', { delays: [50] });
    $('[data-next-upsell-action="add"]').click();
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith(NEXT));
    expect(events.filter((name) => name.startsWith('upsell.'))).toEqual([
      'upsell.shown',
      'upsell.viewed',
      'upsell.accepted',
    ]);
  });

  it('does not charge again after Back, and moves on', async () => {
    const first = await mount('apollo/upsell-bundle-stepper.html');
    first.$('[data-next-upsell-action="add"]').click();
    await vi.waitFor(() => expect(first.navigate).toHaveBeenCalled());
    const back = await mount('apollo/upsell-bundle-stepper.html');
    back.$('[data-next-upsell-action="add"]').click();
    await vi.waitFor(() => expect(back.navigate).toHaveBeenCalledWith(NEXT));
    expect(back.upsells()).toHaveLength(0);
  });

  it('ignores a skip tapped while an accepted offer is moving on', async () => {
    const { $, navigate, events } = await mount('apollo/upsell-bundle-stepper.html');
    $('[data-next-upsell-action="add"]').click();
    await vi.waitFor(() => expect(events).toContain('upsell.accepted'));
    $('[data-next-upsell-action="skip"]').click();
    await vi.waitFor(() => expect(navigate).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 150));
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(events).not.toContain('upsell.skipped');
  });

  it('skips straight to the next page', async () => {
    const { $, navigate, dataOf, upsells } = await mount('apollo/upsell-bundle-stepper.html');
    $('[data-next-upsell-action="skip"]').click();
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith(NEXT));
    expect(dataOf('upsell.skipped')).toEqual([dataOf('upsell.viewed')[0]]);
    expect(upsells()).toHaveLength(0);
  });

  it('hides an offer the order cannot take, and moves on after showing the error', async () => {
    const { $, navigate, upsells } = await mount('apollo/upsell-bundle-stepper.html', {
      getOrder: () => json({ ...ORDER, supports_post_purchase_upsells: false }),
    });
    const offer = $('[data-next-upsell="offer"]');
    expect(offer.classList).toContain('next-hidden');
    $('[data-next-upsell-action="add"]').click();
    await flush();
    expect(offer.classList).toContain('next-error');
    expect(navigate).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith(NEXT), { timeout: 2000 });
    expect(upsells()).toHaveLength(0);
  });
});

describe('upsell page with two offers', () => {
  it('sends upsell.viewed once for each offer', async () => {
    history.replaceState(null, '', '/up/?ref_id=R1');
    const { engine, dataOf } = await mountHtml(`<body>
      <div data-next-upsell="offer" data-next-package-id="2"><a data-next-upsell-action="add" href="#">Add</a></div>
      <div data-next-upsell="offer" data-next-package-id="3" data-next-quantity="2"><a data-next-upsell-action="add" href="#">Add</a></div>
    </body>`);
    await engine.cart.addItem(1);
    await flush();
    expect(dataOf('upsell.viewed')).toEqual([
      { ref_id: 'R1', page: '/up/', lines: [expect.objectContaining({ package_id: 2, quantity: 1 })], currency: 'USD' },
      { ref_id: 'R1', page: '/up/', lines: [expect.objectContaining({ package_id: 3, quantity: 2 })], currency: 'USD' },
    ]);
  });
});

describe('upsell page below the fold', () => {
  const OFFER = `<body><div data-next-upsell="offer" data-next-package-id="2"><a data-next-upsell-action="skip" href="#">No</a></div></body>`;

  beforeEach(() => {
    FakeObserver.all = [];
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    history.replaceState(null, '', '/up/?ref_id=R1');
  });

  it('sends upsell.viewed once, when half of the shown offer is on screen', async () => {
    const { $, dataOf } = await mountHtml(OFFER);
    const offer = $('[data-next-upsell="offer"]');
    expect(offer.classList).toContain('next-available');
    expect(dataOf('upsell.shown')).toHaveLength(1);
    expect(dataOf('upsell.viewed')).toEqual([]);
    visible(offer, 0.3);
    expect(dataOf('upsell.viewed')).toEqual([]);
    visible(offer, 0.5);
    visible(offer, 1);
    expect(dataOf('upsell.viewed')).toEqual([
      { ref_id: 'R1', page: '/up/', lines: [expect.objectContaining({ package_id: 2 })], currency: 'USD' },
    ]);
  });

  it('sends upsell.viewed before the skip of a shopper who answers before it is on screen', async () => {
    const { $, events } = await mountHtml(OFFER);
    $('[data-next-upsell-action="skip"]').click();
    expect(events.filter((name) => name.startsWith('upsell.'))).toEqual([
      'upsell.shown',
      'upsell.viewed',
      'upsell.skipped',
    ]);
  });

  it('sends no upsell.viewed for an offer on screen that the order cannot take', async () => {
    const { $, dataOf } = await mountHtml(OFFER, {
      getOrder: () => json({ ...ORDER, supports_post_purchase_upsells: false }),
    });
    visible($('[data-next-upsell="offer"]'), 1);
    expect(dataOf('upsell.viewed')).toEqual([]);
  });
});

describe('upsell page (apollo tier cards)', () => {
  it('shows each tier’s offer price and adds the tier the shopper picked', async () => {
    history.replaceState(null, '', '/apollo/upsell-bundle-tier-cards/?ref_id=R1');
    const { $, upsells, navigate } = await mount('apollo/upsell-bundle-tier-cards.html');
    expect(
      document.querySelector('[data-next-display="bundle.upsell-bundle-3x.discountPercentage"]')!.textContent,
    ).toMatch(/%$/);
    $('[data-next-bundle-id="upsell-bundle-2x"]').click();
    await flush();
    $('[data-next-upsell-action="add"]').click();
    await vi.waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(upsells()[0]!.body.lines).toEqual([{ package_id: 3, quantity: 2 }]);
  });
});

describe('receipt (apollo)', () => {
  it('shows the order, its items and totals', async () => {
    history.replaceState(null, '', '/apollo/receipt/?ref_id=R1');
    const { $ } = await mount('apollo/receipt.html');
    const text = (path: string) => $(`[data-next-display="${path}"]`).textContent?.trim();
    expect(text('order.total')).toBe('$106.11');
    expect(text('order.subtotal')).toBe('$89.00');
    expect(text('order.number')).toBe('1001');
    expect(text('order.customer.name')).toBe('Jane Doe');
    expect(text('order.shippingAddress.city')).toBe('Austin');
    expect(text('order.paymentMethod')).toBe('Credit Card');
    expect($('[data-next-show="order.hasTax"]').style.display).toBe('');
    const list = $('[data-next-order-items]');
    expect(list.classList).toContain('order-has-items');
    expect(list.querySelector('.cart-item__title')!.textContent).toBe('Earbuds');
    expect(list.querySelector('.cart-item__quantity')!.textContent).toBe('2');
    expect(list.querySelector('img')!.getAttribute('src')).toBe('https://img.test/eb.png');
  });

  it('fills only the item tokens of an item template and keeps any other token as written', async () => {
    const template = '<b>{item.name}</b> {item.constructor} {item.nope} {order.total} {name}';
    const { $ } = await mountHtml(`<div data-next-order-items data-item-template="${template}"></div>`);
    expect($('[data-next-order-items]').innerHTML).toBe(
      '<b>Earbuds</b> {item.constructor} {item.nope} {order.total} {name}',
    );
  });
});

describe('order values by their Order field names', () => {
  it.each([true, false])(
    'shows and hides on order.supports_upsells (%s) once the order arrives after binding',
    async (supports) => {
      const warnings: string[] = [];
      vi.spyOn(console, 'warn').mockImplementation((...args) => void warnings.push(args.join(' ')));
      const { $ } = await mountHtml(
        `<div id="offer" data-next-show="order.supports_upsells">Offer</div>
         <p id="thanks" data-next-hide="order.supports_upsells">Thanks</p>
         <span id="discount" data-next-display="order.total_discount"></span>
         <span id="method" data-next-display="order.shipping_method.name"></span>
         <span id="name" data-next-display="order.user.first_name"></span>`,
        { getOrder: (ref) => json({ ...ORDER, ref_id: ref, supports_post_purchase_upsells: supports }) },
      );
      expect(warnings.filter((w) => w.startsWith('[next]'))).toEqual([]);
      expect($('#offer').style.display).toBe(supports ? '' : 'none');
      expect($('#thanks').style.display).toBe(supports ? 'none' : '');
      expect($('#discount').textContent).toBe('$0.00');
      expect($('#method').textContent).toBe('Express');
      expect($('#name').textContent).toBe('Jane');
    },
  );
});
