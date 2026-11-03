import type { CartSummary, SummaryLine } from '../engine/cart/types';
import type { Engine } from '../engine/engine';
import { format } from '../engine/format';
import { type Child, empty, h, time } from './view';

const source = (group: string) =>
  group === 'items'
    ? 'added'
    : group.startsWith('bundle:')
      ? `bundle "${group.slice(7)}"`
      : group.startsWith('toggle:')
        ? 'toggle'
        : group;

export function cartView(engine: Engine, ui: { render: () => void; showState: () => void }) {
  let message: { text: string; tone: 'green' | 'amber' } | undefined;
  let pricedAt: number | undefined;
  engine.on('cart.calculated', (e) => (pricedAt = e.at), { replay: true });

  const coupon = h('input', { type: 'text', placeholder: 'Coupon code', className: 'cin' });
  const shipping = h('select', { onchange: () => act(engine.cart.setShipping(Number(shipping.value))) });
  const pkg = h('select');
  const quantity = h('input', { type: 'number', min: '1', value: '1', className: 'cqty' });

  const money = (amount: string | number | undefined) => {
    const { campaign, cart } = engine.getState();
    const value = amount === undefined ? undefined : Number(amount);
    return format({ type: 'money', value }, cart.summary?.currency ?? campaign?.currency, campaign?.language);
  };

  const act = (work: Promise<unknown>, done?: (result: unknown) => void) => {
    message = undefined;
    void work.then((result) => {
      done?.(result);
      ui.render();
    });
  };

  const apply = () => {
    const code = coupon.value.trim().toUpperCase();
    if (!code) return;
    act(engine.cart.applyCoupon(code), (ok) => {
      message = ok
        ? { text: `${code} applied`, tone: 'green' }
        : { text: `${code} not applied: the server gives no discount for it`, tone: 'amber' };
      if (ok) coupon.value = '';
    });
  };
  coupon.onkeydown = (e) => e.key === 'Enter' && apply();

  const line = (packageId: number, count: number, priced?: SummaryLine) => {
    const p = engine.getPackage(packageId);
    const from = Object.entries(engine.getState().cart.groups)
      .filter(([, g]) => g.lines.some((l) => l.packageId === packageId))
      .map(([id]) => source(id));
    const total = priced ? priced.total : p && Number(p.price_total) * count;
    const before = priced && Number(priced.total_discount) > 0 ? priced.subtotal : undefined;
    const set = (n: number) => () => act(engine.cart.setQuantity(packageId, n));
    return h(
      'div',
      'cline',
      p?.image ? h('img', { src: p.image, alt: '' }) : h('span', 'noimg'),
      h(
        'div',
        {},
        h('div', 'cname', p?.name ?? `Package ${packageId}`),
        h(
          'div',
          'cmeta',
          `#${packageId} · ${money(priced?.package_price ?? p?.price_total)} each · from ${from.join(', ')}`,
        ),
        h(
          'span',
          'qty',
          h('button', { type: 'button', title: 'One less', onclick: set(count - 1) }, '−'),
          h('span', {}, String(count)),
          h('button', { type: 'button', title: 'One more', onclick: set(count + 1) }, '+'),
          h('button', { type: 'button', className: 'remove', title: 'Remove', onclick: set(0) }, '✕'),
        ),
      ),
      h('div', 'cprice', before && h('s', {}, money(before)), money(total), !priced && h('small', {}, 'estimate')),
    );
  };

  const totals = (s: CartSummary) => {
    const row = (label: string, value: string, className = '') =>
      h('div', `trow ${className}`, h('span', {}, label), h('span', {}, value));
    return h(
      'div',
      'totals',
      row('Subtotal', money(s.subtotal)),
      ...s.offer_discounts.map((d) =>
        row(`Offer: ${d.name ?? d.description ?? 'discount'}`, `−${money(d.amount)}`, 'disc'),
      ),
      ...s.voucher_discounts.map((d) => row(`Coupon: ${d.name ?? 'code'}`, `−${money(d.amount)}`, 'disc')),
      row(`Shipping${s.shipping_method ? `: ${s.shipping_method.name}` : ''}`, money(s.shipping_method?.price ?? 0)),
      row('Total', money(s.total), 'grand'),
    );
  };

  const view = (): Child[] => {
    const { cart, campaign } = engine.getState();
    const lines = engine.cart.lines();
    const units = lines.reduce((n, l) => n + l.quantity, 0);
    const summary = cart.summary;
    const status = cart.frozen
      ? 'frozen after the order'
      : cart.calculating
        ? 'pricing…'
        : summary && lines.length
          ? `priced${pricedAt ? ` at ${time(pricedAt).slice(0, 8)}` : ''}`
          : lines.length
            ? 'not priced yet'
            : '';

    const methods = campaign?.shipping_methods ?? [];
    shipping.replaceChildren(
      ...methods.map((m) => h('option', { value: String(m.ref_id) }, `${m.code} · ${money(m.price)}`)),
    );
    shipping.value = String(cart.shippingId ?? summary?.shipping_method?.id ?? methods[0]?.ref_id ?? '');
    const chosen = pkg.value;
    pkg.replaceChildren(
      ...(campaign?.packages ?? []).map((p) =>
        h('option', { value: String(p.ref_id) }, `#${p.ref_id} · ${p.name} · ${money(p.price_total)}`),
      ),
    );
    if (chosen) pkg.value = chosen;

    return [
      h(
        'div',
        'chead',
        h(
          'span',
          {},
          h('b', {}, `${units} item${units === 1 ? '' : 's'}`),
          summary && lines.length ? ` · ${money(summary.total)}` : '',
          status && ` · ${status}`,
        ),
        h('button', { type: 'button', className: 'link', onclick: ui.showState }, 'Raw state'),
        lines.length > 0 &&
          h(
            'button',
            { type: 'button', className: 'link danger', onclick: () => act(engine.cart.clear()) },
            'Clear cart',
          ),
      ),
      lines.length
        ? h(
            'div',
            'lines',
            ...lines.map((l) =>
              line(
                l.package_id,
                l.quantity,
                summary?.lines.find((s) => s.package_id === l.package_id),
              ),
            ),
          )
        : empty('Cart is empty', 'Add a package below, or use the page.'),
      summary && lines.length > 0 && totals(summary),
      h(
        'div',
        'crow',
        h('span', 'clabel', 'Coupons'),
        ...cart.coupons.map((c) =>
          h(
            'span',
            'coupon',
            c,
            h(
              'button',
              { type: 'button', title: `Remove ${c}`, onclick: () => act(engine.cart.removeCoupon(c)) },
              ' ✕',
            ),
          ),
        ),
        coupon,
        h('button', { type: 'button', className: 'btn', onclick: apply }, 'Apply'),
      ),
      message && h('div', `cmsg ${message.tone}`, message.text),
      methods.length > 0 && h('div', 'crow', h('span', 'clabel', 'Shipping'), shipping),
      h(
        'div',
        'crow',
        h('span', 'clabel', 'Add'),
        pkg,
        quantity,
        h(
          'button',
          {
            type: 'button',
            className: 'btn',
            onclick: () => act(engine.cart.addItem(Number(pkg.value), Math.max(1, Number(quantity.value) || 1))),
          },
          'Add to cart',
        ),
      ),
    ];
  };

  return { view };
}
