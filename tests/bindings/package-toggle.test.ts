import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, SELECTOR } from '../fixtures/pages';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});
import { bindAll } from '../../src/bindings';
import { fakeApi } from '../fixtures/api';
import { flush, makeEngine } from '../fixtures/engine';
import { MemoryStorage } from '../fixtures/storage';

describe('order bump', () => {
  it('marks the card and its container the way the live CSS expects', async () => {
    const { $ } = await mount(SELECTOR);
    $('#bump').click();
    await flush();
    for (const el of [$('#bump'), $('[data-next-toggle-container]')]) {
      expect(el.classList.contains('next-in-cart')).toBe(true);
      expect(el.classList.contains('next-active')).toBe(true);
    }
  });

  it('shows the bump at the server’s price, before and after it is added, like 0.4.x', async () => {
    const api = fakeApi({ offers: { 9: 0.5 } });
    const { engine, $ } = await mount(
      `<div id="bump" data-next-toggle-card data-next-package-id="9">
        <span id="price" data-next-toggle-display="price"></span>
        <span id="was" data-next-toggle-display="originalPrice"></span>
        <span id="off" data-next-toggle-display="discountPercentage" data-next-format="percentage"></span>
      </div>`,
      { fetch: api.fetch },
    );
    await flush();
    expect([$('#price').textContent, $('#was').textContent, $('#off').textContent]).toEqual(['$4.50', '$9.00', '50%']);
    const quotes = api.calls.length;
    await engine.cart.addItem(1);
    await flush();
    expect(api.calls).toHaveLength(quotes + 2);
    $('#bump').click();
    await flush();
    expect(engine.cart.lines()).toContainEqual({ package_id: 9, quantity: 1 });
    expect($('#price').textContent).toBe('$4.50');
    await engine.cart.applyCoupon('SAVE10');
    $('#bump').click();
    await flush();
    const requoted = api.calls.filter((c) => c.body.lines.some((l: { package_id: number }) => l.package_id === 9));
    expect(requoted.at(-1)?.body).toMatchObject({ vouchers: ['SAVE10'] });
  });

  it('ignores clicks in form fields inside the card', async () => {
    const { engine, $ } = await mount(SELECTOR);
    $('#note').click();
    await flush();
    expect(engine.getState().cart.groups['toggle:9']).toBeUndefined();
  });

  it('does not re-add a pre-selected bump the shopper switched off', async () => {
    const session = new MemoryStorage();
    const html = `<div id="bump" data-next-toggle-card data-next-package-id="9" data-next-selected="true"></div>`;
    const first = await mount(html, { session });
    expect(first.engine.getState().cart.groups['toggle:9']).toBeDefined();
    first.$('#bump').click();
    await flush();
    const second = await mount(html, { session });
    expect(second.engine.getState().cart.groups['toggle:9']).toBeUndefined();
  });

  it('counts a package already in the cart as on and never adds it twice', async () => {
    const html = `<div id="bump" data-next-toggle-card data-next-package-id="9" data-next-selected="true"></div>`;
    document.body.innerHTML = html;
    const { engine } = makeEngine();
    await engine.start();
    await engine.cart.addItem(9);
    bindAll(document, engine, vi.fn());
    await flush();
    expect(engine.cart.lines()).toEqual([{ package_id: 9, quantity: 1 }]);
    expect(document.querySelector('#bump')!.classList.contains('next-in-cart')).toBe(true);
  });

  it('follows the synced quantity and prices it', async () => {
    const { engine, $ } = await mount(
      SELECTOR.replace('data-next-package-id="9"', 'data-next-package-id="9" data-next-package-sync="1,2"'),
    );
    $('#bump').click();
    await flush();
    $('[data-next-bundle-id="one"]').click();
    await flush();
    await flush();
    expect(engine.getState().cart.groups['toggle:9']?.lines).toEqual([{ packageId: 9, quantity: 1 }]);
    await engine.cart.setGroup('bundle:main', { lines: [{ packageId: 1, quantity: 3 }], vouchers: [] });
    await flush();
    expect(engine.getState().cart.groups['toggle:9']?.lines).toEqual([{ packageId: 9, quantity: 3 }]);
    expect($('#bump-price').textContent).toBe('$27.00');
  });

  it('sends a bump marked data-next-is-upsell as an upsell line', async () => {
    const { engine, $ } = await mount(
      `<div id="bump" data-next-toggle-card data-next-package-id="9" data-next-is-upsell="true"></div>`,
    );
    $('#bump').click();
    await flush();
    expect(engine.cart.lines()).toEqual([{ package_id: 9, quantity: 1, is_upsell: true }]);
  });
  it('prices the bump again when the rest of the cart changes, like 0.4.x', async () => {
    const api = fakeApi();
    const { engine } = await mount(
      `<div data-next-toggle-card data-next-package-id="9"><span data-next-toggle-display="price"></span></div>`,
      { fetch: api.fetch },
    );
    await engine.cart.addItem(1, 1);
    await flush();
    await engine.cart.addItem(1, 1);
    await flush();
    const quotes = api.calls.filter(
      (c) => c.url.includes('calculate') && c.body.lines.some((l: any) => l.package_id === 9),
    );
    expect(quotes.at(-1)!.body.lines).toEqual([
      { package_id: 1, quantity: 2 },
      { package_id: 9, quantity: 1 },
    ]);
  });

  it('follows the quantity of a whole product, shows its image and marks itself the 0.4.x way', async () => {
    const { engine, $ } = await mount(`
      <div data-next-package-toggle>
        <div id="warranty" data-next-toggle-card data-next-package-id="9" data-next-product-sync="400" data-next-selected="true">
          <img data-next-toggle-image alt="">
        </div>
      </div>`);
    await engine.cart.addItem(1, 1);
    await engine.cart.addItem(2, 2);
    await flush();
    expect(engine.cart.lines()).toContainEqual({ package_id: 9, quantity: 5 });
    expect($('#warranty').classList).toContain('os--active');
    expect($('#warranty').getAttribute('data-next-in-cart')).toBe('true');
    expect($('#warranty img').getAttribute('src')).toBe('https://cdn.test/9.png');
    expect($('#warranty img').getAttribute('alt')).toBe('Protection plan');
  });
});
