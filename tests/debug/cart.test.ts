import { describe, expect, it, vi } from 'vitest';
import { cartView } from '../../src/debug/cart';
import { nodes } from '../../src/debug/view';
import { makeEngine } from '../fixtures/engine';

async function setup() {
  const { engine } = makeEngine();
  await engine.start();
  const root = document.createElement('div');
  const showState = vi.fn();
  const view = cartView(engine, { open: new Set(), render: () => paint(), showState });
  const paint = () => root.replaceChildren(...nodes(view.view()));
  paint();
  const lines = () =>
    [...root.querySelectorAll('.cline')].map((l) =>
      ['.cname', '.csource', '.cstep span', '.cprice'].map((q) => l.querySelector(q)!.textContent),
    );
  const button = (text: string) =>
    [...root.querySelectorAll<HTMLElement>('button')].find((b) => b.textContent === text)!;
  const head = () => root.querySelector('.chead > span')!.textContent;
  return { engine, root, paint, lines, button, head, showState };
}

describe('cart tab', () => {
  it('shows an empty cart and every campaign package to add', async () => {
    const { root, head } = await setup();
    expect(head()).toBe('0 items');
    expect(root.textContent).toContain('Cart is empty');
    const options = [...root.querySelectorAll('select')].map((s) => [...s.options].map((o) => o.text));
    expect(options).toEqual([['standard · $0.00'], expect.arrayContaining(['#1 · Earbuds ×1 · $49.00'])]);
  });

  it('adds a package, then shows the priced line, where it came from and the totals', async () => {
    const { root, lines, button, head } = await setup();
    root.querySelectorAll('select')[1]!.value = '2';
    root.querySelector<HTMLInputElement>('.cqty')!.value = '3';
    button('Add to cart').click();
    await vi.waitFor(() => expect(head()).toMatch(/^3 items · \$[\d,.]+ · priced at \d\d:\d\d:\d\d$/));
    expect(lines()).toEqual([['Earbuds ×2', '#2 · from added', '3', expect.stringMatching(/^\$/)]]);
    expect(root.querySelector('.cunit')!.textContent).toMatch(/^\$[\d.]+ × −3\+$/);
    expect(root.querySelector('.cvar')!.textContent).toBe('ColorWhite');
    const totals = [...root.querySelectorAll('.trow')].map((r) => r.firstChild!.textContent);
    expect(totals).toEqual(['Subtotal', 'ShippingStandard', 'Total']);
  });

  it('changes the quantity, and removes the line', async () => {
    const { engine, root, paint, lines, button } = await setup();
    await engine.cart.addItem(1);
    paint();
    button('+').click();
    await vi.waitFor(() => expect(lines()[0]![2]).toBe('2'));
    button('−').click();
    await vi.waitFor(() => expect(lines()[0]![2]).toBe('1'));
    button('✕').click();
    await vi.waitFor(() => expect(root.textContent).toContain('Cart is empty'));
    expect(engine.cart.lines()).toEqual([]);
  });

  it('applies a coupon, says when the server refuses one, and removes it', async () => {
    const { engine, root, paint, button } = await setup();
    await engine.cart.addItem(1);
    paint();
    const code = root.querySelector<HTMLInputElement>('.cin')!;
    code.value = 'nope';
    button('Apply').click();
    await vi.waitFor(() =>
      expect(root.querySelector('.cmsg')!.textContent).toBe('NOPE not applied: the server gives no discount for it'),
    );
    code.value = 'save10';
    button('Apply').click();
    await vi.waitFor(() => expect(root.querySelector('.cmsg')!.textContent).toBe('SAVE10 applied'));
    expect(root.querySelector('.coupon')!.textContent).toBe('SAVE10 ✕');
    expect(root.querySelector('.cbadge')!.textContent).toBe('Extra 10% OFF');
    const discounts = root.querySelector<HTMLDetailsElement>('.tmore')!;
    expect(discounts.querySelector('summary')!.textContent).toBe('Discounts⌄−$10.00');
    discounts.open = true;
    await vi.waitFor(() => expect(discounts.querySelector('.tpart')!.textContent).toBe('codeSAVE10−$10.00'));
    root.querySelector<HTMLElement>('.coupon button')!.click();
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
    const { engine, paint, lines, head } = await setup();
    const adding = engine.cart.addItem(1);
    paint();
    expect(lines()[0]![3]).toBe('$49.00estimate');
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
});
