import { afterEach, describe, expect, it, vi } from 'vitest';
import { flush } from '../fixtures/engine';
import { mount, SELECTOR } from '../fixtures/pages';

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
});
