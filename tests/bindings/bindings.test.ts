import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, SELECTOR } from '../fixtures/pages';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});
import { flush } from '../fixtures/engine';

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
