import type { CheckoutState } from '../checkout/state/types';
import type { Engine } from '../engine/engine';
import type { CheckoutError } from '../engine/types';
import type { cartView } from './cart';
import { icon } from './icons';
import { badge, type Child, h, tsugi } from './view';

const PROBLEMS: Record<string, string> = {
  blank: 'Missing',
  not_selected: 'Not selected',
  invalid: 'Invalid',
  invalid_characters: 'Invalid characters',
  contains_emoji: 'Has an emoji',
  too_long: 'Too long',
  not_in_state: 'Not in this state',
};
const METHODS: Record<string, string> = {
  card_token: 'Card',
  paypal: 'PayPal',
  apple_pay: 'Apple Pay',
  google_pay: 'Google Pay',
  shop_pay: 'Shop Pay',
};
const CARD_BRANDS = ['visa', 'mastercard', 'american-express', 'discover'];
const REDIRECTS = ['paypal', 'klarna', 'ideal', 'afterpay', 'affirm', 'link'];
const iconOf = (code: string) => (code === 'card_token' ? CARD_BRANDS : [code.replace(/_/g, '-')]);
const paymentIcon = (name: string) => h('span', `payment-icon payment-icon-${name}`);
const DETAILS = ['email', 'first_name', 'last_name', 'line1', 'city', 'country'];
const ADDRESS = ['line1', 'line2', 'city', 'state', 'postcode'];
const TEST_DETAILS: Record<string, string> = {
  email: 'test@example.com',
  first_name: 'Test',
  last_name: 'Shopper',
  phone_number: '2015550123',
  line1: '1 Test Street',
  city: 'Austin',
  state: 'TX',
  postcode: '78701',
};

const label = (name: string) => name.replace(/^billing_/, '').replace(/_/g, ' ');

type Tone = 'done' | 'todo' | 'bad' | 'warn';
const MARKS = { done: 'check', todo: 'wait', bad: 'fail', warn: 'warn' } as const;

export function checkoutView(
  engine: Engine,
  cart: ReturnType<typeof cartView>,
  ui: { render: () => void; paymentIcons: () => void },
) {
  const button = (text: string, onclick: () => void) =>
    tsugi(h('button', { type: 'button', className: 'btn', onclick }, text), { variant: 'outline', size: 'sm' });

  const fill = () => {
    const actions = engine.checkout!;
    if (engine.getState().checkout?.countries.some((c) => c.code === 'US')) actions.setField('country', 'US');
    for (const [name, value] of Object.entries(TEST_DETAILS)) actions.setField(name, value);
    for (const name of Object.keys(TEST_DETAILS)) void actions.leave(name);
    ui.render();
  };

  const check = () => {
    engine.checkout!.validate('all');
    ui.render();
  };

  const problem = (error: CheckoutError | undefined) =>
    error && badge(PROBLEMS[error.code] ?? error.code, error.warning ? 'warning' : 'destructive');

  const rows = (pairs: Array<[string, Child, CheckoutError?]>) =>
    h(
      'dl',
      'krows',
      ...pairs.flatMap(([name, value, error]) => [h('dt', {}, name), h('dd', {}, value || '—', problem(error))]),
    );

  const block = (title: string, description: string, ...children: Child[]) =>
    h('div', 'block', h('div', 'bhead', h('div', {}, h('h4', {}, title), h('p', {}, description))), ...children);

  const step = (title: string, detail: string, tone: Tone) =>
    h('div', `kstep ${tone}`, icon(MARKS[tone]), h('b', {}, title), h('small', {}, detail));

  const steps = (state: CheckoutState) => {
    const { campaign, cart: basket } = engine.getState();
    const units = engine.cart.lines().reduce((n, l) => n + l.quantity, 0);
    const fieldErrors = Object.entries(state.errors).filter(([name]) => name !== 'form');
    const missing = DETAILS.filter((name) => !state.fields[name]?.trim());
    const method = state.paymentMethod;
    const cardReady = !!document.getElementById('spreedly-number') && !!campaign?.payment_env_key;
    const country = state.fields.country ?? '';
    const shipping =
      basket.summary?.shipping_method?.name ??
      campaign?.shipping_methods.find((m) => m.ref_id === basket.shippingId)?.code;
    const form = state.errors.form;
    return [
      units
        ? step('Cart', `${units} item${units === 1 ? '' : 's'}`, 'done')
        : step('Cart', 'Empty: an order needs at least one line', 'bad'),
      fieldErrors.length
        ? step(
            'Details',
            fieldErrors.map(([name, error]) => `${label(name)}: ${PROBLEMS[error.code] ?? error.code}`).join(', '),
            fieldErrors.every(([, error]) => error.warning) ? 'warn' : 'bad',
          )
        : missing.length
          ? step('Details', `Not filled in yet: ${missing.map(label).join(', ')}`, 'todo')
          : step('Details', 'Contact and shipping filled in', 'done'),
      shipping ? step('Shipping', shipping, 'done') : step('Shipping', 'No method yet', 'todo'),
      method !== 'card_token'
        ? step('Payment', METHODS[method] ?? method, 'done')
        : cardReady
          ? step('Payment', 'Card fields ready', 'done')
          : step('Payment', "Card needs cc-number and cvv fields and the campaign's payment_env_key", 'bad'),
      state.prospectSaved
        ? step('Prospect', 'Saved: abandoned-cart emails can go out', 'done')
        : step('Prospect', 'Saved once the email is filled in', 'todo'),
      state.rulesDown
        ? step('Address rules', 'Service down: fields fall back to basic checks', 'warn')
        : state.rules[country]
          ? step('Address rules', `${country} loaded`, 'done')
          : step('Address rules', 'Load with the country', 'todo'),
      form
        ? step('Order', `Refused: ${form.message ?? form.code}${form.decline ? ` (${form.decline})` : ''}`, 'bad')
        : state.status === 'placing'
          ? step('Order', 'Placing…', 'todo')
          : state.pendingRef
            ? step('Order', `Waiting for the payment to complete for ${state.pendingRef}`, 'todo')
            : state.status === 'placed'
              ? step('Order', 'Placed', 'done')
              : step('Order', 'Not placed yet', 'todo'),
    ];
  };

  const address = (state: CheckoutState, prefix: '' | 'billing_') => {
    const country = state.fields[`${prefix}country`];
    const name = state.countries.find((c) => c.code === country)?.name;
    return rows([
      ['Country', country && `${name ?? country} (${country})`, state.errors[`${prefix}country`]],
      ...ADDRESS.map((field): [string, Child, CheckoutError?] => [
        label(field),
        state.fields[prefix + field],
        state.errors[prefix + field],
      ]),
    ]);
  };

  const payment = (state: CheckoutState) => {
    ui.paymentIcons();
    const { campaign } = engine.getState();
    const express = campaign?.available_express_payment_methods ?? [];
    const methods = (campaign?.available_payment_methods ?? []).map((m) => {
      const code = m.code === 'bankcard' ? 'card_token' : m.code;
      return { code, label: METHODS[code] ?? m.label };
    });
    const onPage = (code: string) =>
      code === 'card_token' ||
      [...document.querySelectorAll('[data-next-payment-method]')].some(
        (el) => el.getAttribute('data-next-payment-method')?.replace(/-/g, '_') === code,
      );
    const cardFields = !!document.getElementById('spreedly-number');
    const panel = (code: string, name: string) =>
      code === 'card_token'
        ? rows([
            [
              'Card fields',
              cardFields
                ? 'Ready: the number and CVV are Spreedly fields'
                : 'Missing: no cc-number and cvv fields on this page',
            ],
            ['Payment key', campaign?.payment_env_key ? 'Set' : 'Missing: the card cannot be tokenized'],
          ])
        : h(
            'p',
            'kredirect',
            REDIRECTS.includes(code)
              ? `${name} opens after the order is placed, then sends the shopper back to the next page.`
              : `${name} pays with the order.`,
          );
    return block(
      'Payment',
      'How the shopper pays, as this checkout offers it.',
      express.length > 0 &&
        h(
          'div',
          'kpay',
          h('p', 'ksublabel', 'Express checkout'),
          h(
            'div',
            'kexpress',
            ...express.map((m) => {
              const tile = h('span', 'ktile', ...iconOf(m.code).map(paymentIcon));
              tile.title = `${m.label}: its button on the page starts the order`;
              tile.setAttribute('role', 'img');
              tile.setAttribute('aria-label', m.label);
              return tile;
            }),
          ),
          h('div', 'kor', 'OR'),
        ),
      h(
        'div',
        'kpay',
        h('p', 'ksublabel', 'Payment method'),
        h(
          'div',
          'kmethods',
          ...methods.map((m) => {
            const on = m.code === state.paymentMethod;
            const row = h(
              'button',
              {
                type: 'button',
                className: 'kmethod',
                onclick: () => {
                  engine.checkout!.setPaymentMethod(m.code);
                  ui.render();
                },
              },
              h('span', 'kdot'),
              h('b', {}, m.label),
              !onPage(m.code) && badge('not on this page', 'outline'),
              h('span', 'kicons', ...iconOf(m.code).map(paymentIcon)),
            );
            row.setAttribute('role', 'radio');
            row.setAttribute('aria-checked', String(on));
            return h('div', on ? 'kmrow on' : 'kmrow', row, on && h('div', 'kpanel', panel(m.code, m.label)));
          }),
        ),
      ),
    );
  };

  const status = (state: CheckoutState) =>
    state.status === 'placing'
      ? 'placing the order…'
      : state.status === 'placed'
        ? 'order placed'
        : `step ${state.step || 1} · ${Object.keys(state.errors).length ? 'needs fixing' : 'not placed yet'}`;

  const view = (): Child[] => {
    const state = engine.getState().checkout;
    if (!state || !engine.checkout)
      return [
        h('div', 'vhead', h('span', {}, h('b', {}, 'Checkout'), ' · no checkout form on this page')),
        ...cart.view(),
        h('p', 'knote', 'Customer, address and payment show on the page with form[data-next-checkout].'),
      ];
    const phone = state.phones.phone_number;
    return [
      h(
        'div',
        'vhead',
        h('span', {}, h('b', {}, 'Checkout'), ` · ${status(state)}`),
        button('Check form', check),
        button('Fill test details', fill),
      ),
      block('Order', 'What stands between the shopper and the order.', h('div', 'ksteps', ...steps(state))),
      ...cart.view(),
      block(
        'Customer',
        'Who orders and where it goes, as the checkout holds it.',
        rows([
          ['Email', state.fields.email, state.errors.email],
          [
            'Name',
            [state.fields.first_name, state.fields.last_name].filter(Boolean).join(' '),
            state.errors.first_name ?? state.errors.last_name,
          ],
          ['Phone', phone?.international ?? state.fields.phone_number, state.errors.phone_number],
          ['Marketing', state.fields.accepts_marketing === 'false' ? 'No' : 'Yes'],
        ]),
        h('p', 'ksub', 'Ship to'),
        address(state, ''),
        h('p', 'ksub', 'Bill to'),
        state.sameAsShipping ? rows([['Address', 'Same as shipping']]) : address(state, 'billing_'),
      ),
      payment(state),
    ];
  };

  return {
    view,
    summary: () => {
      const state = engine.getState().checkout;
      return state ? status(state) : 'cart only';
    },
  };
}
