import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bindCheckout } from '../../src/checkout';
import type { Campaign } from '../../src/engine/types';
import { fakeApi, json } from '../fixtures/api';
import { campaign } from '../fixtures/campaign';
import { flush, makeEngine } from '../fixtures/engine';
import { fakeRules } from '../fixtures/rules';

const CAMPAIGN: Campaign = {
  ...campaign,
  payment_env_key: 'env_test',
  available_shipping_countries: [
    { code: 'US', label: 'United States' },
    { code: 'GB', label: 'United Kingdom' },
  ],
  available_payment_methods: [
    { code: 'bankcard', label: 'Card' },
    { code: 'paypal', label: 'PayPal' },
    { code: 'klarna', label: 'Klarna' },
  ],
  available_express_payment_methods: [
    { code: 'paypal', label: 'PayPal' },
    { code: 'apple_pay', label: 'Apple Pay' },
  ],
};

class FakeNextPayment {
  static fail: string | undefined;
  static submitted: Array<Record<string, string>> = [];
  onReady = () => {};
  onFieldStateChange = (_: unknown) => {};
  onValidation = (_: unknown) => {};
  onError = (_: unknown) => {};
  onTokenized = (_: unknown) => {};
  constructor() {
    queueMicrotask(() => this.onReady());
  }
  submit(card: Record<string, string>) {
    FakeNextPayment.submitted.push(card);
    queueMicrotask(() =>
      FakeNextPayment.fail
        ? this.onError({ message: FakeNextPayment.fail })
        : this.onTokenized({ tokenResponse: { payment_method: { token: 'tok_1' } } }),
    );
  }
  destroy() {}
}

const SHIPPING = {
  email: 'jane@example.com',
  fname: 'Jane',
  lname: 'Doe',
  address1: '1 Main St',
  city: 'Austin',
  province: 'CA',
  postal: '90210',
};

async function mount(file: string, options: { order?: (body: any) => Response; rulesDown?: boolean } = {}) {
  const doc = new DOMParser().parseFromString(readFileSync(`tests/fixtures/pages/${file}`, 'utf8'), 'text/html');
  document.head.innerHTML = doc.head.innerHTML;
  document.body.innerHTML = doc.body.innerHTML;
  vi.stubGlobal('fetch', fakeRules({ geo: 'US', down: options.rulesDown }).send);
  (window as unknown as { NextPayment: unknown }).NextPayment = FakeNextPayment;
  const api = fakeApi({ order: options.order });
  const { engine } = makeEngine({ fetch: api.fetch, campaign: Promise.resolve(CAMPAIGN), session: sessionStorage });
  await engine.start();
  await engine.cart.addItem(2);
  const navigate = vi.fn();
  const form = document.querySelector<HTMLFormElement>('form[data-next-checkout]')!;
  const checkout = bindCheckout(engine, form, navigate);
  await flush();
  await flush();
  const $ = <T extends HTMLElement = HTMLInputElement>(s: string) => document.querySelector<T>(s)!;
  const field = (name: string) => $(`[data-next-checkout-field="${name}"]`);
  const type = (name: string, value: string) => {
    const el = field(name);
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const fill = (values: Record<string, string>) => Object.entries(values).forEach(([k, v]) => type(k, v));
  const submit = async () => {
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await flush();
    await flush();
  };
  const orders = () => api.calls.filter((c) => c.url.endsWith('/orders/'));
  const card = () => {
    $<HTMLSelectElement>('[data-next-checkout-field="exp-month"]').value = '12';
    $<HTMLSelectElement>('[data-next-checkout-field="exp-year"]').value = String(new Date().getFullYear() + 2);
  };
  return { engine, checkout, form, navigate, api, $, field, type, fill, submit, orders, card };
}

beforeEach(() => {
  history.replaceState(null, '', '/olympus/checkout/');
  FakeNextPayment.fail = undefined;
  FakeNextPayment.submitted = [];
  sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

describe('checkout page (olympus, 0.4.43 markup)', () => {
  it('fills the selects, payment panels and express buttons the page leaves empty', async () => {
    const warn = vi.spyOn(console, 'warn');
    const { $, field, type } = await mount('olympus/checkout.html');
    const options = (name: string) =>
      [...$<HTMLSelectElement>(`[data-next-checkout-field="${name}"]`).options].map((o) => o.value);
    expect(options('country')).toEqual(['', 'US', 'GB']);
    expect(field('country').value).toBe('US');
    expect(options('province')).toEqual(['', 'CA', 'NY']);
    expect(options('exp-month')).toHaveLength(13);
    expect($('[data-next-payment-method="credit"]').classList.contains('next-selected')).toBe(true);
    expect($('[data-next-payment-method="paypal"] [data-next-payment-form]').classList).toContain(
      'payment-method__form--collapsed',
    );
    expect($('[data-next-payment-method="apple-pay"]').classList.contains('next-hidden')).toBe(true);
    const express = [...document.querySelectorAll('[data-next-express-checkout="buttons"] button')];
    expect(express.map((b) => b.getAttribute('data-next-express-checkout'))).toEqual(
      expect.arrayContaining(['paypal', 'apple_pay']),
    );
    expect($('#spreedly-number').getAttribute('data-spreedly')).toBe('number');
    const location = $('[data-next-component="location"]');
    expect(location.style.display).toBe('none');
    type('address1', '1 Main St');
    await flush();
    expect(location.style.display).toBe('flex');
    expect(warn).not.toHaveBeenCalled();
    expect(document.querySelector<HTMLFormElement>('form[data-next-checkout]')!.noValidate).toBe(true);
  });

  it('shows each problem under its field, and clears it as the shopper types', async () => {
    const { field, submit, orders, $ } = await mount('olympus/checkout.html');
    await submit();
    expect(orders()).toHaveLength(0);
    expect(field('fname').classList).toContain('next-error-field');
    expect($('.next-error-label[data-next-error-for="first_name"]').textContent).toBe('First name is required');
    expect($('.next-error-label[data-next-error-for="state"]').textContent).toBe('Select a state');
    field('fname').value = 'J';
    field('fname').dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
    expect(field('fname').classList).not.toContain('next-error-field');
    expect(document.querySelector('[data-next-error-for="first_name"]')).toBeNull();
  });

  it('names the fields it cannot point at in the error box', async () => {
    const { fill, card, submit, $, field, orders } = await mount('olympus/checkout.html');
    fill(SHIPPING);
    card();
    field('city').value = '';
    field('city').dispatchEvent(new Event('input', { bubbles: true }));
    field('city').style.display = 'none';
    await submit();
    expect(orders()).toHaveLength(0);
    expect($('[data-next-component="credit-error-text"]').textContent).toBe('Please check the following fields: City');
  });

  it('reads values the browser filled in without telling anyone', async () => {
    const { field, card, submit, orders } = await mount('olympus/checkout.html');
    for (const [name, value] of Object.entries(SHIPPING)) field(name).value = value;
    card();
    await submit();
    await flush();
    expect(orders()[0]!.body.shipping_address).toMatchObject({ first_name: 'Jane', postcode: '90210' });
  });

  it('places a card order with the page’s fields and goes to the success page', async () => {
    const { fill, card, submit, orders, navigate } = await mount('olympus/checkout.html');
    fill(SHIPPING);
    card();
    await submit();
    await flush();
    expect(FakeNextPayment.submitted[0]).toMatchObject({ full_name: 'Jane Doe', month: '12' });
    expect(orders()[0]!.body).toMatchObject({
      payment_detail: { payment_method: 'card_token', card_token: 'tok_1' },
      shipping_address: { first_name: 'Jane', line1: '1 Main St', line4: 'Austin', state: 'CA', postcode: '90210' },
      user: { email: 'jane@example.com' },
      success_url: `${location.origin}/olympus/upsell-bundle-stepper/`,
    });
    expect(navigate).toHaveBeenCalledWith(`${location.origin}/olympus/upsell-bundle-stepper/?ref_id=R1`);
  });

  it('shows a decline in the card error box and lets the shopper retry', async () => {
    const answers = [json({ payment_response_code: '51', payment_details: 'Insufficient funds' }, 400)];
    const { fill, card, submit, $, orders } = await mount('olympus/checkout.html', {
      order: () => answers.shift() ?? json({ ref_id: 'R2' }),
    });
    fill(SHIPPING);
    card();
    await submit();
    await flush();
    const box = $('[data-next-component="credit-error"]');
    expect(box.style.display).toBe('flex');
    expect($('[data-next-component="credit-error-text"]').textContent).toBe('Insufficient funds');
    expect($('button[type="submit"]').getAttribute('aria-busy')).toBe('false');
    await submit();
    await flush();
    expect(orders()).toHaveLength(2);
  });

  it('checks the expiry before the card, and shows what payment.js refused', async () => {
    const { fill, card, submit, $, orders } = await mount('olympus/checkout.html');
    fill(SHIPPING);
    await submit();
    expect($('.next-error-label[data-next-error-for="month"]').textContent).toBe('Expiration month is required');
    expect(FakeNextPayment.submitted).toHaveLength(0);
    card();
    FakeNextPayment.fail = 'Card number is invalid';
    await submit();
    await flush();
    expect($('[data-next-component="credit-error-text"]').textContent).toBe('Card number is invalid');
    expect(document.querySelector('[data-next-error-for="month"]')).toBeNull();
    expect(orders()).toHaveLength(0);
  });

  it('pays by Klarna without touching the card form', async () => {
    const { fill, submit, orders, $ } = await mount('olympus/checkout.html');
    const klarna = $('input[name="payment_method"][value="klarna"]');
    klarna.checked = true;
    klarna.dispatchEvent(new Event('change', { bubbles: true }));
    await flush();
    expect($('[data-next-payment-method="klarna"]').classList.contains('next-selected')).toBe(true);
    fill(SHIPPING);
    await submit();
    await flush();
    expect(FakeNextPayment.submitted).toHaveLength(0);
    expect(orders()[0]!.body.payment_detail).toEqual({ payment_method: 'klarna' });
  });

  it('collects a different billing address in rows cloned from shipping', async () => {
    const { fill, card, submit, orders, $, field } = await mount('olympus/checkout.html');
    const toggle = $('input[name="use_shipping_address"]');
    const section = $('[os-checkout-element="different-billing-address"]');
    expect(section.style.display).toBe('none');
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
    await flush();
    expect(section.style.display).toBe('');
    expect(field('billing-fname').id).toBe('billing_shipping_fname');
    fill(SHIPPING);
    fill({ 'billing-fname': 'Ann', 'billing-lname': 'Lee', 'billing-address1': '2 Side St', 'billing-city': 'Reno' });
    fill({ 'billing-province': 'NY', 'billing-postal': '10001' });
    card();
    await submit();
    await flush();
    expect(orders()[0]!.body).toMatchObject({
      billing_same_as_shipping_address: false,
      billing_address: { first_name: 'Ann', line1: '2 Side St', line4: 'Reno', state: 'NY', country: 'US' },
    });
  });

  it('pays with PayPal express from the injected button, before the form is filled, like 0.4.x', async () => {
    const { orders, navigate } = await mount('olympus/checkout.html', {
      order: () => json({ ref_id: 'R3', payment_complete_url: 'https://paypal.test/R3' }),
    });
    document.querySelector<HTMLButtonElement>('button[data-next-express-checkout="paypal"]')!.click();
    await flush();
    await flush();
    expect(Object.keys(orders()[0]!.body)).not.toContain('shipping_address');
    expect(navigate).toHaveBeenCalledWith('https://paypal.test/R3');
  });

  it('asks for the contact fields before a PayPal order chosen in the form, like 0.4.x requiredFields', async () => {
    const { fill, submit, orders, $, field } = await mount('olympus/checkout.html', {
      order: () => json({ ref_id: 'R4', payment_complete_url: 'https://paypal.test/R4' }),
    });
    const paypal = $('input[name="payment_method"][value="paypal"]');
    paypal.checked = true;
    paypal.dispatchEvent(new Event('change', { bubbles: true }));
    await flush();
    await submit();
    expect(orders()).toHaveLength(0);
    expect(field('email').classList).toContain('next-error-field');
    expect(field('address1').classList).not.toContain('next-error-field');
    fill({ email: 'jane@example.com', fname: 'Jane', lname: 'Doe' });
    await submit();
    await flush();
    expect(orders()[0]!.body.payment_detail).toEqual({ payment_method: 'paypal' });
  });

  it('suggests addresses from the NextCommerce lookup and fills the address, like 0.4.x', async () => {
    (window as unknown as { nextConfig: unknown }).nextConfig = { addressConfig: { enableAutocomplete: true } };
    const { field, api, engine } = await mount('olympus/checkout.html');
    const input = field('address1');
    input.focus();
    input.value = '1 Main';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 350));
    const lookup = api.calls.find((c) => c.url.includes('/addresses/autocomplete/'))!;
    expect(new URL(lookup.url).searchParams.toString()).toBe('query_text=1+Main&country=US');
    const items = [...document.querySelectorAll<HTMLElement>('.pac-container-nextcommerce .pac-item-nextcommerce')];
    expect(items.map((i) => i.textContent)).toEqual(['1 Main St, Austin, TX 73301, USA']);
    expect(items[0]!.querySelector('b')!.textContent).toBe('1');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(input.value).toBe('1 Main St, Austin, TX 73301, USA');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(input.value).toBe('1 Main');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'n' }));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 350));
    document.querySelector<HTMLElement>('.pac-item-nextcommerce')!.click();
    await new Promise((r) => setTimeout(r, 350));
    expect([field('address1').value, field('city').value, field('postal').value, field('province').value]).toEqual([
      '1 Main St',
      'Austin',
      '73301',
      'NY',
    ]);
    expect(engine.getState().checkout!.fields).toMatchObject({ line1: '1 Main St', city: 'Austin', state: 'NY' });
    delete (window as unknown as { nextConfig?: unknown }).nextConfig;
  });

  it('floats each label above its field once the field has a value', async () => {
    const { type, field, engine } = await mount('olympus/checkout.html');
    const label = (name: string) => field(name).closest('.form-group')!.querySelector('label.label-checkout')!;
    expect(label('email').classList).not.toContain('has-value');
    type('email', 'jane@example.com');
    expect(label('email').classList).toContain('has-value');
    expect(field('email').style.paddingTop).toBe('14px');
    type('email', '');
    expect(label('email').classList).not.toContain('has-value');
    engine.checkout!.setField('city', 'Austin');
    await flush();
    expect(field('city').value).toBe('Austin');
    expect(label('city').classList).toContain('has-value');
  });

  it('floats a placeholder-style label while its field has focus', async () => {
    document.body.innerHTML = `<form><div class="form-group"><div class="form-input">
      <label class="label-checkout label-checkout--floating">Email</label>
      <input data-next-checkout-field="email" data-label-behavior="placeholder" placeholder="Email*">
    </div></div></form>`;
    const { bindLabels } = await import('../../src/checkout/labels');
    bindLabels(document.querySelector('form')!);
    const input = document.querySelector('input')!;
    const label = document.querySelector('label')!;
    input.focus();
    input.dispatchEvent(new Event('focus'));
    expect([...label.classList]).toEqual(expect.arrayContaining(['has-value', 'is-focused']));
    expect(input.placeholder).toBe('');
    input.blur();
    input.dispatchEvent(new Event('blur'));
    expect(label.classList).not.toContain('has-value');
    expect(input.placeholder).toBe('Email*');
  });

  it('shows an express failure next to the express buttons', async () => {
    const { type, $ } = await mount('olympus/checkout.html', {
      order: () => json({ message: 'PayPal is unavailable' }, 400),
    });
    type('email', 'jane@example.com');
    type('fname', 'Jane');
    type('lname', 'Doe');
    document.querySelector<HTMLButtonElement>('button[data-next-express-checkout="paypal"]')!.click();
    await flush();
    await flush();
    const express = $('[data-next-component="express-error"]');
    expect(express.style.display).toBe('flex');
    expect(express.textContent).toContain('PayPal is unavailable. Please try a different payment method.');
    expect($('[data-next-component="credit-error"]').style.display).toBe('none');
  });

  it('tells page scripts about the prospect cart, once', async () => {
    const { fill, form } = await mount('olympus/checkout.html');
    const created = vi.fn();
    form.addEventListener('next:prospect-cart-created', (e) => created((e as CustomEvent).detail));
    fill({ email: 'jane@example.com', fname: 'Jane', lname: 'Doe' });
    await flush();
    fill({ lname: 'Does' });
    await flush();
    expect(created).toHaveBeenCalledTimes(1);
    expect(created.mock.calls[0]![0].prospectCart).toMatchObject({ id: 7, email: 'jane@example.com' });
  });
});

describe('three-step checkout (shop-three-step)', () => {
  it('checks step one, records it for the page guard, and moves on', async () => {
    history.replaceState(null, '', '/shop-three-step/information/');
    const { fill, submit, navigate, orders } = await mount('shop-three-step/information.html');
    fill(SHIPPING);
    await submit();
    expect(orders()).toHaveLength(0);
    expect(navigate).toHaveBeenCalledWith(`${location.origin}/shop-three-step/shipping/`);
    const guard = JSON.parse(sessionStorage.getItem('next-checkout-store')!);
    expect(guard.state.step).toBe(2);
    expect(guard.state.formData).toMatchObject({ email: 'jane@example.com', fname: 'Jane', postal: '90210' });
  });

  it('keeps the state chosen on step one when the last step’s hidden copy has no options', async () => {
    history.replaceState(null, '', '/shop-three-step/billing/');
    const { checkout, submit, orders, card } = await mount('shop-three-step/billing.html', { rulesDown: true });
    const step1 = {
      email: 'jane@example.com',
      first_name: 'Jane',
      last_name: 'Doe',
      line1: '1 Main St',
      city: 'Austin',
    };
    for (const [name, value] of Object.entries({ country: 'US', ...step1, state: 'CA', postcode: '90210' })) {
      checkout.setField(name, value);
    }
    card();
    await submit();
    await flush();
    expect(orders()[0]?.body.shipping_address).toMatchObject({ state: 'CA', postcode: '90210' });
  });

  it('shows what was entered earlier on the last step', async () => {
    history.replaceState(null, '', '/shop-three-step/billing/');
    const { checkout, $ } = await mount('shop-three-step/billing.html');
    checkout.setField('email', 'jane@example.com');
    checkout.setField('line1', '1 Main St');
    checkout.setField('city', 'Austin');
    await flush();
    expect($('[data-next-checkout-review="email"]').textContent).toBe('jane@example.com');
    expect($('[data-next-checkout-review="address"]').textContent).toContain('1 Main St, Austin');
    expect($('[data-next-checkout-review="phone"]').classList).toContain('next-review-empty');
  });
});
