import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindAll } from '../src/bindings';
import { fakeApi, flush, makeEngine, MemoryStorage } from './fixtures';

async function setup(html: string, opts: { params?: Record<string, string>; session?: Storage; fetch?: typeof fetch } = {}) {
  document.body.innerHTML = html;
  const made = makeEngine({ session: opts.session, fetch: opts.fetch, params: opts.params });
  made.engine.restore();
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
      <div id="two-badge" data-next-bundle-display="hasDiscount">Save <span data-next-bundle-display="discountPercentage"></span></div>
    </div>
  </div>
  <div data-next-toggle-container>
    <div id="bump" data-next-toggle-card data-next-package-id="9">
      <input id="note" type="text">
      <span id="bump-price" data-next-toggle-display="price"></span>
    </div>
  </div>
  <span id="total" data-next-display="cart.total"></span>
  <span id="pick" data-next-display="bundle.main.price"></span>
  <span id="by-card" data-next-display="bundle.one.price"></span>`;

describe('display', () => {
  it('renders typed, formatted values as text', async () => {
    const { $ } = await setup(`<span data-next-package-id="2"><b id="n" data-next-display="package.name"></b>
      <i id="p" data-next-display="package.price_total"></i></span>
      <img id="img" data-next-display="package.2.image">`);
    expect($('#n').textContent).toBe('Earbuds ×2');
    expect($('#p').textContent).toBe('$89.00');
    expect(($('#img') as HTMLImageElement).src).toBe('https://cdn.test/2.png');
  });

  it('shows or hides on boolean values and keeps the children', async () => {
    const { $ } = await setup(SELECTOR);
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
    const { $ } = await setup(
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
    await setup(`<span data-next-display="cart.totl"></span><span data-next-display="cart.totl"></span>`);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain('cart.totl');
  });
});

describe('bundle selector', () => {
  it('puts the pre-selected card in the cart', async () => {
    const { engine, $ } = await setup(SELECTOR);
    expect(engine.getState().selections.main).toBe('two');
    expect(engine.lines()).toEqual([{ package_id: 2, quantity: 1 }]);
    expect($('[data-next-bundle-id="two"]').classList.contains('next-selected')).toBe(true);
    expect($('#total').textContent).toBe('$89.00');
    expect($('#pick').textContent).toBe('$89.00');
    expect($('#by-card').textContent).toBe('$49.00');
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
    expect($('#total').textContent).toBe('$58.00');
    expect($('#two-badge').style.display).toBe('');
  });

  it('does not re-send a cart that already matches the restored pick', async () => {
    const session = new MemoryStorage();
    await setup(SELECTOR, { session });
    const api = fakeApi();
    await setup(SELECTOR, { session, fetch: api.fetch });
    expect(api.calls).toHaveLength(1);
  });

  it('only records the pick in select mode and on upsell pages', async () => {
    const select = await setup(SELECTOR.replace('data-next-selector-id="main"', 'data-next-selector-id="main" data-next-selection-mode="select"'));
    expect(select.engine.lines()).toEqual([]);
    expect(select.engine.getState().selections.main).toBe('two');
    const upsell = await setup(`<div data-next-upsell="offer"></div>${SELECTOR.replace(/<div data-next-toggle-container>[\s\S]*?<\/div>\s*<\/div>/, '')}`);
    expect(upsell.engine.lines()).toEqual([]);
  });
});

describe('order bump', () => {
  it('marks the card and its container the way the live CSS expects', async () => {
    const { $ } = await setup(SELECTOR);
    $('#bump').click();
    await flush();
    for (const el of [$('#bump'), $('[data-next-toggle-container]')]) {
      expect(el.classList.contains('next-in-cart')).toBe(true);
      expect(el.classList.contains('next-active')).toBe(true);
    }
  });

  it('ignores clicks in form fields inside the card', async () => {
    const { engine, $ } = await setup(SELECTOR);
    $('#note').click();
    await flush();
    expect(engine.getState().cart.groups['toggle:9']).toBeUndefined();
  });

  it('does not re-add a pre-selected bump the shopper switched off', async () => {
    const session = new MemoryStorage();
    const html = `<div id="bump" data-next-toggle-card data-next-package-id="9" data-next-selected="true"></div>`;
    const first = await setup(html, { session });
    expect(first.engine.getState().cart.groups['toggle:9']).toBeDefined();
    first.$('#bump').click();
    await flush();
    const second = await setup(html, { session });
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
    const { engine, $ } = await setup(
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

describe('next.bind', () => {
  it('binds an element once, including the root itself', async () => {
    const { engine, bindings, $ } = await setup(SELECTOR);
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

describe('add to cart', () => {
  it('adds and goes to the next page right away with attribution params', async () => {
    const { engine, navigate, $ } = await setup(
      `<a id="buy" href="#" data-next-action="add-to-cart" data-next-package-id="1" data-next-quantity="2" data-next-url="/checkout"></a>`,
      { params: { utm_source: 'fb', forcePackageId: '2' } },
    );
    $('#buy').click();
    expect(engine.lines()).toEqual([{ package_id: 1, quantity: 2 }]);
    expect(navigate).toHaveBeenCalledWith(`${location.origin}/checkout?utm_source=fb`);
    $('#buy').click();
    expect(engine.lines()).toEqual([{ package_id: 1, quantity: 2 }]);
  });

});
