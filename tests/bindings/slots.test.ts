import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { bindAll } from '../../src/bindings';
import { bindSlots } from '../../src/bindings/slots';
import { fakeApi } from '../fixtures/api';
import { flush, makeEngine } from '../fixtures/engine';

async function mount(fetch?: typeof globalThis.fetch) {
  const file = 'tests/fixtures/pages/olympus-multi-variant/checkout.html';
  const doc = new DOMParser().parseFromString(readFileSync(file, 'utf8'), 'text/html');
  document.body.innerHTML = doc.body.innerHTML;
  const { engine } = makeEngine({ fetch });
  await engine.start();
  bindAll(document, engine, () => {});
  bindSlots(engine);
  await flush();
  const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;
  const slots = () => [
    ...document.querySelectorAll<HTMLElement>('[data-next-bundle-slots-for="main"] .next-bundle-slot'),
  ];
  const change = async (el: HTMLInputElement | HTMLSelectElement, value: string) => {
    el.value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    await flush();
  };
  return { engine, $, slots, change };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('bundle slots (olympus multi-variant, 0.4.43 markup)', () => {
  it('draws one slot per unit of the picked bundle, from the page template', async () => {
    const { $, slots, engine } = await mount();
    expect(slots()).toHaveLength(1);
    expect(slots()[0]!.textContent).toContain('# 1');
    $('[data-next-bundle-id="buy3"]').click();
    await flush();
    expect(slots()).toHaveLength(3);
    expect(slots()[2]!.textContent).toContain('# 3');
    expect(slots()[0]!.querySelector('.next-slot-variant-label')!.textContent).toBe('Select Color:');
    expect(engine.cart.lines()).toEqual([{ package_id: 1, quantity: 3 }]);
  });

  it('switches one unit to another variant and keeps the rest', async () => {
    const { $, slots, engine, change } = await mount();
    $('[data-next-bundle-id="buy2"]').click();
    await flush();
    const select = slots()[1]!.querySelector<HTMLSelectElement>(
      'select.next-slot-variant-select[data-next-variant-code="color"]',
    )!;
    expect([...select.options].map((o) => o.value)).toEqual(['Black', 'White']);
    await change(select, 'White');
    expect(engine.cart.lines()).toEqual([
      { package_id: 1, quantity: 1 },
      { package_id: 2, quantity: 1 },
    ]);
    expect(slots()[1]!.querySelector<HTMLSelectElement>('select')!.value).toBe('White');
    expect(slots()[1]!.querySelector('img')!.getAttribute('src')).toBe('https://cdn.test/2.png');
    expect(slots()[0]!.querySelector('img')!.getAttribute('src')).toBe('https://cdn.test/1.png');
    expect(slots()[0]!.querySelector<HTMLSelectElement>('select')!.value).toBe('Black');
  });

  it('sends each unit’s personalisation and the page default, but not to a bump that excludes it', async () => {
    const { $, slots, engine, change } = await mount();
    await change(slots()[0]!.querySelector<HTMLInputElement>('input[data-next-property="number"]')!, '23');
    await change($<HTMLInputElement>('[data-next-default-property="custom_text"]'), 'Eagles');
    expect(engine.cart.lines()).toContainEqual({
      package_id: 1,
      quantity: 1,
      properties: { custom_text: 'Eagles', number: '23' },
    });
    const bump = $('[data-next-toggle-card][data-next-package-id="78"]');
    bump.querySelector<HTMLInputElement>('input[data-next-property="bump_custom_text"]')!.value = 'Jane';
    bump.click();
    await flush();
    expect(engine.cart.lines()).toContainEqual({
      package_id: 78,
      quantity: 1,
      is_upsell: true,
      properties: { bump_custom_text: 'Jane' },
    });
  });
  it('fills a slot’s discount row once the coupon is priced, without redrawing the slot', async () => {
    const { slots, engine } = await mount();
    const slot = slots()[0]!;
    await engine.cart.applyCoupon('SAVE10');
    await flush();
    expect(slots()[0]).toBe(slot);
    const row = slot.querySelector<HTMLElement>('[data-next-discounts="voucher"]')!;
    expect(row.textContent).toContain('+10% extra');
    expect(row.style.display).toBe('');
  });

  it('marks a unit discounted when the server’s offer prices the bundle lower', async () => {
    const plain = await mount();
    const row = () => plain.slots()[0]!.querySelector<HTMLElement>('[data-next-discounts="offer"]')!;
    expect(row().style.display).toBe('none');
    document.body.innerHTML = '';
    const offer = await mount(fakeApi({ offers: { 1: 0.5 } }).fetch);
    expect(offer.slots()[0]!.querySelector<HTMLElement>('[data-next-discounts="offer"]')!.style.display).toBe('');
  });

  it('keeps focus on the variant select the shopper is using', async () => {
    const { $, slots, change } = await mount();
    $('[data-next-bundle-id="buy2"]').click();
    await flush();
    const select = slots()[1]!.querySelector<HTMLSelectElement>('select[data-next-variant-code="color"]')!;
    select.focus();
    await change(select, 'White');
    const now = document.activeElement as HTMLSelectElement;
    expect(now).not.toBe(select);
    expect(now.getAttribute('data-next-variant-code')).toBe('color');
    expect(now.closest('.next-bundle-slot')).toBe(slots()[1]);
  });
});
