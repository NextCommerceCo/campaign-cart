import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindAttributes } from '../../src/attributes';
import { display } from '../../src/attributes/value';
import { bindAll } from '../../src/bindings';
import { useCurrencyFormats } from '../../src/engine/display/format';
import { Query } from '../../src/engine/display/query';
import { fakeApi, heldApi } from '../fixtures/api';
import { campaign } from '../fixtures/campaign';
import { flush, makeEngine } from '../fixtures/engine';
import { FakeObserver } from '../bindings/observer';

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
      <picture><source id="source" data-next-query="package.2.image"></picture>
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
    expect($('#source').getAttribute('srcset')).toBe('https://cdn.test/2.png');
    expect($('#link').getAttribute('href')).toBe('https://shop.test/n');
    expect(($('#input') as HTMLInputElement).value).toBe('$89.00');
    expect($('#pct').textContent).toBe('0%');
    expect($('#currency').innerHTML).toBe('USD');
  });

  it('writes a sum of paths and numbers, as its first path’s field is written', async () => {
    const { engine, $ } = await mount(`
      <span id="each" data-next-query="cart.total / cart.quantity" data-next-empty="…"></span>
      <span id="units" data-next-query="cart.quantity * 3"></span>
      <span id="plain" data-next-query="cart.total / 3" data-next-format="number"></span>
      <div data-next-each="cart.lines"><template><b class="half" data-next-query="total / 2"></b></template></div>
      <span id="bad" data-next-query="cart.total +"></span>`);
    expect($('#each').textContent).toBe('…');
    await engine.cart.addItem(1, 2);
    await settle(engine);
    expect($('#each').textContent).toBe('$49.00');
    expect($('#units').textContent).toBe('6');
    expect($('#plain').textContent).toBe('32.67');
    expect(document.querySelector('.half')!.textContent).toBe('$49.00');
    expect($('#bad').textContent).toBe('');
    expect(engine.log.entries().map((e) => e.message)).toContain(
      'cannot read the sum in data-next-query="cart.total +"',
    );
  });

  it('writes cart.total_before_shipping as money, a field of the cart', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { engine, $ } = await mount(
      '<span id="before" data-next-query="cart.total_before_shipping"></span>',
      undefined,
      fakeApi({ shipping: 9.99 }).fetch,
    );
    await engine.cart.addItem(1, 2);
    await settle(engine);
    expect($('#before').textContent).toBe('$98.00');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
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

  it('writes every money format by the currency’s rule, currency_code with the narrow symbol, amount without one', async () => {
    const shown = async (currency: string, locale?: string) => {
      const { engine } = makeEngine({ campaign: Promise.resolve({ ...campaign, currency }), locale });
      await engine.start();
      return (format: string | null, n = 49.9) => display('price', n, engine, format);
    };
    const cad = await shown('CAD');
    expect([cad(null), cad('currency'), cad('currency_rounded', 49)]).toEqual(['CA$49.90', 'CA$49.90', 'CA$49']);
    expect([cad('currency_code'), cad('amount'), cad('number')]).toEqual(['$49.90 CAD', '49.90', '49.9']);
    expect([(await shown('USD'))('amount'), (await shown('JPY'))('amount', 5000)]).toEqual(['49.90', '5,000']);
    expect((await shown('EUR', 'de'))('amount', 1234.5)).toBe('1.234,50');
    expect((await shown(''))('amount')).toBe('49.90');
    try {
      useCurrencyFormats({ en: { 'formats.currency.CAD': 'C${amount}' } });
      expect([cad(null), cad('currency_rounded', 49)]).toEqual(['C$49.90', 'C$49']);
      expect([cad('currency_code'), cad('amount')]).toEqual(['$49.90 CAD', '49.90']);
    } finally {
      useCurrencyFormats();
    }
  });

  it('binds a later subtree’s 0.4.x condition once, through the 0.4.x bindings only', async () => {
    document.body.innerHTML = '<main></main>';
    const { engine } = makeEngine();
    await engine.start();
    const v1 = bindAll(document, engine, vi.fn());
    const v2 = bindAttributes(document, engine, new Query(engine), { navigate: vi.fn(), deferred: v1.deferred });
    document.body.insertAdjacentHTML(
      'beforeend',
      '<section id="later"><p id="has" data-next-show="cart.hasItems">In cart</p></section>',
    );
    const later = document.querySelector('#later')!;
    v1.bind(later);
    v2.bind(later);
    await engine.cart.addItem(2);
    await settle(engine);
    const has = document.querySelector<HTMLElement>('#has')!;
    expect(has.hidden).toBe(false);
    expect(has.style.display).toBe('');
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

  it('lists the campaign’s currencies, each row switching to its own and the one in use disabled', async () => {
    const assign = vi.spyOn(location, 'assign').mockImplementation(() => {});
    document.body.innerHTML = `
      <select id="now" data-next-query="campaign.currency"><option>USD</option><option>EUR</option></select>
      <div data-next-each="campaign.available_currencies"><template>
        <button class="currency" data-next-action="setCurrency" data-next-query="label"></button>
      </template></div>`;
    const { engine } = makeEngine({
      campaign: Promise.resolve({
        ...campaign,
        available_currencies: [
          { code: 'USD', label: 'US Dollar' },
          { code: 'EUR', label: 'Euro' },
        ],
      }),
    });
    await engine.start();
    bindAttributes(document, engine, new Query(engine));
    await settle(engine);
    const [usd, eur] = [...document.querySelectorAll<HTMLButtonElement>('.currency')];
    expect([usd!.textContent, eur!.textContent]).toEqual(['US Dollar', 'Euro']);
    expect(document.querySelector<HTMLSelectElement>('#now')!.value).toBe('USD');
    expect([usd!.disabled, eur!.disabled]).toEqual([true, false]);
    eur!.click();
    await settle(engine);
    expect(new URL(assign.mock.calls[0]![0] as string).searchParams.get('currency')).toBe('EUR');
    assign.mockRestore();
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

describe('attributes v2: unknown fields', () => {
  const unknownWarnings = (engine: { log: { entries(): Array<{ level: string; message: string }> } }) =>
    engine.log
      .entries()
      .filter((e) => e.level === 'warn' && e.message.startsWith('unknown field'))
      .map((e) => e.message);

  it('warns once about a field its object’s type does not have, in a query, a condition, a list and a row', async () => {
    const { engine } = await mount(`
      <span data-next-query="cart.totl"></span><span data-next-query="cart.totl"></span>
      <p data-next-show="cart.total_discont > 0">Saved</p>
      <ul data-next-each="cart.line"><template><li></li></template></ul>
      <div data-next-each="cart.lines"><template><span data-next-query="totl"></span></template></div>`);
    await engine.cart.addItem(1);
    await settle(engine);
    await engine.cart.addItem(2);
    await settle(engine);
    expect(unknownWarnings(engine)).toEqual([
      'unknown field "line" on Cart in data-next-each="cart.line"',
      'unknown field "totl" on Cart in data-next-query="cart.totl"',
      'unknown field "total_discont" on Cart in data-next-show="cart.total_discont > 0"',
      'unknown field "totl" on CartItem in data-next-query="totl"',
    ]);
  });

  it('never warns about a field not priced yet, an option’s own field, or one the page defined', async () => {
    const { engine, query, bindings } = await mount(
      `<span data-next-query="cart.total"></span><p data-next-show="cart.discount_percentage > 0"></p>`,
    );
    expect(query.get('cart.total')).toBeUndefined();
    query.define('Cart', 'free_shipping_left', () => undefined);
    document.body.insertAdjacentHTML(
      'beforeend',
      `<span data-next-query="cart.free_shipping_left"></span>
       <div data-next-selector="main"><div data-next-option="one" data-next-items="1">
         <span data-next-query="original_total"></span></div></div>`,
    );
    bindings.bind(document.body);
    await settle(engine);
    expect(unknownWarnings(engine)).toEqual([]);
  });

  it('reads a field the page defined for options inside an option', async () => {
    const { engine, query, bindings, $ } = await mount(`
      <div data-next-selector="main"><div data-next-option="three" data-next-items="1x3">
        <span id="per-day" data-next-query="per_day"></span></div></div>`);
    query.define('Option', 'per_day', (o: { quantity: number }) => o.quantity * 10);
    bindings.render();
    await settle(engine);
    expect($('#per-day').textContent).toBe('30');
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

  it.each([
    [
      'a label bump, clicking its text',
      '<label data-next-option="protect" data-next-items="9"><input id="box" type="checkbox"> <b id="hit">Add</b></label>',
    ],
    [
      'a label bump, clicking its checkbox',
      '<label data-next-option="protect" data-next-items="9"><input id="box" type="checkbox"> Add</label>',
    ],
    [
      'a checkbox inside a bump, clicking the checkbox',
      '<div data-next-option="protect" data-next-items="9"><input id="box" type="checkbox"><label for="box">Add</label></div>',
    ],
    [
      'a checkbox inside a bump, clicking its label',
      '<div data-next-option="protect" data-next-items="9"><input id="box" type="checkbox"><label id="hit" for="box">Add</label></div>',
    ],
    [
      'a checkbox inside a bump, clicking the card',
      '<div data-next-option="protect" data-next-items="9"><input id="box" type="checkbox"><p id="hit">Add</p></div>',
    ],
    [
      'a label bump without a checkbox',
      '<label data-next-option="protect" data-next-items="9"><b id="hit">Add</b></label>',
    ],
  ])('switches %s on and off once per click, the checkbox in step', async (_, html) => {
    const { engine, $ } = await mount(html);
    const setGroup = vi.spyOn(engine.cart, 'setGroup');
    const hit = document.querySelector<HTMLElement>('#hit') ?? $('#box');
    const box = document.querySelector<HTMLInputElement>('#box');
    hit.click();
    await settle(engine);
    expect(setGroup).toHaveBeenCalledTimes(1);
    expect(engine.getState().cart.groups['toggle:9']).toBeDefined();
    if (box) expect(box.checked).toBe(true);
    hit.click();
    await settle(engine);
    expect(setGroup).toHaveBeenCalledTimes(2);
    expect(engine.getState().cart.groups['toggle:9']).toBeUndefined();
    if (box) expect(box.checked).toBe(false);
  });

  it('checks a bump’s checkbox when the bump is preselected', async () => {
    const { engine, $ } = await mount(
      '<label data-next-option="protect" data-next-items="9" data-next-selected><input id="box" type="checkbox"> Add</label>',
    );
    await settle(engine);
    expect(engine.getState().cart.groups['toggle:9']).toBeDefined();
    expect(($('#box') as HTMLInputElement).checked).toBe(true);
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

  it('swaps the option’s package from a selectVariant button in a data-next-each="variants.<code>" row', async () => {
    const { engine, $ } = await mount(`
      <div data-next-selector="tee">
        <div data-next-option="tee" data-next-items="1">
          <div id="rows" data-next-each="variants.color"><template>
            <button data-next-action="selectVariant"><span data-next-query="name"></span></button>
          </template></div>
        </div></div>`);
    const rows = [...$('#rows').querySelectorAll('button')];
    expect(rows.map((b) => [b.textContent, b.disabled])).toEqual([
      ['Black', false],
      ['White', false],
    ]);
    rows[1]!.click();
    await settle(engine);
    expect(engine.getState().cart.groups['bundle:tee']!.lines).toEqual([{ packageId: 2, quantity: 1 }]);
    expect(rows[1]!.hasAttribute('data-next-invalid')).toBe(false);
  });

  it('moves a cart line to another package from a selectVariant button in its variants row', async () => {
    const { engine } = await mount(`
      <div data-next-each="cart.lines"><template><div>
        <div class="rows" data-next-each="variants.color"><template>
          <button data-next-action="selectVariant" data-next-query="name"></button>
        </template></div>
      </div></template></div>`);
    await engine.cart.addItem(1);
    await settle(engine);
    const white = [...document.querySelectorAll<HTMLButtonElement>('.rows button')].find(
      (b) => b.textContent === 'White',
    )!;
    white.click();
    await settle(engine);
    expect(engine.cart.lines()).toEqual([{ package_id: 2, quantity: 1 }]);
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
      <div data-next-each="cart.coupons"><template><span class="c" data-next-query="value"></span>
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
    expect(document.querySelector('.c')!.textContent).toBe('SAVE10');
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

describe('attributes v2: dispose', () => {
  it('stops rendering on an engine update once disposed', async () => {
    const { engine, bindings, $ } = await mount('<span id="qty" data-next-query="cart.quantity"></span>');
    await engine.cart.addItem(1);
    await settle(engine);
    expect($('#qty').textContent).toBe('1');
    bindings.dispose();
    await engine.cart.addItem(1);
    await settle(engine);
    expect(engine.cart.lines()).toEqual([{ package_id: 1, quantity: 2 }]);
    expect($('#qty').textContent).toBe('1');
  });

  it('stops watching its selectors and bumps come on screen once disposed', async () => {
    FakeObserver.all = [];
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    const { bindings } = await mount(`
      <div data-next-selector="main"><div data-next-option="one" data-next-items="1"></div></div>
      <div data-next-option="protect" data-next-items="9"></div>`);
    expect(FakeObserver.all.filter((o) => o.targets.size)).toHaveLength(2);
    bindings.dispose();
    expect(FakeObserver.all.filter((o) => o.targets.size)).toEqual([]);
    vi.unstubAllGlobals();
  });
});
