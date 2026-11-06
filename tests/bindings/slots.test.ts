import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { bindAll } from '../../src/bindings';
import { bindSlots } from '../../src/bindings/slots';
import { fakeApi, heldApi, json } from '../fixtures/api';
import { campaign } from '../fixtures/campaign';
import { flush, makeEngine } from '../fixtures/engine';
import type { Package } from '../../src/engine/types';

async function mount(fetch?: typeof globalThis.fetch, packages?: Package[]) {
  const file = 'tests/fixtures/pages/olympus-multi-variant/checkout.html';
  const doc = new DOMParser().parseFromString(readFileSync(file, 'utf8'), 'text/html');
  document.body.innerHTML = doc.body.innerHTML;
  const { engine } = makeEngine({ fetch, ...(packages && { campaign: Promise.resolve({ ...campaign, packages }) }) });
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

  it('keeps the quoted unit price and offer row while a variant change is being priced', async () => {
    const api = heldApi();
    const offer = { offer_id: 7, name: 'Bundle', description: 'Bundle', amount: '1.00', percentage: '70.00' };
    const fetch = (async (input, init) => {
      const res = await api.fetch(input, init);
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      if (!body?.lines || !body.vouchers) return res;
      const summary = await res.json();
      summary.offer_discounts = [offer];
      for (const line of summary.lines)
        Object.assign(line, { package_price: '20.00', original_package_price: '99.00', discounts: [offer] });
      return json(summary);
    }) as typeof globalThis.fetch;
    const { $, slots, change } = await mount(fetch);
    $('[data-next-bundle-id="buy2"]').click();
    await flush();
    const price = (i: number) => slots()[i]!.querySelector('.os-card__pricing')!.textContent!;
    expect(price(1)).toContain('20.00');
    expect(price(1)).toContain('Save 70% OFF');
    api.hold();
    await change(slots()[1]!.querySelector<HTMLSelectElement>('select[data-next-variant-code="color"]')!, 'White');
    expect(slots()[1]!.querySelector('img')!.getAttribute('src')).toBe('https://cdn.test/2.png');
    for (const i of [0, 1]) {
      expect(price(i)).toContain('20.00');
      expect(price(i)).toContain('99.00');
      expect(price(i)).toContain('Save 70% OFF');
      expect(price(i)).not.toMatch(/49\.00|89\.00|198\.00/);
    }
    api.release();
    await flush();
    await flush();
    expect(price(1)).toContain('20.00');
    expect(price(1)).toContain('Save 70% OFF');
  });

  it('redraws only the variant field whose available options changed, so page dropdowns built from it follow', async () => {
    const sized = (size: string) => (p: Package) => ({
      ...p,
      product_variant_attribute_values: [
        { code: 'size', name: 'Size', value: size },
        ...(p.product_variant_attribute_values ?? []),
      ],
    });
    const black = { ...campaign.packages.find((p) => p.ref_id === 1)!, ref_id: 3 };
    const packages = [
      ...campaign.packages
        .filter((p) => p.ref_id !== 3)
        .map((p) => (p.ref_id === 1 || p.ref_id === 2 ? sized('S')(p) : p)),
      sized('M')(black),
    ];
    const { slots, change } = await mount(undefined, packages);
    const field = (code: string) =>
      slots()[0]!.querySelector<HTMLElement>(`.next-slot-variant-field[data-next-variant-code="${code}"]`)!;
    const medium = () => [...field('size').querySelector('select')!.options].find((o) => o.value === 'M')!;
    expect(medium().disabled).toBe(false);
    const sizeField = field('size');
    const colorField = field('color');
    colorField.querySelector('select')!.focus();
    await change(colorField.querySelector('select')!, 'White');
    expect(document.activeElement).toBe(colorField.querySelector('select'));
    expect(medium().disabled).toBe(true);
    expect(field('size')).not.toBe(sizeField);
    expect(field('color')).toBe(colorField);
    await change(colorField.querySelector('select')!, 'Black');
    expect(medium().disabled).toBe(false);
  });

  it('updates a unit in place when its variant changes, keeping its image, selects and focus', async () => {
    const { $, slots, change } = await mount();
    $('[data-next-bundle-id="buy2"]').click();
    await flush();
    const slot = slots()[1]!;
    const img = slot.querySelector('img')!;
    const select = slot.querySelector<HTMLSelectElement>('select[data-next-variant-code="color"]')!;
    select.focus();
    await change(select, 'White');
    expect(slots()[1]).toBe(slot);
    expect(slot.querySelector('img')).toBe(img);
    expect(img.getAttribute('src')).toBe('https://cdn.test/2.png');
    expect(slot.querySelector('select[data-next-variant-code="color"]')).toBe(select);
    expect(select.value).toBe('White');
    expect(document.activeElement).toBe(select);
    await change(select, 'Black');
    expect(img.getAttribute('src')).toBe('https://cdn.test/1.png');
  });
});
