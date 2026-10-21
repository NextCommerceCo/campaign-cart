import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, SELECTOR } from '../fixtures/pages';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});
import { fakeApi } from '../fixtures/api';
import { flush } from '../fixtures/engine';
import { MemoryStorage } from '../fixtures/storage';

describe('bundle selector', () => {
  it('puts the pre-selected card in the cart', async () => {
    const { engine, $ } = await mount(SELECTOR);
    expect(engine.getState().selections.main).toBe('two');
    expect(engine.cart.lines()).toEqual([{ package_id: 2, quantity: 1 }]);
    expect($('[data-next-bundle-id="two"]').classList.contains('next-selected')).toBe(true);
    expect($('#total').textContent).toBe('$89.00');
    expect($('#pick').textContent).toBe('$89.00');
    expect($('#by-card').textContent).toBe('$49.00');
  });

  it('swaps the bundle without touching the order bump', async () => {
    const { engine, $ } = await mount(SELECTOR);
    $('#bump').click();
    await flush();
    $('[data-next-bundle-id="one"]').click();
    await flush();
    expect(engine.cart.lines()).toEqual([
      { package_id: 1, quantity: 1 },
      { package_id: 9, quantity: 1 },
    ]);
    expect($('#total').textContent).toBe('$58.00');
    expect($('#two-badge').style.display).toBe('');
  });

  it('does not re-send a cart that already matches the restored pick', async () => {
    const session = new MemoryStorage();
    await mount(SELECTOR, { session });
    const api = fakeApi();
    await mount(SELECTOR, { session, fetch: api.fetch });
    expect(api.calls).toHaveLength(1);
  });

  it('only records the pick in select mode and on upsell pages', async () => {
    const select = await mount(
      SELECTOR.replace(
        'data-next-selector-id="main"',
        'data-next-selector-id="main" data-next-selection-mode="select"',
      ),
    );
    expect(select.engine.cart.lines()).toEqual([]);
    expect(select.engine.getState().selections.main).toBe('two');
    const upsell = await mount(
      `<div data-next-upsell="offer"></div>${SELECTOR.replace(/<div data-next-toggle-container>[\s\S]*?<\/div>\s*<\/div>/, '')}`,
    );
    expect(upsell.engine.cart.lines()).toEqual([]);
  });
});
