import { describe, expect, it, vi } from 'vitest';
import { createCheckout } from '../../src/checkout/state/checkout';
import { cartView } from '../../src/debug/cart';
import { checkoutView } from '../../src/debug/checkout';
import { nodes } from '../../src/debug/view';
import { fakeApi } from '../fixtures/api';
import { campaign } from '../fixtures/campaign';
import { makeEngine } from '../fixtures/engine';
import { fakeRules } from '../fixtures/rules';

async function setup(withCheckout = true, offers: Partial<typeof campaign> = {}) {
  const api = fakeApi();
  const { engine } = makeEngine({ fetch: api.fetch, campaign: Promise.resolve({ ...campaign, ...offers }) });
  await engine.start();
  if (withCheckout) {
    engine.checkout = engine.attach((ctx) => createCheckout(ctx, engine.cart, fakeRules().api));
    await engine.checkout.loadCountries();
  }
  const root = document.createElement('div');
  const ui = { open: new Set<string>(), render: () => paint(), showState: vi.fn(), paymentIcons: vi.fn() };
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
  const verdict = () => block('Order').querySelector('.bhead p')!.textContent;
  const written = (title: string) =>
    [...root.querySelectorAll('.kaddr')]
      .find((a) => a.querySelector('.ksub')!.textContent === title)!
      .querySelector('address')
      ?.innerHTML.split('<br>');
  return { engine, api, root, view, paint, steps, block, rows, button, ui, verdict, written };
}

describe('checkout tab', () => {
  it('shows the cart on a page without a checkout form, and says where the rest is', async () => {
    const { root, view, block } = await setup(false);
    expect(block('Cart')).toBeDefined();
    expect(root.querySelector('.vhead')!.textContent).toBe('Checkout · no checkout form on this page');
    expect(root.querySelector('.knote')!.textContent).toMatch(/^Customer, address and payment show on the page/);
    expect(view.summary()).toBe('cart only');
  });

  it('says whether the order can go through, then lists each step, the cart and the customer', async () => {
    const { engine, root, paint, steps, view, verdict } = await setup();
    await engine.cart.addItem(1);
    paint();
    expect(view.summary()).toBe('step 1');
    expect(verdict()).toBe('Blocked: payment');
    expect([...root.querySelectorAll('.bhead h4')].map((h) => h.textContent)).toEqual(['Order', 'Cart', 'Customer']);
    expect(steps()).toEqual([
      ['Cart', '1 item', 'done'],
      ['Details', 'Not filled in yet: Email, First name, Last name, Address, Town/City', 'todo'],
      ['Shipping', 'Standard', 'done'],
      ['Payment', 'Card · no cc-number and cvv fields on the page', 'bad'],
      ['Prospect', 'Saved once the email is filled in', 'todo'],
      ['Order', 'Not placed yet', 'todo'],
    ]);
    expect([...root.querySelectorAll('.kstep.bad .payment-icon')].map((i) => i.className.split('-').pop())).toEqual([
      'visa',
      'mastercard',
      'express',
      'discover',
    ]);
  });

  it('checks the form like a submit would, and names each field the order would refuse', async () => {
    const { button, steps, rows, root } = await setup();
    button('Check form').click();
    expect(steps()[1]).toEqual(['Details', expect.stringMatching(/^Email: Missing, /), 'bad']);
    expect(rows('Customer')[0]).toEqual(['Email', '—Missing']);
    expect([...root.querySelectorAll('.kaddr .kerrs .badge')].map((b) => b.textContent)).toContain('Address: Missing');
  });

  it('fills test details through the checkout, and writes the address as the country does', async () => {
    const { engine, button, rows, written, paint } = await setup();
    await engine.cart.addItem(1);
    button('Fill test details').click();
    expect(engine.getState().checkout!.fields).toMatchObject({
      email: 'test@example.com',
      city: 'Austin',
      state: 'TX',
    });
    await vi.waitFor(() => {
      paint();
      expect(written('Ship to')).toEqual(['Test Shopper', '1 Test Street', 'Austin, TX 78701', 'United States']);
    });
    engine.checkout!.setField('state', 'CA');
    paint();
    expect(written('Ship to')![2]).toBe('Austin, California 78701');
    expect(rows('Customer')).toEqual([
      ['Email', 'test@example.com'],
      ['Phone', expect.stringMatching(/2015550123|201/)],
      ['Marketing', 'Accepted'],
    ]);
    expect(written('Bill to')).toBeUndefined();
  });

  it('names the payment method the checkout holds, with its icon', async () => {
    const { engine, paint, steps, root, ui } = await setup(true, {
      available_payment_methods: [
        { code: 'bankcard', label: 'Bankcard' },
        { code: 'klarna', label: 'Klarna' },
      ],
    });
    expect(ui.paymentIcons).toHaveBeenCalled();
    engine.checkout!.setPaymentMethod('klarna');
    paint();
    expect(steps()[3]).toEqual(['Payment', 'Klarna', 'done']);
    expect(root.querySelector('.kstep.done .payment-icon')!.className).toBe('payment-icon payment-icon-klarna');
  });
});
