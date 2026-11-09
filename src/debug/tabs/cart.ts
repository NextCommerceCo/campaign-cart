import { unitsOf } from '../../engine/cart/public';
import type { CartSummary, Line, SummaryDiscount } from '../../engine/cart/types';
import type { Engine } from '../../engine/engine';
import { cents } from '../../engine/display/format';
import { type Cart, cartLine, discountName, lower, type Money } from './cart-line';
import { icon } from '../ui/icons';
import { productPicker } from '../ui/picker';
import {
  badge,
  blockHead,
  button,
  type Child,
  clock,
  h,
  link,
  plural,
  priceText,
  type Row,
  rows,
  tsugi,
} from '../ui/view';

const offerOf = (d: SummaryDiscount) => `${d.offer_id}:${d.name ?? ''}`;

const itemDiscounts = (s: CartSummary) => {
  const onShipping = new Set((s.shipping_method?.discounts ?? []).map(offerOf));
  return [...s.offer_discounts, ...s.voucher_discounts].filter((d) => !onShipping.has(offerOf(d)));
};

function totals(money: Money, s: CartSummary) {
  const ship = s.shipping_method;
  const codes = new Set(s.voucher_discounts.map((d) => d.name ?? ''));
  const shipping = ship
    ? h(
        'span',
        {},
        lower(ship.original_price, ship.price) && h('s', {}, money(ship.original_price)),
        Number(ship.price) ? money(ship.price) : 'Free',
      )
    : '—';
  return rows(
    'ctot',
    [
      ['Subtotal', money(s.subtotal)],
      ...itemDiscounts(s).map((d): Row => [
        h('span', {}, codes.has(d.name ?? '') && badge('code', 'outline'), discountName(d)),
        `−${money(d.amount)}`,
        'green',
      ]),
      [`Shipping${ship?.name ? ` (${ship.name})` : ''}`, shipping],
      ...(ship?.discounts ?? []).map((d): Row => [discountName(d), `−${money(d.amount)}`, 'green small']),
    ],
    true,
  );
}

/** The total, and whether the server's adds up, in cents: `subtotal − item discounts + shipping`. */
function total(money: Money, s: CartSummary) {
  const subtotal = cents(s.subtotal);
  const off = itemDiscounts(s).reduce((n, d) => n + cents(d.amount), 0);
  const ship = cents(s.shipping_method?.price);
  const expected = subtotal - off + ship;
  const addsUp = expected === cents(s.total);
  const math = [subtotal, ' − ', off, ' + ', ship, ' = ', expected]
    .map((part) => (typeof part === 'number' ? (part / 100).toFixed(2) : part))
    .join('');
  const check = h(
    'small',
    addsUp ? 'cmath devonly' : 'cmath red',
    addsUp ? `${math} ✓` : `${math} ≠ ${s.total}: the server's total does not add up`,
  );
  check.title = 'Subtotal − item discounts + shipping = total';
  return h('div', 'cfoot', h('span', {}, 'Total'), h('b', {}, money(s.total)), check);
}

function cartStatus(engine: Engine, lines: Line[], summary: CartSummary | undefined) {
  const { cart } = engine.getState();
  return cart.frozen
    ? 'frozen after the order'
    : cart.calculating
      ? 'pricing…'
      : summary
        ? 'priced'
        : lines.length
          ? 'not priced yet'
          : '';
}

function cartHead(c: Cart, lines: Line[], status: string, pricedAt: number | undefined) {
  return blockHead(
    'Cart',
    [
      lines.length ? `${plural(lines.length, 'package')} · ${plural(unitsOf(lines), 'unit')}` : 'Empty',
      status && ` · ${status}`,
      status === 'priced' && !!pricedAt && h('span', 'devonly', ` at ${clock(pricedAt)}`),
    ],
    h(
      'div',
      'bact',
      link('Raw state', c.ui.showState, 'link devonly'),
      lines.length > 0 && link('Clear cart', () => c.act(c.engine.cart.clear()), 'link danger'),
    ),
  );
}

function cartLines(c: Cart, lines: Line[], summary: CartSummary | undefined) {
  const packages = c.engine.getState().campaign?.packages.length ?? 0;
  if (!lines.length)
    return h(
      'div',
      'cempty',
      icon('cart'),
      h('b', {}, 'The cart is empty'),
      h('small', {}, `Pick from ${packages} packages, or use the page.`),
      tsugi(h('button', { type: 'button', className: 'btn', onclick: c.openPicker }, icon('plus'), 'Add packages'), {
        size: 'sm',
      }),
    );
  const codes = new Set(summary?.voucher_discounts.map((d) => d.name ?? '') ?? []);
  return h(
    'div',
    'ctable',
    h('div', 'cth', h('span', {}, 'Package'), h('span', {}, 'Qty'), h('span', {}, 'Total'), h('span')),
    ...lines.map((l) =>
      cartLine(
        c,
        l,
        summary?.lines.find((s) => s.package_id === l.package_id),
        codes,
      ),
    ),
    h(
      'div',
      'cadd',
      link([icon('plus'), 'Add or change packages'], c.openPicker),
      h('small', {}, `${packages} available`),
    ),
  );
}

function vouchers(c: Cart) {
  const { coupons } = c.engine.getState().cart;
  return h(
    'div',
    'cfield',
    h('label', { htmlFor: 'cart-coupon' }, 'Vouchers'),
    h('div', 'cvoucher', c.coupon, button('Apply', c.apply, { variant: 'outline' })),
    coupons.length > 0 &&
      h(
        'div',
        'ccodes',
        ...coupons.map((code) =>
          badge(
            code,
            'secondary',
            h(
              'button',
              { type: 'button', title: `Remove ${code}`, onclick: () => c.act(c.engine.cart.removeCoupon(code)) },
              '✕',
            ),
          ),
        ),
      ),
    c.message && h('p', `cmsg ${c.message.tone}`, c.message.text),
  );
}

function shippingField(c: Cart, select: HTMLSelectElement) {
  const { cart, campaign } = c.engine.getState();
  const methods = campaign?.shipping_methods ?? [];
  select.replaceChildren(
    ...methods.map((m) =>
      h('option', { value: String(m.ref_id) }, `${m.code} · ${Number(m.price) ? c.money(m.price) : 'Free'}`),
    ),
  );
  select.value = String(cart.shippingId ?? cart.summary?.shipping_method?.id ?? methods[0]?.ref_id ?? '');
  return methods.length > 0 && h('div', 'cfield', h('label', { htmlFor: 'cart-shipping' }, 'Shipping'), select);
}

export function cartView(engine: Engine, ui: Cart['ui']) {
  let pricedAt: number | undefined;
  const priced = engine.on('cart.calculated', (e) => (pricedAt = e.at), { replay: true });
  const picker = productPicker(engine);
  const c: Cart = {
    engine,
    ui,
    money: (amount) => priceText(engine, amount, engine.getState().cart.summary?.currency),
    act: (work, done) => {
      c.message = undefined;
      void work.then((result) => {
        done?.(result);
        ui.render();
      });
    },
    coupon: h('input', { id: 'cart-coupon', type: 'text', placeholder: 'Voucher code', className: 'input' }),
    apply: () => {
      const code = c.coupon.value.trim().toUpperCase();
      if (!code) return;
      c.act(engine.cart.applyCoupon(code), (ok) => {
        c.message = ok
          ? { text: `${code} applied`, tone: 'green' }
          : { text: `${code} not applied: the server gives no discount for it`, tone: 'amber' };
        if (ok) c.coupon.value = '';
      });
    },
    openPicker: () => picker.open(),
  };
  c.coupon.onkeydown = (e) => {
    if (e.key === 'Enter') c.apply();
  };
  const shipping = h('select', {
    id: 'cart-shipping',
    className: 'select',
    onchange: () => c.act(engine.cart.setShipping(Number(shipping.value))),
  });

  const view = (): Child[] => {
    const lines = engine.cart.lines();
    const summary = lines.length ? engine.getState().cart.summary : undefined;
    return [
      h(
        'div',
        'block cart',
        cartHead(c, lines, cartStatus(engine, lines, summary), pricedAt),
        cartLines(c, lines, summary),
        h(
          'div',
          'csplit',
          h('div', 'cform', vouchers(c), shippingField(c, shipping)),
          summary ? totals(c.money, summary) : h('p', 'dim', 'Totals appear once the cart has packages.'),
        ),
        summary && total(c.money, summary),
      ),
    ];
  };

  const stop = () => {
    priced();
    picker.stop();
  };
  return { view, dialog: picker.dialog, stop };
}
