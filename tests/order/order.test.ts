import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bindAll } from '../../src/bindings';
import { bindOrder } from '../../src/order';
import { fakeApi, type FakeApiOptions, json } from '../fixtures/api';
import { flush, makeEngine } from '../fixtures/engine';
import { ORDER } from '../fixtures/order';

async function mount(file: string, api: FakeApiOptions = {}) {
  const doc = new DOMParser().parseFromString(readFileSync(`tests/fixtures/pages/${file}`, 'utf8'), 'text/html');
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
  engine.on('*', (e) => events.push(e.name), { replay: true });
  return { engine, navigate, $, upsells, events, calls: fake.calls };
}

beforeEach(() => {
  history.replaceState(null, '', '/apollo/upsell-bundle-stepper/?ref_id=R1');
  sessionStorage.clear();
});

afterEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

const NEXT = `${location.origin}/apollo/upsell-bundle-tier-pills/?ref_id=R1`;

describe('upsell page (apollo stepper, 0.4.43 markup)', () => {
  it('prices the offer for the stepped quantity and adds it once', async () => {
    const { $, upsells, navigate, events } = await mount('apollo/upsell-bundle-stepper.html');
    const offer = $('[data-next-upsell="offer"]');
    expect(offer.classList).toContain('next-available');
    expect(events).toContain('upsell.viewed');
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

  it('skips straight to the next page', async () => {
    const { $, navigate, events, upsells } = await mount('apollo/upsell-bundle-stepper.html');
    $('[data-next-upsell-action="skip"]').click();
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith(NEXT));
    expect(events).toContain('upsell.skipped');
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
});
