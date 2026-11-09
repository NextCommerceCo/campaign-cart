import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, SELECTOR } from '../fixtures/pages';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('add to cart', () => {
  it('adds and goes to the next page right away with attribution params', async () => {
    const { engine, navigate, $ } = await mount(
      `<a id="buy" href="#" data-next-action="add-to-cart" data-next-package-id="1" data-next-quantity="2" data-next-url="/checkout"></a>`,
      { params: { utm_source: 'fb', debugger: 'true' } },
    );
    $('#buy').click();
    expect(engine.cart.lines()).toEqual([{ package_id: 1, quantity: 2 }]);
    expect(navigate).toHaveBeenCalledWith(`${location.origin}/checkout?utm_source=fb`);
    $('#buy').click();
    expect(engine.cart.lines()).toEqual([{ package_id: 1, quantity: 2 }]);
  });
});
