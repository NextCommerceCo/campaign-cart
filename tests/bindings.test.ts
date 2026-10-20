import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindAll } from '../src/bindings';
import { nextUrl } from '../src/bindings/add-to-cart';
import { flush, makeEngine } from './fixtures';

async function setup(html: string, params: Record<string, string> = {}) {
  document.body.innerHTML = html;
  const made = makeEngine();
  Object.assign(made.engine.getState().params, params);
  await made.engine.load();
  const navigate = vi.fn();
  const bindings = bindAll(document, made.engine, navigate);
  await flush();
  return { ...made, bindings, navigate, $: (s: string) => document.querySelector<HTMLElement>(s)! };
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

const SELECTOR = `
  <div data-next-bundle-selector data-next-selector-id="main">
    <div data-next-bundle-card data-next-bundle-id="one" data-next-bundle-items='[{"packageId":1,"quantity":1}]'>
      <span id="one-price" data-next-bundle-display="price"></span>
    </div>
    <div data-next-bundle-card data-next-bundle-id="two" data-next-selected="true"
         data-next-bundle-items='[{"packageId":2,"quantity":1}]'>
      <span id="two-save" data-next-bundle-display="discountPercentage"></span>
    </div>
  </div>
  <div data-next-package-toggle>
    <div id="bump" data-next-toggle-card data-next-package-id="9">
      <span id="bump-price" data-next-toggle-display="price"></span>
    </div>
  </div>
  <span id="total" data-next-display="cart.total"></span>
  <span id="pick" data-next-display="bundle.main.price"></span>`;

describe('bindings', () => {
  it('renders typed, formatted values as text', async () => {
    const { $ } = await setup(`<span data-next-package-id="2"><b id="n" data-next-display="package.name"></b>
      <i id="p" data-next-display="package.price_total"></i></span>
      <img id="img" data-next-display="package.2.image">`);
    expect($('#n').textContent).toBe('Earbuds ×2');
    expect($('#p').textContent).toBe('$89.00');
    expect(($('#img') as HTMLImageElement).src).toBe('https://cdn.test/2.png');
  });

  it('selects the pre-selected card and puts it in the cart', async () => {
    const { engine, $ } = await setup(SELECTOR);
    await flush();
    expect(engine.getState().selections.main).toBe('two');
    expect(engine.lines()).toEqual([{ package_id: 2, quantity: 1 }]);
    expect($('[data-next-bundle-id="two"]').classList.contains('next-selected')).toBe(true);
    expect($('#total').textContent).toBe('$89.00');
    expect($('#pick').textContent).toBe('$89.00');
    expect($('#one-price').textContent).toBe('$49.00');
    expect($('#two-save').textContent).toBe('55%');
  });

  it('swaps the bundle without touching the order bump', async () => {
    const { engine, $ } = await setup(SELECTOR);
    $('#bump').click();
    await flush();
    $('[data-next-bundle-id="one"]').click();
    await flush();
    expect(engine.lines()).toEqual([
      { package_id: 1, quantity: 1 },
      { package_id: 9, quantity: 1 },
    ]);
    expect($('#bump').getAttribute('data-next-active')).toBe('true');
    expect($('#total').textContent).toBe('$58.00');
  });

  it('does not re-add a pre-selected bump the shopper switched off', async () => {
    const html = `<div id="bump" data-next-toggle-card data-next-package-id="9" data-next-selected="true"></div>`;
    const first = await setup(html);
    expect(first.engine.getState().cart.groups['toggle:9']).toBeDefined();
    first.$('#bump').click();
    await flush();
    expect(first.engine.getState().cart.dismissed).toContain('toggle:9');
  });

  it('shows and hides from conditions, including URL params', async () => {
    const { $ } = await setup(
      `<p id="empty" data-next-show="cart.isEmpty">empty</p>
       <p id="banner" data-next-hide="param.banner=='n'">banner</p>`,
      { banner: 'n' },
    );
    expect($('#empty').style.display).toBe('');
    expect($('#banner').style.display).toBe('none');
  });

  it('warns once about an unknown path instead of failing silently', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await setup(`<span data-next-display="cart.totl"></span><span data-next-display="cart.totl"></span>`);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain('cart.totl');
  });

  it('adds to cart and goes to the next page with attribution params', async () => {
    const { engine, navigate, $ } = await setup(
      `<a id="buy" href="#" data-next-action="add-to-cart" data-next-package-id="1" data-next-quantity="2" data-next-url="/checkout"></a>`,
    );
    $('#buy').click();
    await flush();
    await flush();
    expect(engine.lines()).toEqual([{ package_id: 1, quantity: 2 }]);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('carries attribution params and drops one-shot ones', () => {
    const url = nextUrl('/checkout', new URL('https://shop.test/lp?utm_source=fb&forcePackageId=2&reset=1'));
    expect(url).toBe('https://shop.test/checkout?utm_source=fb');
  });
});
