import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, SELECTOR } from '../fixtures/pages';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});
import { bindAll } from '../../src/bindings';
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
    await engine.load();
    await engine.addItem(9);
    bindAll(document, engine, vi.fn());
    await flush();
    expect(engine.lines()).toEqual([{ package_id: 9, quantity: 1 }]);
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
    await engine.setGroup('bundle:main', { lines: [{ packageId: 1, quantity: 3 }], vouchers: [] });
    await flush();
    expect(engine.getState().cart.groups['toggle:9']?.lines).toEqual([{ packageId: 9, quantity: 3 }]);
    expect($('#bump-price').textContent).toBe('$27.00');
  });
});
