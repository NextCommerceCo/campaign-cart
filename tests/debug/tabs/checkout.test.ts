import { describe, expect, it, vi } from 'vitest';
import { createCheckout } from '../../../src/checkout/state/checkout';
import { cartView } from '../../../src/debug/tabs/cart';
import { checkoutView } from '../../../src/debug/tabs/checkout';
import { nodes } from '../../../src/debug/ui/view';
import { fakeApi } from '../../fixtures/api';
import { campaign } from '../../fixtures/campaign';
import { makeEngine } from '../../fixtures/engine';
import { fakeRules } from '../../fixtures/rules';

async function setup(withCheckout = true, offers: Partial<typeof campaign> = {}) {
  const api = fakeApi();
  const { engine } = makeEngine({ fetch: api.fetch, campaign: Promise.resolve({ ...campaign, ...offers }) });
  await engine.start();
  if (withCheckout) {
    engine.checkout = engine.attach((ctx) => createCheckout(ctx, engine.cart, fakeRules().api));
    engine.checkout.begin();
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
      ['Details', 'Not filled in yet: Email, First name, Last name, Address, Town/City, Postcode', 'todo'],
      ['Shipping', 'Standard', 'done'],
      ['Payment', 'Credit Card · no cc-number and cvv fields on the page', 'bad'],
      ['Order', 'Not placed yet', 'todo'],
    ]);
    expect(view.problems()).toEqual([
      { text: 'Payment: no cc-number and cvv fields on the page', error: true, focus: 'payment' },
    ]);
    expect(root.querySelector('[data-focus="payment"] b')!.textContent).toBe('Payment');
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
    expect(steps()[1]).toEqual(['Details', expect.stringMatching(/^Email: Missing · First name: Missing · /), 'bad']);
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
      ['Open cart', 'Saved: it is in Open Carts on the dashboard, for abandoned-cart emails'],
    ]);
    expect(written('Bill to')).toBeUndefined();
  });

  it('asks the checkout which fields the country requires, so a missing state is never called ready', async () => {
    const { engine, button, paint, steps, verdict } = await setup();
    await engine.cart.addItem(1);
    button('Fill test details').click();
    await vi.waitFor(() => expect(engine.getState().checkout!.rules.US).toBeDefined());
    engine.checkout!.setField('state', '');
    engine.checkout!.setPaymentMethod('paypal');
    paint();
    expect(steps()[1]).toEqual(['Details', expect.stringMatching(/^Not filled in yet: State( · |$)/), 'todo']);
    expect(verdict()).toBe('Not ready yet: details');
    expect(engine.getState().checkout!.errors.state).toBeUndefined();
  });

  it('waits for the card details before calling a card order ready', async () => {
    document.body.innerHTML = '<div id="spreedly-number"></div>';
    const { engine, button, paint, steps, verdict } = await setup(true, { payment_env_key: 'env_test' });
    await engine.cart.addItem(1);
    button('Fill test details').click();
    await vi.waitFor(() => expect(engine.getState().checkout!.rules.US).toBeDefined());
    paint();
    expect(steps()[3]).toEqual(['Payment', 'Credit Card · card details not entered yet', 'todo']);
    expect(verdict()).toBe('Not ready yet: payment');
    engine.checkout!.paymentReady();
    paint();
    expect(steps()[3]).toEqual(['Payment', 'Credit Card · card details entered', 'done']);
    expect(verdict()).toBe('Ready: nothing stops the order');
    document.body.innerHTML = '';
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
