import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindAttributes } from '../../src/attributes';
import { Query } from '../../src/engine/query';
import { heldApi } from '../fixtures/api';
import { flush, makeEngine } from '../fixtures/engine';

afterEach(() => {
  document.body.innerHTML = '';
  history.replaceState(null, '', '/');
});

async function mount(html: string, params?: Record<string, string>, fetch?: typeof globalThis.fetch) {
  document.body.innerHTML = html;
  const { engine } = makeEngine({ params, fetch });
  await engine.start();
  const query = new Query(engine);
  const navigate = vi.fn();
  const bindings = bindAttributes(document, engine, query, { navigate });
  await engine.cart.settled();
  await flush();
  return { engine, query, navigate, bindings, $: (s: string) => document.querySelector<HTMLElement>(s)! };
}

const settle = async (engine: { cart: { settled(): Promise<void> } }) => {
  await flush();
  await engine.cart.settled();
  await flush();
};

describe('attributes v2: reading values', () => {
  it('writes a value by its field: money, a percentage, a number, an image, a link and a control', async () => {
    const { engine, $ } = await mount(
      `
      <span id="total" data-next-query="cart.total" data-next-empty="…"></span>
      <span id="qty" data-next-query="cart.quantity"></span>
      <img id="img" data-next-query="package.2.image" alt="">
      <a id="link" data-next-query="param.next">go</a>
      <input id="input" data-next-query="package.2.price">
      <span id="pct" data-next-query="cart.discount_percentage"></span>
      <span id="currency" data-next-query="cart.currency">USD<br></span>`,
      { next: 'https://shop.test/n' },
    );
    expect($('#total').textContent).toBe('…');
    await engine.cart.addItem(1, 2);
    await settle(engine);
    expect($('#total').textContent).toBe('$98.00');
    expect($('#qty').textContent).toBe('2');
    expect($('#img').getAttribute('src')).toBe('https://cdn.test/2.png');
    expect($('#link').getAttribute('href')).toBe('https://shop.test/n');
    expect(($('#input') as HTMLInputElement).value).toBe('$89.00');
    expect($('#pct').textContent).toBe('0%');
    expect($('#currency').innerHTML).toBe('USD');
  });

  it('writes in the format the page asks for, or the one a defined field gave', async () => {
    const { engine, query, bindings, $ } = await mount(`
      <span id="code" data-next-query="package.2.price" data-next-format="currency_code"></span>
      <span id="round" data-next-query="package.1.price" data-next-format="currency_rounded"></span>
      <span id="number" data-next-query="package.2.price" data-next-format="number"></span>`);
    expect($('#code').textContent).toBe('$89.00 USD');
    expect($('#round').textContent).toBe('$49');
    expect($('#number').textContent).toBe('89');
    query.define('Cart', 'per_day', (c: { quantity: number }) => c.quantity * 1.5, { format: 'currency' });
    document.body.insertAdjacentHTML('beforeend', '<span id="per-day" data-next-query="cart.per_day"></span>');
    bindings.bind(document.body);
    await engine.cart.addItem(1);
    await settle(engine);
    expect($('#per-day').textContent).toBe('$1.50');
  });

  it('shows and hides on conditions the 0.4.x grammar could not read', async () => {
    const { engine, $ } = await mount(`
      <p id="free" data-next-show="cart.total >= 80 && cart.lines">Free shipping</p>
      <p id="empty" data-next-hide="cart.lines">Add something</p>`);
    expect($('#free').hidden).toBe(true);
    expect($('#empty').hidden).toBe(false);
    await engine.cart.addItem(2);
    await settle(engine);
    expect($('#free').hidden).toBe(false);
    expect($('#free').classList.contains('next-visible')).toBe(true);
    expect($('#empty').hidden).toBe(true);
  });

  it('repeats a template per item, each copy reading its own item and acting on it', async () => {
    const { engine, $ } = await mount(`
      <div id="lines" data-next-each="cart.lines"><template>
        <div class="line"><span class="title" data-next-query="product_title"></span>
          <span class="total" data-next-query="total"></span>
          <button class="more" data-next-action="setQuantity" data-next-quantity="+1">+</button>
          <button class="remove" data-next-action="removeItem">×</button></div>
      </template></div>`);
    expect($('#lines').hasAttribute('data-next-empty')).toBe(true);
    await engine.cart.addItem(1);
    await engine.cart.addItem(9);
    await settle(engine);
    const titles = () => [...document.querySelectorAll('.title')].map((e) => e.textContent);
    expect(titles()).toEqual(['Earbuds ×1', 'Protection plan']);
    expect([...document.querySelectorAll('.total')].map((e) => e.textContent)).toEqual(['$49.00', '$9.00']);
    document.querySelector<HTMLElement>('.more')!.click();
    await settle(engine);
    expect(engine.cart.lines()).toEqual([
      { package_id: 1, quantity: 2 },
      { package_id: 9, quantity: 1 },
    ]);
    document.querySelectorAll<HTMLElement>('.remove')[1]!.click();
    await settle(engine);
    expect(titles()).toEqual(['Earbuds ×1']);
  });

  it('keeps a row, and the input in it, while only its values change', async () => {
    const { engine } = await mount(`
      <div data-next-each="cart.lines"><template>
        <div><input class="note"><span class="qty" data-next-query="quantity"></span></div>
      </template></div>`);
    await engine.cart.addItem(1);
    await settle(engine);
    const input = document.querySelector<HTMLInputElement>('.note')!;
    input.value = 'gift';
    await engine.cart.setQuantity(1, 3);
    await settle(engine);
    expect(document.querySelector('.note')).toBe(input);
    expect(input.value).toBe('gift');
    expect(document.querySelector('.qty')!.textContent).toBe('3');
    await engine.cart.addItem(9);
    await settle(engine);
    expect(document.querySelectorAll('.note')).toHaveLength(2);
  });

  it('reads short paths from data-next-for, and roots from inside it', async () => {
    const { $ } = await mount(`
      <div data-next-for="package.2"><span id="name" data-next-query="product_title"></span>
      <span id="cur" data-next-query="campaign.currency"></span></div>`);
    expect($('#name').textContent).toBe('Earbuds ×2');
    expect($('#cur').textContent).toBe('USD');
  });
});

describe('attributes v2: options', () => {
  const SELECTOR = `
    <div id="sel" data-next-selector="main">
      <div id="one" data-next-option="one" data-next-items="1"><span class="price" data-next-query="total"></span></div>
      <div id="two" data-next-option="two" data-next-items="2" data-next-vouchers="SAVE10" data-next-selected
           data-next-min-quantity="1" data-next-max-quantity="2">
        <span class="price" data-next-query="total"></span>
        <s class="was" data-next-show="total_discount > 0" data-next-query="subtotal"></s>
      </div>
    </div>
    <div data-next-for="selector.main">
      <button id="minus" data-next-action="setQuantity" data-next-quantity="-1">−</button>
      <span id="qty" data-next-query="quantity"></span>
      <button id="plus" data-next-action="setQuantity" data-next-quantity="+1">+</button>
    </div>`;

  it('picks the preselected option, puts it in the cart, and marks each option’s state', async () => {
    const { engine, $ } = await mount(SELECTOR);
    expect(engine.getState().selectors.main!.picked).toBe('two');
    expect(engine.getState().cart.groups['bundle:main']).toEqual({
      lines: [{ packageId: 2, quantity: 1 }],
      vouchers: ['SAVE10'],
    });
    expect($('#two').hasAttribute('data-next-selected')).toBe(true);
    expect($('#two').hasAttribute('data-next-in-cart')).toBe(true);
    expect($('#two').classList.contains('next-selected')).toBe(true);
    expect($('#one').hasAttribute('data-next-selected')).toBe(false);
    expect($('#one').getAttribute('aria-pressed')).toBe('false');
    $('#one').click();
    await settle(engine);
    expect(engine.getState().selectors.main!.picked).toBe('one');
    expect($('#one').hasAttribute('data-next-selected')).toBe(true);
  });

  it('shows each option’s server price with its own vouchers, and the campaign’s until it arrives', async () => {
    const { engine, $ } = await mount(SELECTOR);
    await settle(engine);
    expect($('#one .price').textContent).toBe('$49.00');
    expect($('#two .price').textContent).toBe('$89.00');
    expect($('#two .was').hidden).toBe(true);
  });

  it('keeps an option’s price while its new quantity is being priced', async () => {
    const api = heldApi({ offers: { 2: 0.5 } });
    const { engine, $ } = await mount(SELECTOR, undefined, api.fetch);
    await settle(engine);
    const before = $('#two .price').textContent;
    api.hold();
    $('#plus').click();
    await flush();
    expect(engine.getState().selectors.main?.quoting).toBe(true);
    expect($('#two .price').textContent).toBe(before);
    api.release();
    await settle(engine);
    expect($('#two .price').textContent).not.toBe(before);
  });

  it('steps the picked option’s quantity within its limits, and disables a step that cannot move', async () => {
    const { engine, $ } = await mount(SELECTOR);
    expect($('#qty').textContent).toBe('1');
    expect(($('#minus') as HTMLButtonElement).disabled).toBe(true);
    $('#plus').click();
    await settle(engine);
    expect($('#qty').textContent).toBe('2');
    expect(($('#plus') as HTMLButtonElement).disabled).toBe(true);
    expect(engine.getState().cart.groups['bundle:main']!.lines).toEqual([{ packageId: 2, quantity: 2 }]);
  });

  it('enables a package step whose limit attribute is empty, as the step itself has no limit then', async () => {
    const { $ } = await mount(
      `<button id="up" data-next-action="setQuantity" data-next-package-id="1" data-next-quantity="+1"
               data-next-max-quantity="">+</button>`,
    );
    expect(($('#up') as HTMLButtonElement).disabled).toBe(false);
  });

  it('adds a deferred selector’s pick with a button, then opens the next page with the visit’s parameters', async () => {
    const { engine, navigate, $ } = await mount(
      `<div data-next-selector="main" data-next-defer>
         <div data-next-option="one" data-next-items="1"></div></div>
       <button id="go" data-next-action="addItem" data-next-selector-id="main" data-next-go="/checkout">Continue</button>`,
      { utm_source: 'fb' },
    );
    expect(engine.cart.lines()).toEqual([]);
    $('#go').click();
    await settle(engine);
    expect(engine.cart.lines()).toEqual([{ package_id: 1, quantity: 1 }]);
    expect(navigate).toHaveBeenCalledWith(expect.stringMatching(/\/checkout\?utm_source=fb$/));
  });

  it('switches an order bump on and off, prices it while off, and names it under selector.<id>', async () => {
    const { engine, query, $ } = await mount(`
      <div id="bump" data-next-option="protect" data-next-items="9">
        <span id="bump-price" data-next-query="total"></span></div>
      <p id="protected" data-next-show="selector.protect.in_cart">Protected</p>`);
    await settle(engine);
    expect($('#bump-price').textContent).toBe('$9.00');
    expect($('#protected').hidden).toBe(true);
    $('#bump').click();
    await settle(engine);
    expect(engine.getState().cart.groups['toggle:9']).toBeDefined();
    expect($('#bump').hasAttribute('data-next-selected')).toBe(true);
    expect($('#protected').hidden).toBe(false);
    expect(query.get('selector.protect.in_cart')).toBe(true);
    $('#bump').click();
    await settle(engine);
    expect(engine.getState().cart.groups['toggle:9']).toBeUndefined();
    expect(engine.getState().cart.dismissed).toContain('toggle:9');
  });

  it('sends what the shopper types into an option’s properties with its lines', async () => {
    const { engine, $ } = await mount(`
      <div data-next-selector="engrave"><div data-next-option="one" data-next-items="1" data-next-selected>
        <input id="text" data-next-field="properties.engraving"></div></div>`);
    ($('#text') as HTMLInputElement).value = ' For Sam ';
    $('#text').dispatchEvent(new Event('change'));
    await settle(engine);
    expect(engine.getState().cart.groups['bundle:engrave']!.lines).toEqual([
      { packageId: 1, quantity: 1, properties: { engraving: 'For Sam' } },
    ]);
  });

  it('draws a variant picker for a one-line option, and swaps the option’s package when one is picked', async () => {
    const { engine, $ } = await mount(`
      <div data-next-selector="tee">
        <div data-next-option="tee" data-next-items="1">
          <select id="color" data-next-field="variants.color"></select>
          <div id="swatches" data-next-field="variants.color"></div>
          <span id="name" data-next-query="lines.0.product_title"></span>
        </div></div>`);
    const select = $('#color') as HTMLSelectElement;
    expect([...select.options].map((o) => [o.value, o.selected])).toEqual([
      ['Black', true],
      ['White', false],
    ]);
    expect([...$('#swatches').querySelectorAll('button')].map((b) => b.getAttribute('data-next-value'))).toEqual([
      'black',
      'white',
    ]);
    select.value = 'White';
    select.dispatchEvent(new Event('change'));
    await settle(engine);
    expect(engine.getState().cart.groups['bundle:tee']!.lines).toEqual([{ packageId: 2, quantity: 1 }]);
    expect($('#name').textContent).toBe('Earbuds ×2');
    expect($('#swatches [data-next-value="white"]')!.hasAttribute('data-next-selected')).toBe(true);
  });

  it('prices an option on a page opened with ?ref_id as a post-purchase offer, and leaves the cart alone', async () => {
    history.replaceState(null, '', '/upsell/?ref_id=R1');
    const { engine } = await mount(
      `<div data-next-option="offer" data-next-items="9"><span data-next-query="total"></span></div>`,
    );
    expect(engine.getState().selectors.offer!.mode).toBe('offer');
    expect(engine.cart.lines()).toEqual([]);
  });
});

describe('attributes v2: actions', () => {
  it('runs a form’s action on submit with its fields, and shows why it was refused', async () => {
    const { engine, $ } = await mount(`
      <form id="coupon" data-next-action="applyCoupon"><input id="code" data-next-field="code"><button>Apply</button></form>
      <p id="why" data-next-query="errors.code"></p>
      <div data-next-each="cart.coupons"><template><span class="c" data-next-query="code"></span>
        <button class="x" data-next-action="removeCoupon">×</button></template></div>`);
    await engine.cart.addItem(1);
    await settle(engine);
    ($('#code') as HTMLInputElement).value = 'nope';
    $('#coupon').dispatchEvent(new Event('submit', { cancelable: true }));
    await settle(engine);
    expect($('#why').textContent).toContain('NOPE');
    expect($('#coupon').hasAttribute('data-next-invalid')).toBe(true);
    ($('#code') as HTMLInputElement).value = 'save10';
    $('#coupon').dispatchEvent(new Event('submit', { cancelable: true }));
    await settle(engine);
    expect(engine.getState().cart.coupons).toEqual(['SAVE10']);
    expect($('#why').textContent).toBe('');
    document.querySelector<HTMLElement>('.x')!.click();
    await settle(engine);
    expect(engine.getState().cart.coupons).toEqual([]);
  });

  it('empties the cart before an addItem with data-next-replace', async () => {
    const { engine, $ } = await mount(
      '<button id="only" data-next-action="addItem" data-next-package-id="2" data-next-replace>Buy</button>',
    );
    await engine.cart.addItem(1);
    await settle(engine);
    $('#only').click();
    await vi.waitFor(() => expect(engine.cart.lines()).toEqual([{ package_id: 2, quantity: 1 }]));
  });

  it('leaves an element alone when its data-next-action names no action', async () => {
    const { engine, $ } = await mount(`<button id="b" data-next-action="select-variants">Pick</button>`);
    $('#b').click();
    await settle(engine);
    expect($('#b').hasAttribute('data-next-disabled')).toBe(false);
    expect(engine.cart.lines()).toEqual([]);
  });

  it('disables an add-to-cart button until its selector has a pick, and marks it busy while it runs', async () => {
    const { engine, $ } = await mount(`
      <button id="add" data-next-action="addItem" data-next-selector-id="later">Add</button>
      <button id="pkg" data-next-action="addItem" data-next-package-id="1" data-next-quantity="2">Add 2</button>`);
    expect(($('#add') as HTMLButtonElement).disabled).toBe(true);
    $('#pkg').click();
    expect($('#pkg').hasAttribute('data-next-loading')).toBe(true);
    await settle(engine);
    expect($('#pkg').hasAttribute('data-next-loading')).toBe(false);
    expect(engine.cart.lines()).toEqual([{ package_id: 1, quantity: 2 }]);
  });
});
