import { afterEach, describe, expect, it, vi } from 'vitest';
import { flush } from '../fixtures/engine';
import { mount, SELECTOR } from '../fixtures/pages';
import { FakeObserver } from './observer';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('next.bind', () => {
  it('binds an element once, including the root itself', async () => {
    const { engine, bindings, $ } = await mount(SELECTOR);
    bindings.bind(document.body);
    $('#bump').click();
    await flush();
    expect(engine.getState().cart.groups['toggle:9']).toBeDefined();

    const extra = document.createElement('span');
    extra.setAttribute('data-next-display', 'cart.total');
    document.body.append(extra);
    bindings.bind(extra);
    expect(extra.textContent).toBe('$98.00');
  });
});

describe('dispose', () => {
  it('stops rendering on an engine update and stops answering document clicks', async () => {
    const { engine, bindings, $ } = await mount(
      `${SELECTOR}<button id="remove" data-next-remove-item data-package-id="1">Remove</button>`,
    );
    await engine.cart.addItem(1);
    await flush();
    const total = $('#total').textContent;
    bindings.dispose();
    await engine.cart.addItem(3);
    await flush();
    expect(engine.cart.lines().some((l) => l.package_id === 3)).toBe(true);
    expect($('#total').textContent).toBe(total);
    $('#remove').click();
    await flush();
    expect(engine.cart.lines().some((l) => l.package_id === 1)).toBe(true);
  });

  it('removes the stepper, page property and on-screen watches it added outside the bound elements', async () => {
    FakeObserver.all = [];
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    const { engine, bindings, $ } = await mount(`
      <div data-next-bundle-selector data-next-selector-id="main">
        <div data-next-bundle-card data-next-bundle-id="b" data-next-bundle-items='[{"packageId":1,"quantity":1}]'
             data-next-selected="true" data-next-max-quantity="3"></div>
      </div>
      <div data-next-bundle-qty-for="main"><button id="up" data-next-quantity-increase>+</button></div>
      <div id="bump" data-next-toggle-card data-next-package-id="9"></div>
      <input id="engraving" data-next-default-property="engraving">
      <div data-next-promotion="spring"></div>`);
    $('#bump').click();
    await flush();
    const setGroup = vi.spyOn(engine.cart, 'setGroup');
    expect(FakeObserver.all.some((o) => o.targets.size)).toBe(true);
    bindings.dispose();
    $('#up').click();
    $('#engraving').dispatchEvent(new Event('change'));
    await flush();
    expect(engine.cart.lines()).toEqual([
      { package_id: 1, quantity: 1 },
      { package_id: 9, quantity: 1 },
    ]);
    expect(setGroup).not.toHaveBeenCalled();
    expect(FakeObserver.all.filter((o) => o.targets.size)).toEqual([]);
    vi.unstubAllGlobals();
  });
});
