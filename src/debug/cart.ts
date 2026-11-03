import type { CartSummary, Discount, SummaryLine } from '../engine/cart/types';
import type { Engine } from '../engine/engine';
import { format } from '../engine/format';
import { badge, type Child, empty, expandable, h, time, tsugi, tsugiCard } from './view';

const source = (group: string) =>
  group === 'items'
    ? 'added'
    : group.startsWith('bundle:')
      ? `bundle "${group.slice(7)}"`
      : group.startsWith('toggle:')
        ? 'toggle'
        : group;

const button = (label: Child, onclick: () => void, data: Record<string, string>, title = '') =>
  tsugi(h('button', { type: 'button', className: 'btn', title, onclick }, label), data);

export function cartView(engine: Engine, ui: { open: Set<string>; render: () => void; showState: () => void }) {
  let message: { text: string; tone: 'green' | 'amber' } | undefined;
  let pricedAt: number | undefined;
  engine.on('cart.calculated', (e) => (pricedAt = e.at), { replay: true });

  const coupon = h('input', { type: 'text', placeholder: 'Coupon code', className: 'input' });
  const shipping = h('select', {
    className: 'select',
    onchange: () => act(engine.cart.setShipping(Number(shipping.value))),
  });
  const pkg = h('select', { className: 'select' });
  const quantity = h('input', { type: 'number', min: '1', value: '1', className: 'input' });

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

  const discount = (d: Discount, codes: Set<string>) => {
    const code = codes.has(d.name ?? '');
    const percent = Math.round(Number(d.percentage));
    const off = percent ? `${percent}% OFF` : `−${money(d.amount)}`;
    const el = badge(code ? `Extra ${off}` : off, code ? 'info' : 'success');
    el.title = d.name ?? '';
    return el;
  };

  const line = (packageId: number, count: number, priced: SummaryLine | undefined, codes: Set<string>) => {
    const p = engine.getPackage(packageId);
    const from = Object.entries(engine.getState().cart.groups)
      .filter(([, g]) => g.lines.some((l) => l.packageId === packageId))
      .map(([id]) => source(id));
    const total = priced ? priced.total : p && Number(p.price_total) * count;
    const before = priced && Number(priced.total_discount) > 0 ? priced.subtotal : undefined;
    const recurring = (priced?.is_recurring ?? p?.is_recurring) && (priced?.price_recurring ?? p?.price_recurring);
    const every =
      p?.interval_count && p.interval_count > 1 ? `${p.interval_count} ${p.interval}s` : (p?.interval ?? 'month');
    const attributes = p?.product_variant_attribute_values ?? [];
    const set = (n: number) => () => act(engine.cart.setQuantity(packageId, n));
    const step = { variant: 'outline', size: 'icon-xs' };
    return tsugiCard(
      'cline',
      !!priced?.discounts.length && h('div', 'cbadges', ...priced.discounts.map((d) => discount(d, codes))),
      h(
        'div',
        'cmain',
        h(
          'div',
          'cthumb',
          p?.image ? h('img', { src: p.image, alt: '' }) : h('span', 'cnoimg'),
          h('span', 'cbubble', String(count)),
        ),
        h(
          'div',
          {},
          h('div', 'cname', p?.name ?? `Package ${packageId}`),
          h(
            'div',
            'cunit',
            `${money(priced?.package_price ?? p?.price_total)} ×`,
            button('−', set(count - 1), step, 'One less'),
            h('span', {}, String(count)),
            button('+', set(count + 1), step, 'One more'),
          ),
          h('div', 'csource', `#${packageId} · from ${from.join(', ')}`),
        ),
        h(
          'div',
          'cprice',
          before && h('s', {}, money(before)),
          h('b', {}, money(total)),
          !priced && h('small', {}, 'estimate'),
        ),
        button('✕', set(0), { variant: 'ghost', size: 'icon-xs' }, 'Remove'),
      ),
      attributes.length > 0 &&
        h(
          'div',
          'cvars',
          ...attributes.map((a) =>
            h(
              'label',
              'cvar',
              a.name,
              h('input', { type: 'text', className: 'input', value: a.value, readOnly: true }),
            ),
          ),
        ),
      recurring && h('div', 'crecur', `Then ${money(String(recurring))} every ${every}`),
    );
  };

  const totals = (s: CartSummary) => {
    const row = (label: Child, value: Child, className = '') =>
      h('div', `trow ${className}`, h('span', {}, label), h('span', {}, value));
    const breakdown = (
      key: string,
      label: string,
      sub: string | undefined,
      value: Child,
      parts: Array<[string, string, boolean]>,
    ) =>
      parts.length
        ? expandable(
            [h('span', {}, label, h('span', 'chev', '⌄'), sub && h('small', {}, sub)), h('span', {}, value)],
            key,
            ui.open,
            () =>
              parts.map(([name, amount, code]) =>
                h(
                  'div',
                  'tpart',
                  h('span', {}, code && badge('code', 'outline'), name),
                  h('span', {}, `−${money(amount)}`),
                ),
              ),
            'tmore',
          )
        : row(h('span', {}, label, sub && h('small', {}, sub)), value);
    const codes = new Set(s.voucher_discounts.map((d) => d.name ?? ''));
    const part = (d: Discount, fallback: string, code: boolean): [string, string, boolean] => [
      d.name || fallback,
      d.amount,
      code,
    ];
    const discounts = [
      ...s.offer_discounts.map((d) => part(d, 'This offer', false)),
      ...s.voucher_discounts.map((d) => part(d, 'Coupon', true)),
    ];
    const ship = s.shipping_method;
    const shipParts = (ship?.discounts ?? []).map((d) => part(d, 'Shipping discount', codes.has(d.name ?? '')));
    return tsugiCard(
      'ctotals',
      row('Subtotal', money(s.subtotal)),
      Number(s.total_discount) > 0 &&
        breakdown('cart-discounts', 'Discounts', undefined, `−${money(s.total_discount)}`, discounts),
      ship &&
        breakdown(
          'cart-shipping',
          'Shipping',
          ship.name,
          h(
            'span',
            {},
            Number(ship.original_price) > Number(ship.price) && h('s', {}, money(ship.original_price)),
            money(ship.price),
          ),
          shipParts,
        ),
      row('Total', money(s.total), 'tgrand'),
    );
  };

  const view = (): Child[] => {
    const { cart, campaign } = engine.getState();
    const lines = engine.cart.lines();
    const units = lines.reduce((n, l) => n + l.quantity, 0);
    const summary = cart.summary;
    const codes = new Set(summary?.voucher_discounts.map((d) => d.name ?? '') ?? []);
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
      ...(lines.length
        ? lines.map((l) =>
            line(
              l.package_id,
              l.quantity,
              summary?.lines.find((s) => s.package_id === l.package_id),
              codes,
            ),
          )
        : [empty('Cart is empty', 'Add a package below, or use the page.', 'cart')]),
      summary && lines.length > 0 && totals(summary),
      tsugiCard(
        'cctl',
        h(
          'div',
          'crow',
          h('span', 'clabel', 'Coupons'),
          ...cart.coupons.map((c) =>
            badge(
              c,
              'success',
              h(
                'button',
                { type: 'button', title: `Remove ${c}`, onclick: () => act(engine.cart.removeCoupon(c)) },
                '✕',
              ),
            ),
          ),
          coupon,
          button('Apply', apply, { variant: 'outline' }),
        ),
        message && h('div', `cmsg ${message.tone}`, message.text),
        methods.length > 0 && h('div', 'crow', h('span', 'clabel', 'Shipping'), shipping),
        h(
          'div',
          'crow',
          h('span', 'clabel', 'Add'),
          pkg,
          quantity,
          button(
            'Add to cart',
            () => act(engine.cart.addItem(Number(pkg.value), Math.max(1, Number(quantity.value) || 1))),
            { variant: 'outline' },
          ),
        ),
      ),
    ];
  };

  return { view };
}
