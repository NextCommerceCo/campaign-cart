import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindAll } from '../../src/bindings';
import { flush, makeEngine } from '../fixtures/engine';

const SUMMARY = `
<div id="summary" data-next-cart-summary>
  <template>
    <div class="cart-items__list" data-summary-lines>
      <template>
        <div class="cart-item" data-package-id="{item.packageId}">
          <span class="title">{item.quantity}x {item.name}</span>
          <span class="was diagonal-strike {item.hasDiscount}">{item.originalUnitPrice}/ea</span>
          <span class="price">{item.price}</span>
          <div data-next-item-properties><template><div>{property.key}: {property.value}</div></template></div>
          <button data-next-quantity="increase">+</button>
          <button data-next-quantity="decrease">-</button>
        </div>
      </template>
    </div>
    <div class="subtotal">{subtotal}</div>
    <ul data-next-discounts="voucher"><template><li>{discount.name} - Save {discount.percentage}: −{discount.amount}</li></template></ul>
    <div class="tax">{tax}</div>
    <div class="shipping">{shipping}</div>
    <div class="total">{total}</div>
  </template>
</div>`;

async function setup(html: string) {
  document.body.innerHTML = html;
  const { engine } = makeEngine();
  await engine.load();
  bindAll(document, engine, vi.fn());
  return {
    engine,
    $: (s: string) => document.querySelector<HTMLElement>(s)!,
    $$: (s: string) => [...document.querySelectorAll<HTMLElement>(s)],
  };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('cart summary', () => {
  it('fills totals, lines and discounts from the server summary', async () => {
    const { engine, $, $$ } = await setup(SUMMARY);
    await engine.addItem(2);
    await engine.applyCoupon('save10');
    await flush();
    expect($('.subtotal').textContent).toBe('$89.00');
    expect($('.total').textContent).toBe('$79.00');
    expect($('.shipping').textContent).toBe('Free');
    expect($('.tax').textContent).toBe('');
    expect($$('.cart-item')).toHaveLength(1);
    expect($('.cart-item').getAttribute('data-package-id')).toBe('2');
    expect($('.title').textContent).toBe('1x Earbuds ×2');
    expect($('.was').className).toBe('was diagonal-strike hide');
    expect($('.price').textContent).toBe('$89.00');
    expect($('[data-next-discounts] li').textContent).toBe('SAVE10 - Save 10%: −$10.00');
    expect($('#summary').classList.contains('next-cart-has-items')).toBe(true);
    expect($('[data-next-item-properties]').classList.contains('next-summary-empty')).toBe(true);
  });

  it('writes server text as text, never as HTML', async () => {
    const { engine, $ } = await setup(SUMMARY);
    engine.getState().campaign!.packages[0]!.name = '<img src=x onerror=alert(1)>';
    await engine.addItem(1);
    await flush();
    expect($('.title').textContent).toBe('1x <img src=x onerror=alert(1)>');
    expect(document.querySelector('.title img')).toBeNull();
  });

  it('marks an empty cart', async () => {
    const { $ } = await setup(SUMMARY);
    expect($('#summary').classList.contains('next-cart-empty')).toBe(true);
    expect($('.total').textContent).toBe('');
  });

  it('changes quantity from controls inside rendered lines', async () => {
    const { engine, $ } = await setup(SUMMARY);
    await engine.addItem(1);
    await flush();
    $('[data-next-quantity="increase"]').click();
    await flush();
    expect(engine.lines()).toEqual([{ package_id: 1, quantity: 2 }]);
    $('[data-next-quantity="decrease"]').click();
    $('[data-next-quantity="decrease"]').click();
    await flush();
    expect(engine.lines()).toEqual([{ package_id: 1, quantity: 1 }]);
  });
});
