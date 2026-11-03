import { describe, expect, it, vi } from 'vitest';
import { cartView, swapPackage } from '../../src/debug/cart';
import { nodes } from '../../src/debug/view';
import { makeEngine } from '../fixtures/engine';

async function setup() {
  const { engine } = makeEngine();
  await engine.start();
  const root = document.createElement('div');
  const showState = vi.fn();
  const open = new Set<string>();
  const view = cartView(engine, { open, render: () => paint(), showState });
  const paint = () => root.replaceChildren(...nodes(view.view()), view.dialog);
  paint();
  const lines = () =>
    [...root.querySelectorAll('.cline')].map((l) => [
      l.querySelector('.cname > span')!.textContent,
      [...l.querySelectorAll('.cinfo .badge')].map((b) => b.textContent).join(', '),
      l.querySelector('.qty > span')!.textContent,
      l.querySelector('.cprice b')!.textContent,
    ]);
  const button = (text: string) =>
    [...root.querySelectorAll<HTMLElement>('button')].find((b) => b.textContent === text)!;
  const head = () => root.querySelector('.bhead p')!.textContent;
  const picker = () =>
    [...view.dialog.querySelectorAll('.prow')].map((r) => [
      r.querySelector('.pinfo b')!.textContent,
      r.querySelector('.pinfo small')!.textContent,
      r.querySelector('.qty > span')?.textContent ?? r.querySelector('.btn')!.textContent,
    ]);
  const row = (name: string) =>
    [...view.dialog.querySelectorAll<HTMLElement>('.prow')].find(
      (r) => r.querySelector('.pinfo b')!.textContent === name,
    )!;
  const filter = (label: string) =>
    [...view.dialog.querySelectorAll<HTMLElement>('.button-group .btn')].find((b) => b.textContent!.startsWith(label))!;
  const footer = () => view.dialog.querySelector('.psum')!.textContent;
  const rows = (selector: string) =>
    [...root.querySelectorAll(`${selector} dt`)].map((dt) => [dt.textContent, dt.nextElementSibling!.textContent]);
  return { engine, root, view, paint, lines, button, head, picker, row, filter, footer, rows, open, showState };
}

describe('cart', () => {
  it('shows an empty cart, and picks packages from a flat list that adds straight to the cart', async () => {
    const { engine, root, view, button, head, picker, row, filter, footer } = await setup();
    expect(head()).toBe('Empty');
    expect(root.textContent).toContain('The cart is empty');
    button('Add packages').click();
    expect(view.dialog.open).toBe(true);
    expect(filter('Purchasable').getAttribute('aria-pressed')).toBe('true');
    expect(picker()).toEqual([
      ['Earbuds ×1', '#1 · no SKU · qty 1', 'Add'],
      ['Earbuds ×2', '#2 · no SKU · qty 2', 'Add'],
      ['Protection plan', '#9 · no SKU · qty 1', 'Add'],
      ['Earbuds case', '#3 · no SKU · qty 1', 'Add'],
      ['Custom print', '#78 · no SKU · qty 1', 'Add'],
    ]);
    row('Earbuds ×2').querySelector<HTMLElement>('.btn')!.click();
    await vi.waitFor(() => expect(row('Earbuds ×2').querySelector('.qty > span')?.textContent).toBe('1'));
    expect(engine.cart.lines()).toEqual([{ package_id: 2, quantity: 1 }]);
    expect(footer()).toBe('1 package · 1 unit · $89.00 before discounts');
    filter('Selected').click();
    expect(filter('Selected').textContent).toBe('Selected (1)');
    expect(picker().map(([name]) => name)).toEqual(['Earbuds ×2']);
    filter('All').click();
    const search = view.dialog.querySelector<HTMLInputElement>('input[type=search]')!;
    search.value = '#9';
    search.dispatchEvent(new Event('input'));
    expect(picker().map(([name]) => name)).toEqual(['Protection plan']);
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await vi.waitFor(() => expect(engine.cart.lines()).toContainEqual({ package_id: 9, quantity: 1 }));
  });

  it('adds the picked packages, then shows the priced line, its variant and totals that add up', async () => {
    const { root, view, lines, button, head, row, paint, rows } = await setup();
    button('Add packages').click();
    row('Earbuds ×2').querySelector<HTMLElement>('.btn')!.click();
    [...view.dialog.querySelectorAll<HTMLElement>('footer .btn')].find((b) => b.textContent === 'Done')!.click();
    expect(view.dialog.open).toBe(false);
    await vi.waitFor(() => {
      paint();
      expect(head()).toMatch(/^1 package · 1 unit · priced at \d\d:\d\d:\d\d$/);
    });
    expect(lines()).toEqual([['Earbuds ×2', '', '1', '$89.00']]);
    expect(root.querySelector('.cinfo > small')!.textContent).toBe('#2 · White');
    expect(rows('.ctot')).toEqual([
      ['Subtotal', '$89.00'],
      ['Shipping (Standard)', 'Free'],
    ]);
    expect(root.querySelector('.cfoot')!.textContent).toBe('Total$89.0089.00 − 0.00 + 0.00 = 89.00 ✓');
    expect(button('Add or change packages')).toBeDefined();
  });

  it('flags totals the server did not add up', async () => {
    const { engine, root, paint } = await setup();
    await engine.cart.addItem(1);
    engine.attach((ctx) => ctx.update('cart', { summary: { ...ctx.getState().cart.summary!, total: '1.00' } }));
    paint();
    const math = root.querySelector('.cmath')!;
    expect([math.textContent, math.classList.contains('red')]).toEqual([
      "49.00 − 0.00 + 0.00 = 49.00 ≠ 1.00: the server's total does not add up",
      true,
    ]);
  });

  it('opens a line for its package, discounts and variants, and swaps it for another variant', async () => {
    const { engine, root, paint, lines, rows, open } = await setup();
    await engine.cart.addItem(1);
    await engine.cart.applyCoupon('SAVE10');
    paint();
    root.querySelector<HTMLElement>('.cname')!.click();
    expect(open.has('line-1')).toBe(true);
    expect(rows('.cmore')).toEqual([
      ['Package', '#1'],
      ['From', 'added'],
      ['Price', '1 × $49.00'],
      ['Code SAVE10', '−$1.00'],
    ]);
    const color = root.querySelector<HTMLSelectElement>('.cvars select')!;
    expect([root.querySelector('.cvars label')!.textContent, color.value]).toEqual(['Color', 'Black']);
    color.value = 'White';
    color.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(lines()[0]![0]).toBe('Earbuds ×2'));
    expect(engine.cart.lines()).toEqual([{ package_id: 2, quantity: 1 }]);
  });

  it('changes the quantity, and removes the line', async () => {
    const { engine, root, paint, lines, button } = await setup();
    await engine.cart.addItem(1);
    paint();
    button('+').click();
    await vi.waitFor(() => expect(lines()[0]![2]).toBe('2'));
    expect(root.querySelector('.cprice small')!.textContent).toBe('$99.00$49.00/ea');
    button('−').click();
    await vi.waitFor(() => expect(lines()[0]![2]).toBe('1'));
    root.querySelector<HTMLElement>('[aria-label="Remove Earbuds ×1"]')!.click();
    await vi.waitFor(() => expect(root.textContent).toContain('The cart is empty'));
    expect(engine.cart.lines()).toEqual([]);
  });

  it('applies a voucher, says when the server refuses one, lists its discount and removes it', async () => {
    const { engine, root, paint, button, rows } = await setup();
    await engine.cart.addItem(1);
    paint();
    const code = root.querySelector<HTMLInputElement>('#cart-coupon')!;
    code.value = 'nope';
    button('Apply').click();
    await vi.waitFor(() =>
      expect(root.querySelector('.cmsg')!.textContent).toBe('NOPE not applied: the server gives no discount for it'),
    );
    code.value = 'save10';
    button('Apply').click();
    await vi.waitFor(() => expect(root.querySelector('.cmsg')!.textContent).toBe('SAVE10 applied'));
    expect(root.querySelector('.ccodes .badge')!.textContent).toBe('SAVE10✕');
    expect(rows('.ctot')[1]).toEqual(['codeSAVE10', '−$10.00']);
    root.querySelector<HTMLElement>('.ccodes .badge button')!.click();
    await vi.waitFor(() => expect(engine.getState().cart.coupons).toEqual([]));
  });

  it('takes typed keys in the voucher field, and applies the code on Enter', async () => {
    const { engine, root, paint } = await setup();
    await engine.cart.addItem(1);
    paint();
    const code = root.querySelector<HTMLInputElement>('#cart-coupon')!;
    const typed = new KeyboardEvent('keydown', { key: 's', cancelable: true });
    expect(code.onkeydown!.call(code, typed)).not.toBe(false);
    code.value = 'save10';
    code.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
    await vi.waitFor(() => expect(engine.getState().cart.coupons).toEqual(['SAVE10']));
  });

  it('names every group a line comes from', async () => {
    const { engine, paint, lines } = await setup();
    await engine.cart.setGroup('bundle:main', { lines: [{ packageId: 1, quantity: 1 }], vouchers: [] });
    await engine.cart.addItem(1);
    paint();
    expect(lines()[0]![1]).toBe('bundle main, added');
    expect(lines()[0]![2]).toBe('2');
  });

  it('marks a line an estimate until the server prices it', async () => {
    const { engine, root, paint, lines, head } = await setup();
    const adding = engine.cart.addItem(1);
    paint();
    expect([lines()[0]![3], root.querySelector('.cprice small')!.textContent]).toEqual(['$49.00', 'estimate']);
    expect(head()).toBe('1 package · 1 unit · pricing…');
    await adding;
  });

  it('clears the cart, and opens the raw state', async () => {
    const { engine, root, paint, button, showState } = await setup();
    await engine.cart.addItem(1);
    paint();
    button('Raw state').click();
    expect(showState).toHaveBeenCalledOnce();
    button('Clear cart').click();
    await vi.waitFor(() => expect(root.textContent).toContain('The cart is empty'));
  });

  it('swaps a package for its variant in the cart, through the bundle selector that owns the line', async () => {
    const { engine } = makeEngine();
    await engine.start();
    const slotted = [{ id: 'one', lines: [{ packageId: 1, quantity: 1, configurable: true }], vouchers: [] }];
    await engine.selectors.register('main', slotted, 'swap');
    await engine.cart.addItem(2);
    await swapPackage(engine, 1, 2);
    expect(engine.getState().cart.groups).toMatchObject({
      'bundle:main': { lines: [{ packageId: 2, quantity: 1 }] },
      items: { lines: [{ packageId: 2, quantity: 1 }] },
    });
    expect(engine.getState().selectors.main?.slots?.one).toEqual([{ packageId: 2 }]);
    await swapPackage(engine, 2, 1);
    expect(engine.cart.lines()).toEqual([{ package_id: 1, quantity: 2 }]);
  });

  it('swaps a fixed bundle line in the cart, and writes a slot to the cart for a selector that adds on a click', async () => {
    const fixed = makeEngine().engine;
    await fixed.start();
    await fixed.selectors.register(
      'main',
      [{ id: 'one', lines: [{ packageId: 1, quantity: 1 }], vouchers: [] }],
      'swap',
    );
    await swapPackage(fixed, 1, 2);
    expect(fixed.getState().cart.groups['bundle:main']?.lines).toEqual([{ packageId: 2, quantity: 1 }]);

    const { engine } = makeEngine();
    await engine.start();
    await engine.selectors.register(
      'main',
      [{ id: 'one', lines: [{ packageId: 1, quantity: 1, configurable: true }], vouchers: [] }],
      'select',
    );
    await engine.selectors.addToCart('main');
    await swapPackage(engine, 1, 2);
    expect(engine.cart.lines()).toEqual([{ package_id: 2, quantity: 1 }]);
  });
});
