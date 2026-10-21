import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { bindAll } from '../src/bindings';
import { bindSlots } from '../src/slots';
import { flush, makeEngine } from './fixtures/engine';

async function mount() {
  const file = 'tests/fixtures/pages/olympus-multi-variant/checkout.html';
  const doc = new DOMParser().parseFromString(readFileSync(file, 'utf8'), 'text/html');
  document.body.innerHTML = doc.body.innerHTML;
  const { engine } = makeEngine();
  await engine.start();
  const bindings = bindAll(document, engine, () => {});
  bindSlots(engine, (root) => bindings.bind(root));
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
});
