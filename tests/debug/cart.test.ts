import { describe, expect, it, vi } from 'vitest';
import { cartView, swapPackage } from '../../src/debug/cart';
import { nodes } from '../../src/debug/view';
import { makeEngine } from '../fixtures/engine';

async function setup() {
  const { engine } = makeEngine();
  await engine.start();
  const root = document.createElement('div');
  const showState = vi.fn();
  const view = cartView(engine, { open: new Set(), render: () => paint(), showState });
  const paint = () => root.replaceChildren(...nodes(view.view()), view.dialog);
  paint();
  const lines = () =>
    [...root.querySelectorAll('.cline')].map((l) =>
      ['.cinfo > b', '.cinfo > small', '.avatar-count', '.cprice > b'].map((q) => l.querySelector(q)!.textContent),
    );
  const button = (text: string) =>
    [...root.querySelectorAll<HTMLElement>('button')].find((b) => b.textContent === text)!;
  const head = () => root.querySelector('.chead > span')!.textContent;
  const picker = () =>
    [...view.dialog.querySelectorAll('.plist li')].map(
      (li) => li.querySelector('.pname')?.textContent ?? li.textContent,
    );
  const tick = (name: string) => {
    const row = [...view.dialog.querySelectorAll('.plist label')].find((l) => l.textContent!.startsWith(name))!;
    const box = row.querySelector<HTMLInputElement>('input[type=checkbox]')!;
    box.checked = !box.checked;
    box.dispatchEvent(new Event('change'));
  };
  return { engine, root, view, paint, lines, button, head, picker, tick, showState };
}

describe('cart tab', () => {
  it('shows an empty cart, and picks packages from the campaign grouped by product', async () => {
    const { root, view, button, head, picker, tick } = await setup();
    expect(head()).toBe('0 items');
    expect(root.textContent).toContain('Cart is empty');
    button('Add products').click();
    expect(view.dialog.open).toBe(true);
    expect(picker()).toEqual(expect.arrayContaining(['Earbuds ×1', 'Earbuds ×1#1 · Black', 'Earbuds ×2#2 · White']));
    tick('Earbuds ×2');
    expect(view.dialog.querySelector('footer .btn:last-child')!.textContent).toBe('Add 1 to cart');
    tick('Earbuds ×1');
    expect(view.dialog.querySelector<HTMLInputElement>('.plist li:first-child input')!.checked).toBe(true);
  });

  it('adds the picked packages, then shows the priced line, where it came from and the totals', async () => {
    const { root, view, lines, button, head, tick } = await setup();
    button('Add products').click();
    tick('Earbuds ×2');
    (view.dialog.querySelector('footer .btn:last-child') as HTMLElement).click();
    expect(view.dialog.open).toBe(false);
    await vi.waitFor(() => expect(head()).toMatch(/^1 item · \$[\d,.]+ · priced at \d\d:\d\d:\d\d$/));
    expect(lines()).toEqual([['Earbuds ×2', '#2 · from added', '1', expect.stringMatching(/^\$/)]]);
    expect(root.querySelector('.cunit')!.textContent).toMatch(/^\$[\d.]+ ×−1\+$/);
    const totals = [...root.querySelectorAll('.trow')].map((r) => r.firstChild!.textContent);
    expect(totals).toEqual(['Subtotal', 'ShippingStandard', 'Total']);
  });

  it('swaps a line for another variant of its product', async () => {
    const { engine, root, paint, lines } = await setup();
    await engine.cart.addItem(1);
    paint();
    const color = root.querySelector<HTMLSelectElement>('.cvars select')!;
    expect([root.querySelector('.cvars label')!.textContent, color.value]).toEqual(['Color', 'Black']);
    expect([...color.options].map((o) => [o.value, o.disabled])).toEqual([
      ['Black', false],
      ['White', false],
    ]);
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
    button('−').click();
    await vi.waitFor(() => expect(lines()[0]![2]).toBe('1'));
    button('Remove').click();
    await vi.waitFor(() => expect(root.textContent).toContain('Cart is empty'));
    expect(engine.cart.lines()).toEqual([]);
  });

  it('applies a coupon, says when the server refuses one, and removes it', async () => {
    const { engine, root, paint, button } = await setup();
    await engine.cart.addItem(1);
    paint();
    const code = root.querySelector<HTMLInputElement>('.cctl input[type=text]')!;
    code.value = 'nope';
    button('Apply').click();
    await vi.waitFor(() =>
      expect(root.querySelector('.cmsg')!.textContent).toBe('NOPE not applied: the server gives no discount for it'),
    );
    code.value = 'save10';
    button('Apply').click();
    await vi.waitFor(() => expect(root.querySelector('.cmsg')!.textContent).toBe('SAVE10 applied'));
    expect(root.querySelector('.cctl .badge')!.textContent).toBe('SAVE10✕');
    expect(root.querySelector('.cbadges .badge')!.textContent).toBe('Extra 10% OFF');
    const discounts = root.querySelector<HTMLDetailsElement>('.tmore')!;
    expect(discounts.querySelector('summary')!.textContent).toBe('Discounts⌄−$10.00');
    discounts.open = true;
    await vi.waitFor(() => expect(discounts.querySelector('.tpart')!.textContent).toBe('codeSAVE10−$10.00'));
    root.querySelector<HTMLElement>('.cctl .badge button')!.click();
    await vi.waitFor(() => expect(engine.getState().cart.coupons).toEqual([]));
  });

  it('names every group a line comes from', async () => {
    const { engine, paint, lines } = await setup();
    await engine.cart.setGroup('bundle:main', { lines: [{ packageId: 1, quantity: 1 }], vouchers: [] });
    await engine.cart.addItem(1);
    paint();
    expect(lines()[0]![1]).toMatch(/· from bundle "main", added$/);
    expect(lines()[0]![2]).toBe('2');
  });

  it('marks a line an estimate until the server prices it', async () => {
    const { engine, root, paint, lines, head } = await setup();
    const adding = engine.cart.addItem(1);
    paint();
    expect([lines()[0]![3], root.querySelector('.cprice small')!.textContent]).toEqual(['$49.00', 'estimate']);
    expect(head()).toBe('1 item · pricing…');
    await adding;
  });

  it('clears the cart, and opens the raw state', async () => {
    const { engine, root, paint, button, showState } = await setup();
    await engine.cart.addItem(1);
    paint();
    button('Raw state').click();
    expect(showState).toHaveBeenCalledOnce();
    button('Clear cart').click();
    await vi.waitFor(() => expect(root.textContent).toContain('Cart is empty'));
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
