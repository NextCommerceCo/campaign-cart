import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, SELECTOR } from '../fixtures/pages';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});
import { bindAll } from '../../src/bindings';
import { makeEngine } from '../fixtures/engine';

describe('display', () => {
  it('renders typed, formatted values as text', async () => {
    const { $ } = await mount(`<span data-next-package-id="2"><b id="n" data-next-display="package.name"></b>
      <i id="p" data-next-display="package.price_total"></i></span>
      <img id="img" data-next-display="package.2.image">`);
    expect($('#n').textContent).toBe('Earbuds ×2');
    expect($('#p').textContent).toBe('$89.00');
    expect(($('#img') as HTMLImageElement).src).toBe('https://cdn.test/2.png');
  });

  it('shows or hides on boolean values and keeps the children', async () => {
    const { $ } = await mount(SELECTOR);
    expect($('#two-badge').style.display).toBe('');
    expect($('#two-badge').textContent).toBe('Save 55%');
  });

  it('keeps children and hides booleans before the campaign arrives', async () => {
    document.body.innerHTML = SELECTOR;
    const { engine } = makeEngine({ campaign: new Promise(() => {}) });
    bindAll(document, engine, vi.fn());
    const badge = document.querySelector<HTMLElement>('#two-badge')!;
    expect(badge.style.display).toBe('none');
    expect(badge.textContent).toBe('Save ');
  });

  it('shows and hides from conditions, including negation and URL params', async () => {
    const { $ } = await mount(
      `<p id="empty" data-next-show="cart.isEmpty">empty</p>
       <p id="not-empty" data-next-show="!cart.isEmpty">items</p>
       <p id="banner" data-next-hide="param.banner=='n'">banner</p>
       <p id="seen" data-next-show="param.seen != 'y'">new</p>`,
      { params: { banner: 'n', seen: 'y' } },
    );
    expect($('#empty').style.display).toBe('');
    expect($('#not-empty').style.display).toBe('none');
    expect($('#banner').style.display).toBe('none');
    expect($('#seen').style.display).toBe('none');
  });

  it('warns once about an unknown path', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await mount(`<span data-next-display="cart.totl"></span><span data-next-display="cart.totl"></span>`);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain('cart.totl');
  });
});
