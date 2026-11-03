import type { CheckoutState } from '../checkout/state/types';
import type { Engine } from '../engine/engine';
import type { CheckoutError } from '../engine/types';
import { writtenAddress } from './address';
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
const iconOf = (code: string) => (code === 'card_token' ? CARD_BRANDS : [code.replace(/_/g, '-')]);
const paymentIcon = (name: string) => h('span', `payment-icon payment-icon-${name}`);
const CONTACT = ['email', 'phone_number'];
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

const LABELS: Record<string, string> = {
  email: 'Email',
  first_name: 'First name',
  last_name: 'Last name',
  line1: 'Address',
  line2: 'Apartment, suite',
  city: 'City',
  state: 'State',
  postcode: 'Postcode',
  country: 'Country',
  phone_number: 'Phone',
};

const label = (state: CheckoutState, name: string) => {
  const field = name.replace(/^billing_/, '');
  const country = name.startsWith('billing_') ? state.fields.billing_country : state.fields.country;
  return state.rules[country ?? '']?.fields[field]?.label ?? LABELS[field] ?? field.replace(/_/g, ' ');
};

type Tone = 'done' | 'todo' | 'bad' | 'warn';
const MARKS = { done: 'check', todo: 'wait', bad: 'fail', warn: 'warn' } as const;

export function checkoutView(
  engine: Engine,
  cart: ReturnType<typeof cartView>,
  ui: { render: () => void; paymentIcons: () => void },
) {
  let cardEntered = false;
  engine.on('checkout.payment-added', (e) => (cardEntered ||= e.data.method === 'card_token'), { replay: true });

  const cardSetup = () =>
    !document.getElementById('spreedly-number')
      ? 'no cc-number and cvv fields on the page'
      : !engine.getState().campaign?.payment_env_key
        ? 'no payment_env_key on the campaign'
        : undefined;

  const refusal = (form: CheckoutError) => `${form.message ?? form.code}${form.decline ? ` (${form.decline})` : ''}`;

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

  const block = (title: string, description: Child, ...children: Child[]) =>
    h('div', 'block', h('div', 'bhead', h('div', {}, h('h4', {}, title), h('p', {}, description))), ...children);

  interface Step {
    title: string;
    detail: Child;
    tone: Tone;
  }

  const payment = (state: CheckoutState): Step => {
    ui.paymentIcons();
    const { campaign } = engine.getState();
    const method = state.paymentMethod;
    const offered = campaign?.available_payment_methods?.find(
      (m) => (m.code === 'bankcard' ? 'card_token' : m.code) === method,
    );
    const name = METHODS[method] ?? offered?.label ?? method;
    const icons = h('span', 'kicons', ...iconOf(method).map(paymentIcon));
    if (method !== 'card_token') return { title: 'Payment', detail: h('span', {}, icons, name), tone: 'done' };
    const broken = cardSetup();
    const detail = broken ?? (cardEntered ? 'card details entered' : 'card details not entered yet');
    return {
      title: 'Payment',
      detail: h('span', {}, icons, `${name} · ${detail}`),
      tone: broken ? 'bad' : cardEntered ? 'done' : 'todo',
    };
  };

  const details = (state: CheckoutState, errors: Array<[string, CheckoutError]>, missing: string[]): Step => {
    const said = (list: Array<[string, CheckoutError]>) =>
      list.map(([name, error]) => `${label(state, name)}: ${PROBLEMS[error.code] ?? error.code}`);
    const hard = errors.filter(([, error]) => !error.warning);
    const warnings = said(errors.filter(([, error]) => error.warning));
    const blank = missing.length ? [`Not filled in yet: ${missing.map((name) => label(state, name)).join(', ')}`] : [];
    const tone: Tone = hard.length ? 'bad' : missing.length ? 'todo' : warnings.length ? 'warn' : 'done';
    const detail = [...said(hard), ...blank, ...warnings].join(' · ');
    return { title: 'Details', detail: detail || 'Contact and shipping filled in', tone };
  };

  const steps = (state: CheckoutState): Step[] => {
    const { campaign, cart: basket } = engine.getState();
    const units = engine.cart.lines().reduce((n, l) => n + l.quantity, 0);
    const shown = Object.entries(state.errors).filter(([name]) => name !== 'form');
    const checked = Object.entries(engine.checkout!.problems()).filter(([name]) => !state.errors[name]);
    const empty = (code: string) => code === 'blank' || code === 'not_selected';
    const missing = checked.filter(([, code]) => empty(code)).map(([name]) => name);
    const fieldErrors = [
      ...shown,
      ...checked.filter(([, code]) => !empty(code)).map(([name, code]): [string, CheckoutError] => [name, { code }]),
    ];
    const shipping =
      basket.summary?.shipping_method?.name ??
      campaign?.shipping_methods.find((m) => m.ref_id === basket.shippingId)?.code;
    const form = state.errors.form;
    const order: Step = form
      ? {
          title: 'Order',
          detail: `Refused: ${refusal(form)}`,
          tone: 'bad',
        }
      : state.status === 'placing'
        ? { title: 'Order', detail: 'Placing…', tone: 'todo' }
        : state.pendingRef
          ? { title: 'Order', detail: `Waiting for the payment to complete for ${state.pendingRef}`, tone: 'todo' }
          : state.status === 'placed'
            ? { title: 'Order', detail: 'Placed', tone: 'done' }
            : { title: 'Order', detail: 'Not placed yet', tone: 'todo' };
    return [
      units
        ? { title: 'Cart', detail: `${units} item${units === 1 ? '' : 's'}`, tone: 'done' }
        : { title: 'Cart', detail: 'Empty: an order needs at least one line', tone: 'bad' },
      details(state, fieldErrors, missing),
      shipping
        ? { title: 'Shipping', detail: shipping, tone: 'done' }
        : { title: 'Shipping', detail: 'No method yet', tone: 'todo' },
      payment(state),
      ...(state.rulesDown
        ? [{ title: 'Address rules', detail: 'Service down: fields fall back to basic checks', tone: 'warn' } as Step]
        : []),
      order,
    ];
  };

  const verdict = (state: CheckoutState, all: Step[]) => {
    const needed = all.filter((s) => ['Cart', 'Details', 'Shipping', 'Payment', 'Order'].includes(s.title));
    const bad = needed.filter((s) => s.tone === 'bad').map((s) => s.title.toLowerCase());
    const todo = needed.filter((s) => s.tone === 'todo' && s.title !== 'Order').map((s) => s.title.toLowerCase());
    if (state.status === 'placed') return h('span', 'green', 'Placed');
    if (bad.length) return h('span', 'red', `Blocked: ${bad.join(', ')}`);
    if (todo.length) return h('span', 'amber', `Not ready yet: ${todo.join(', ')}`);
    return h('span', 'green', 'Ready: nothing stops the order');
  };

  const address = (state: CheckoutState, prefix: '' | 'billing_', title: string) => {
    const errors = Object.entries(state.errors).filter(
      ([name]) =>
        name.startsWith(prefix) &&
        !CONTACT.includes(name) &&
        name !== 'form' &&
        (prefix || !name.startsWith('billing_')),
    );
    const lines = writtenAddress(state, prefix);
    return h(
      'div',
      'kaddr',
      h('p', 'ksub', title),
      lines.length
        ? h('address', {}, ...lines.flatMap((line, i) => (i ? [h('br'), line] : [line])))
        : h('p', 'dim', 'Not filled in yet'),
      errors.length > 0 &&
        h(
          'div',
          'kerrs',
          ...errors.map(([name, error]) =>
            badge(
              `${label(state, name)}: ${PROBLEMS[error.code] ?? error.code}`,
              error.warning ? 'warning' : 'destructive',
            ),
          ),
        ),
    );
  };

  const status = (state: CheckoutState) =>
    state.status === 'placing'
      ? 'placing the order…'
      : state.status === 'placed'
        ? 'order placed'
        : `step ${state.step || 1}`;

  const view = (): Child[] => {
    const state = engine.getState().checkout;
    if (!state || !engine.checkout)
      return [
        h('div', 'vhead', h('span', {}, h('b', {}, 'Checkout'), ' · no checkout form on this page')),
        ...cart.view(),
        h('p', 'knote', 'Customer, address and payment show on the page with form[data-next-checkout].'),
      ];
    const phone = state.phones.phone_number;
    const all = steps(state);
    return [
      h(
        'div',
        'vhead',
        h('span', {}, h('b', {}, 'Checkout'), ` · ${status(state)}`),
        button('Check form', check),
        button('Fill test details', fill),
      ),
      block(
        'Order',
        verdict(state, all),
        h(
          'div',
          'ksteps',
          ...all.map((s) =>
            h('div', `kstep ${s.tone}`, icon(MARKS[s.tone]), h('b', {}, s.title), h('small', {}, s.detail)),
          ),
        ),
      ),
      ...cart.view(),
      block(
        'Customer',
        'Who orders and where it goes, written as the country writes an address.',
        rows([
          ['Email', state.fields.email, state.errors.email],
          ['Phone', phone?.international ?? state.fields.phone_number, state.errors.phone_number],
          ['Marketing', state.fields.accepts_marketing === 'false' ? 'Declined' : 'Accepted'],
          [
            'Open cart',
            state.prospectSaved
              ? 'Saved: it is in Open Carts on the dashboard, for abandoned-cart emails'
              : 'Not saved yet: needs a valid email and a first and last name',
          ],
        ]),
        h(
          'div',
          'kaddrs',
          address(state, '', 'Ship to'),
          state.sameAsShipping
            ? h('div', 'kaddr', h('p', 'ksub', 'Bill to'), h('p', {}, 'Same as shipping'))
            : address(state, 'billing_', 'Bill to'),
        ),
      ),
    ];
  };

  return {
    view,
    problems: (): Array<{ text: string; error: boolean }> => {
      const state = engine.getState().checkout;
      if (!state || !engine.checkout) return [];
      const broken = state.paymentMethod === 'card_token' && cardSetup();
      const form = state.errors.form;
      return [
        ...(broken ? [{ text: `Payment: ${broken}`, error: true }] : []),
        ...(state.rulesDown
          ? [{ text: 'Address rules: service down, fields fall back to basic checks', error: false }]
          : []),
        ...(form ? [{ text: `Order refused: ${refusal(form)}`, error: false }] : []),
      ];
    },
    summary: () => {
      const state = engine.getState().checkout;
      return state ? status(state) : 'cart only';
    },
  };
}
