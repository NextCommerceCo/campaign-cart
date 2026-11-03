import { describe, expect, it, vi } from 'vitest';
import { createCheckout } from '../../src/checkout/state/checkout';
import { cartView } from '../../src/debug/cart';
import { checkoutView } from '../../src/debug/checkout';
import { nodes } from '../../src/debug/view';
import { fakeApi } from '../fixtures/api';
import { makeEngine } from '../fixtures/engine';
import { fakeRules } from '../fixtures/rules';

async function setup(withCheckout = true) {
  const api = fakeApi();
  const { engine } = makeEngine({ fetch: api.fetch });
  await engine.start();
  if (withCheckout) {
    engine.checkout = engine.attach((ctx) => createCheckout(ctx, engine.cart, fakeRules().api));
    await engine.checkout.loadCountries();
  }
  const root = document.createElement('div');
  const ui = { open: new Set<string>(), render: () => paint(), showState: vi.fn() };
  const view = checkoutView(engine, cartView(engine, ui), ui);
  const paint = () => root.replaceChildren(...nodes(view.view()));
  paint();
  const steps = () =>
    [...root.querySelectorAll('.kstep')].map((s) => [
      s.querySelector('b')!.textContent,
      s.querySelector('small')!.textContent,
      s.classList[1],
    ]);
  const block = (title: string) =>
    [...root.querySelectorAll('.block')].find((b) => b.querySelector('.bhead h4')?.textContent === title)!;
  const rows = (title: string) =>
    [...block(title).querySelectorAll('.krows dt')].map((dt) => [dt.textContent, dt.nextElementSibling!.textContent]);
  const button = (text: string) =>
    [...root.querySelectorAll<HTMLElement>('button')].find((b) => b.textContent === text)!;
  return { engine, api, root, view, paint, steps, block, rows, button };
}

describe('checkout tab', () => {
  it('shows the cart on a page without a checkout form, and says where the rest is', async () => {
    const { root, view, block } = await setup(false);
    expect(block('Cart')).toBeDefined();
    expect(root.querySelector('.vhead')!.textContent).toBe('Checkout · no checkout form on this page');
    expect(root.querySelector('.knote')!.textContent).toMatch(/^Customer, address and payment show on the page/);
    expect(view.summary()).toBe('cart only');
  });

  it('lists what stands between the shopper and the order, then the cart, customer and payment', async () => {
    const { engine, root, paint, steps, view } = await setup();
    await engine.cart.addItem(1);
    paint();
    expect(view.summary()).toBe('step 1 · not placed yet');
    expect([...root.querySelectorAll('.bhead h4')].map((h) => h.textContent)).toEqual([
      'Order',
      'Cart',
      'Customer',
      'Payment',
    ]);
    expect(steps()).toEqual([
      ['Cart', '1 item', 'done'],
      ['Details', 'Not filled in yet: email, first name, last name, line1, city', 'todo'],
      ['Shipping', 'Standard', 'done'],
      ['Payment', "Card needs cc-number and cvv fields and the campaign's payment_env_key", 'bad'],
      ['Prospect', 'Saved once the email is filled in', 'todo'],
      ['Address rules', 'GB loaded', 'done'],
      ['Order', 'Not placed yet', 'todo'],
    ]);
  });

  it('checks the form like a submit would, and names each field the order would refuse', async () => {
    const { button, steps, rows } = await setup();
    button('Check form').click();
    expect(steps()[1]).toEqual(['Details', expect.stringMatching(/^email: Missing, /), 'bad']);
    expect(rows('Customer')[0]).toEqual(['Email', '—Missing']);
  });

  it('fills test details through the checkout, as typing would', async () => {
    const { engine, button, rows } = await setup();
    await engine.cart.addItem(1);
    button('Fill test details').click();
    expect(engine.getState().checkout!.fields).toMatchObject({
      email: 'test@example.com',
      city: 'Austin',
      state: 'TX',
    });
    expect(rows('Customer').slice(4)).toEqual([
      ['Country', 'United States (US)'],
      ['line1', '1 Test Street'],
      ['line2', '—'],
      ['city', 'Austin'],
      ['state', 'TX'],
      ['postcode', '78701'],
      ['Address', 'Same as shipping'],
    ]);
  });
});
