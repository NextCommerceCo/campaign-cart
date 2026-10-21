import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, SELECTOR } from '../fixtures/pages';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});
import { fakeApi } from '../fixtures/api';
import { flush } from '../fixtures/engine';
import { MemoryStorage } from '../fixtures/storage';

async function mountWithApi(html: string) {
  const api = fakeApi();
  const mounted = await mount(html, { fetch: api.fetch });
  return { ...mounted, api };
}

describe('bundle selector', () => {
  it('puts the pre-selected card in the cart', async () => {
    const { engine, $ } = await mount(SELECTOR);
    expect(engine.getState().selectors.main?.picked).toBe('two');
    expect(engine.cart.lines()).toEqual([{ package_id: 2, quantity: 1 }]);
    expect($('[data-next-bundle-id="two"]').classList.contains('next-selected')).toBe(true);
    expect($('#total').textContent).toBe('$89.00');
    expect($('#pick').textContent).toBe('$89.00');
    expect($('#by-card').textContent).toBe('$49.00');
  });

  it('swaps the bundle without touching the order bump', async () => {
    const { engine, $ } = await mount(SELECTOR);
    const badge = $('#two-badge').style.display;
    $('#bump').click();
    await flush();
    $('[data-next-bundle-id="one"]').click();
    await flush();
    expect(engine.cart.lines()).toEqual([
      { package_id: 1, quantity: 1 },
      { package_id: 9, quantity: 1 },
    ]);
    expect($('#total').textContent).toBe('$58.00');
    expect($('#two-badge').style.display).toBe(badge);
  });

  it('does not re-send a cart that already matches the restored pick', async () => {
    const session = new MemoryStorage();
    await mount(SELECTOR, { session });
    const api = fakeApi();
    await mount(SELECTOR, { session, fetch: api.fetch });
    const sent = api.calls.map((c) => JSON.stringify(c.body.lines)).sort();
    expect(sent).toEqual([
      '[{"package_id":1,"quantity":1}]',
      '[{"package_id":2,"quantity":1},{"package_id":9,"quantity":1}]',
      '[{"package_id":2,"quantity":1}]',
      '[{"package_id":2,"quantity":1}]',
    ]);
  });

  it('shows offer cards at their upsell price and keeps them out of the cart', async () => {
    const { engine, $ } = await mount(
      SELECTOR.replace('data-next-selector-id="main"', 'data-next-selector-id="main" data-next-upsell-context'),
    );
    expect($('#one-price').textContent).toBe('$24.50');
    expect($('#pick').textContent).toBe('$44.50');
    expect($('[data-next-bundle-id="two"]').classList.contains('next-loading')).toBe(false);
    expect(engine.cart.lines()).toEqual([]);
  });

  it('steps the quantity from a row outside the selector and from inside the card', async () => {
    const { engine, $ } = await mount(`
      <div data-next-bundle-selector data-next-selector-id="main">
        <div data-next-bundle-card data-next-bundle-id="b" data-next-bundle-items='[{"packageId":1,"quantity":1}]'
             data-next-quantity="1" data-next-min-quantity="1" data-next-max-quantity="3">
          <div data-next-bundle-qty-for="main">
            <button id="inner-up" data-next-quantity-increase>+</button>
          </div>
        </div>
      </div>
      <div data-next-bundle-qty-for="main">
        <button id="down" data-next-quantity-decrease>-</button>
        <span id="qty" data-next-quantity-display></span>
        <button id="up" data-next-quantity-increase>+</button>
      </div>`);
    expect($('#qty').textContent).toBe('1');
    expect(($('#down') as HTMLButtonElement).disabled).toBe(true);
    $('#inner-up').click();
    await flush();
    expect(engine.cart.lines()).toEqual([{ package_id: 1, quantity: 2 }]);
    expect($('#qty').textContent).toBe('2');
    $('#up').click();
    await flush();
    expect($('#up').classList.contains('next-disabled')).toBe(true);
    $('#down').click();
    await flush();
    expect(engine.cart.lines()).toEqual([{ package_id: 1, quantity: 2 }]);
  });

  it('fills a card’s own discount badge from that card’s server price', async () => {
    const { $, api } = await mountWithApi(`
      <div data-next-bundle-selector data-next-selector-id="main">
        <div data-next-bundle-card data-next-bundle-id="one" data-next-bundle-items='[{"packageId":1,"quantity":1}]'
             data-next-bundle-vouchers='["SAVE10"]'>
          <span id="pill" data-next-discounts="voucher"><template><b>SAVE {discount.percentage}</b></template></span>
        </div>
      </div>`);
    await flush();
    expect($('#pill b').textContent).toBe('SAVE 10%');
    expect(api.calls.some((c) => c.url.endsWith('/carts/calculate/') && c.body.vouchers.includes('SAVE10'))).toBe(true);
  });

  it('only records the pick in select mode and on upsell pages', async () => {
    const select = await mount(
      SELECTOR.replace(
        'data-next-selector-id="main"',
        'data-next-selector-id="main" data-next-selection-mode="select"',
      ),
    );
    expect(select.engine.cart.lines()).toEqual([]);
    expect(select.engine.getState().selectors.main?.picked).toBe('two');
    const upsell = await mount(
      `<div data-next-upsell="offer"></div>${SELECTOR.replace(/<div data-next-toggle-container>[\s\S]*?<\/div>\s*<\/div>/, '')}`,
    );
    expect(upsell.engine.cart.lines()).toEqual([]);
  });
});
