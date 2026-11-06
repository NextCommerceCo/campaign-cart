import { bundleGroup, cardSlots, pickedCard } from '../engine/cart/selectors';
import { variantChoices } from '../engine/cart/variants';
import type { CartSummary, SummaryDiscount, SummaryLine } from '../engine/cart/types';
import type { Engine } from '../engine/engine';
import { format, localeOf } from '../engine/format';
import type { Package } from '../engine/types';
import { icon } from './icons';
import { productPicker, thumb } from './picker';
import { badge, button, type Child, clock, h, iconButton, plural, tsugi } from './view';

const source = (group: string) =>
  group === 'items'
    ? 'added'
    : group.startsWith('bundle:')
      ? `bundle ${group.slice(7)}`
      : group.startsWith('toggle:')
        ? 'toggle'
        : group;

export function swapPackage(engine: Engine, from: number, to: number): Promise<void> {
  const { cart, selectors } = engine.getState();
  const swaps = Object.entries(cart.groups).flatMap(([groupId, group]) => {
    if (!group.lines.some((l) => l.packageId === from)) return [];
    const selectorId = Object.keys(selectors).find((id) => bundleGroup(id) === groupId);
    const selector = selectorId ? selectors[selectorId] : undefined;
    const card = pickedCard(selector);
    const slots =
      selector && card ? cardSlots(selector, card).flatMap((s, i) => (s.packageId === from ? [i] : [])) : [];
    if (!slots.length) {
      const lines = group.lines.map((l) => (l.packageId === from ? { ...l, packageId: to } : l));
      return [engine.cart.setGroup(groupId, { ...group, lines })];
    }
    const written = Promise.all(
      slots.map((i) => engine.selectors.setSlot(selectorId!, card!.id, i, { packageId: to })),
    );
    return [selector!.mode === 'swap' ? written : written.then(() => engine.selectors.addToCart(selectorId!))];
  });
  return Promise.all(swaps).then(() => undefined);
}

const lower = (before: string | undefined, now: string | undefined) =>
  before && now && Number(before) > Number(now) ? before : undefined;

export function cartView(engine: Engine, ui: { open: Set<string>; render: () => void; showState: () => void }) {
  let message: { text: string; tone: 'green' | 'amber' } | undefined;
  let pricedAt: number | undefined;
  engine.on('cart.calculated', (e) => (pricedAt = e.at), { replay: true });

  const coupon = h('input', { id: 'cart-coupon', type: 'text', placeholder: 'Voucher code', className: 'input' });
  const shipping = h('select', {
    id: 'cart-shipping',
    className: 'select',
    onchange: () => act(engine.cart.setShipping(Number(shipping.value))),
  });
  const picker = productPicker(engine);

  const money = (amount: string | number | undefined) => {
    const { campaign, cart } = engine.getState();
    const value = amount === undefined ? undefined : Number(amount);
    return format({ type: 'money', value }, cart.summary?.currency ?? campaign?.currency, localeOf(engine.getState()));
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
  coupon.onkeydown = (e) => {
    if (e.key === 'Enter') void apply();
  };

  const price = (priced: SummaryLine | undefined, p: Package | undefined, count: number) => {
    if (!priced)
      return h(
        'span',
        'cprice',
        h('b', {}, money(p ? Number(p.price_total) * count : undefined)),
        h('small', 'amber', 'estimate'),
      );
    const each: [string | undefined, string, string] | undefined =
      p && p.qty > 1 && priced.unit_price
        ? [lower(priced.original_unit_price, priced.unit_price), priced.unit_price, '/unit']
        : count > 1
          ? [lower(priced.original_package_price, priced.package_price), priced.package_price, '/ea']
          : undefined;
    const before = lower(priced.subtotal, priced.total);
    return h(
      'span',
      'cprice',
      h('span', {}, before && h('s', {}, money(before)), h('b', {}, money(priced.total))),
      each && h('small', {}, each[0] && h('s', {}, money(each[0])), `${money(each[1])}${each[2]}`),
    );
  };

  const variant = (packageId: number, { code, name, value, options }: ReturnType<typeof variantChoices>[number]) => {
    const id = `variant-${packageId}-${code}`;
    const select = h(
      'select',
      { id, className: 'select' },
      ...options.map((o) => h('option', { value: o.value, disabled: !o.packageId }, o.value)),
    );
    select.value = value ?? '';
    select.onchange = () => {
      const to = options.find((o) => o.value === select.value)?.packageId;
      if (to) act(swapPackage(engine, packageId, to));
    };
    return h('div', 'cfield', h('label', { htmlFor: id }, name), select);
  };

  const details = (
    packageId: number,
    p: Package | undefined,
    priced: SummaryLine | undefined,
    from: string[],
    codes: Set<string>,
  ) => {
    const variants = variantChoices(engine.getState().campaign?.packages ?? [], packageId);
    const recurring = (priced?.is_recurring ?? p?.is_recurring) && (priced?.price_recurring ?? p?.price_recurring);
    const every =
      p?.interval_count && p.interval_count > 1 ? `${p.interval_count} ${p.interval}s` : (p?.interval ?? 'month');
    const row = (label: string, value: Child, className = '') => [h('dt', {}, label), h('dd', className, value)];
    return h(
      'div',
      'cmore',
      variants.length > 0 && h('div', 'cvars', ...variants.map((v) => variant(packageId, v))),
      h(
        'dl',
        {},
        ...row('Package', `#${packageId}${p?.product_sku ? ` · SKU ${p.product_sku}` : ''}`),
        ...row('From', from.join(', ')),
        ...row('Price', priced ? `${priced.quantity} × ${money(priced.package_price)}` : 'not priced yet'),
        ...(priced?.discounts ?? []).flatMap((d) =>
          row(
            codes.has(d.name ?? '') ? `Code ${d.name}` : d.name || `Offer #${d.offer_id}`,
            `−${money(d.amount)}`,
            'green',
          ),
        ),
        ...(recurring ? row('Then', `${money(String(recurring))} every ${every}`) : []),
      ),
    );
  };

  const line = (packageId: number, count: number, priced: SummaryLine | undefined, codes: Set<string>) => {
    const p = engine.getPackage(packageId);
    const from = Object.entries(engine.getState().cart.groups)
      .filter(([, g]) => g.lines.some((l) => l.packageId === packageId))
      .map(([id]) => source(id));
    const key = `line-${packageId}`;
    const open = ui.open.has(key);
    const name = p?.name ?? `Package ${packageId}`;
    const set = (n: number) => () => act(engine.cart.setQuantity(packageId, n));
    const toggle = h(
      'button',
      {
        type: 'button',
        className: 'cname',
        onclick: () => {
          if (open) ui.open.delete(key);
          else ui.open.add(key);
          ui.render();
        },
      },
      h('span', {}, name),
      icon('chevron'),
    );
    toggle.setAttribute('aria-expanded', String(open));
    const values = (p?.product_variant_attribute_values ?? []).map((a) => a.value).join(' / ');
    return h(
      'div',
      open ? 'cline open' : 'cline',
      h(
        'div',
        'cpkg',
        thumb(p?.image),
        h(
          'div',
          'cinfo',
          toggle,
          h(
            'small',
            {},
            h('span', 'devonly', `#${packageId} · `),
            values || h('span', 'devonly', p?.product_sku || 'no SKU'),
            !(from.length === 1 && from[0] === 'added') &&
              h('span', 'devonly', ...from.map((f) => badge(f, 'outline'))),
          ),
        ),
      ),
      h(
        'span',
        'qty',
        h('button', { type: 'button', title: 'One less', onclick: set(count - 1) }, '−'),
        h('span', {}, String(count)),
        h('button', { type: 'button', title: 'One more', onclick: set(count + 1) }, '+'),
      ),
      price(priced, p, count),
      iconButton('close', `Remove ${name}`, set(0)),
      open && details(packageId, p, priced, from, codes),
    );
  };

  const totals = (s: CartSummary) => {
    const ship = s.shipping_method;
    const offerOf = (d: SummaryDiscount) => `${d.offer_id}:${d.name ?? ''}`;
    const onShipping = new Set((ship?.discounts ?? []).map(offerOf));
    const discounts = [...s.offer_discounts, ...s.voucher_discounts].filter((d) => !onShipping.has(offerOf(d)));
    const codes = new Set(s.voucher_discounts.map((d) => d.name ?? ''));
    const row = (label: Child, value: Child, className = '') => [h('dt', className, label), h('dd', className, value)];
    return h(
      'dl',
      'ctot',
      ...row('Subtotal', money(s.subtotal)),
      ...discounts.flatMap((d) =>
        row(
          h('span', {}, codes.has(d.name ?? '') && badge('code', 'outline'), d.name || `Offer #${d.offer_id}`),
          `−${money(d.amount)}`,
          'green',
        ),
      ),
      ...row(
        `Shipping${ship?.name ? ` (${ship.name})` : ''}`,
        ship
          ? h(
              'span',
              {},
              lower(ship.original_price, ship.price) && h('s', {}, money(ship.original_price)),
              Number(ship.price) ? money(ship.price) : 'Free',
            )
          : '—',
      ),
      ...(ship?.discounts ?? []).flatMap((d) =>
        row(d.name || `Offer #${d.offer_id}`, `−${money(d.amount)}`, 'green small'),
      ),
    );
  };

  const total = (s: CartSummary) => {
    const ship = s.shipping_method;
    const offerOf = (d: SummaryDiscount) => `${d.offer_id}:${d.name ?? ''}`;
    const onShipping = new Set((ship?.discounts ?? []).map(offerOf));
    const itemDiscount = [...s.offer_discounts, ...s.voucher_discounts]
      .filter((d) => !onShipping.has(offerOf(d)))
      .reduce((n, d) => n + Number(d.amount), 0);
    const expected = Number(s.subtotal) - itemDiscount + Number(ship?.price ?? 0);
    const addsUp = Math.abs(expected - Number(s.total)) < 0.005;
    const math = `${Number(s.subtotal).toFixed(2)} − ${itemDiscount.toFixed(2)} + ${Number(ship?.price ?? 0).toFixed(2)} = ${expected.toFixed(2)}`;
    const check = h(
      'small',
      addsUp ? 'cmath devonly' : 'cmath red',
      addsUp ? `${math} ✓` : `${math} ≠ ${s.total}: the server's total does not add up`,
    );
    check.title = 'Subtotal − item discounts + shipping = total';
    return h('div', 'cfoot', h('span', {}, 'Total'), h('b', {}, money(s.total)), check);
  };

  const view = (): Child[] => {
    const { cart, campaign } = engine.getState();
    const lines = engine.cart.lines();
    const units = lines.reduce((n, l) => n + l.quantity, 0);
    const summary = lines.length ? cart.summary : undefined;
    const codes = new Set(summary?.voucher_discounts.map((d) => d.name ?? '') ?? []);
    const packages = campaign?.packages.length ?? 0;
    const status = cart.frozen
      ? 'frozen after the order'
      : cart.calculating
        ? 'pricing…'
        : summary
          ? 'priced'
          : lines.length
            ? 'not priced yet'
            : '';
    const methods = campaign?.shipping_methods ?? [];
    shipping.replaceChildren(
      ...methods.map((m) =>
        h('option', { value: String(m.ref_id) }, `${m.code} · ${Number(m.price) ? money(m.price) : 'Free'}`),
      ),
    );
    shipping.value = String(cart.shippingId ?? cart.summary?.shipping_method?.id ?? methods[0]?.ref_id ?? '');
    const add = h(
      'button',
      { type: 'button', className: 'link', onclick: () => picker.open() },
      icon('plus'),
      lines.length ? 'Add or change packages' : 'Add packages',
    );

    return [
      h(
        'div',
        'block cart',
        h(
          'div',
          'bhead',
          h(
            'div',
            {},
            h('h4', {}, 'Cart'),
            h(
              'p',
              {},
              lines.length ? `${plural(lines.length, 'package')} · ${plural(units, 'unit')}` : 'Empty',
              status && ` · ${status}`,
              status === 'priced' && !!pricedAt && h('span', 'devonly', ` at ${clock(pricedAt)}`),
            ),
          ),
          h(
            'div',
            'bact',
            h('button', { type: 'button', className: 'link devonly', onclick: ui.showState }, 'Raw state'),
            lines.length > 0 &&
              h(
                'button',
                { type: 'button', className: 'link danger', onclick: () => act(engine.cart.clear()) },
                'Clear cart',
              ),
          ),
        ),
        lines.length
          ? h(
              'div',
              'ctable',
              h('div', 'cth', h('span', {}, 'Package'), h('span', {}, 'Qty'), h('span', {}, 'Total'), h('span')),
              ...lines.map((l) =>
                line(
                  l.package_id,
                  l.quantity,
                  summary?.lines.find((s) => s.package_id === l.package_id),
                  codes,
                ),
              ),
              h('div', 'cadd', add, h('small', {}, `${packages} available`)),
            )
          : h(
              'div',
              'cempty',
              icon('cart'),
              h('b', {}, 'The cart is empty'),
              h('small', {}, `Pick from ${packages} packages, or use the page.`),
              tsugi(
                h(
                  'button',
                  { type: 'button', className: 'btn', onclick: () => picker.open() },
                  icon('plus'),
                  'Add packages',
                ),
                {
                  size: 'sm',
                },
              ),
            ),
        h(
          'div',
          'csplit',
          h(
            'div',
            'cform',
            h(
              'div',
              'cfield',
              h('label', { htmlFor: 'cart-coupon' }, 'Vouchers'),
              h('div', 'cvoucher', coupon, button('Apply', apply, { variant: 'outline' })),
              cart.coupons.length > 0 &&
                h(
                  'div',
                  'ccodes',
                  ...cart.coupons.map((c) =>
                    badge(
                      c,
                      'secondary',
                      h(
                        'button',
                        { type: 'button', title: `Remove ${c}`, onclick: () => act(engine.cart.removeCoupon(c)) },
                        '✕',
                      ),
                    ),
                  ),
                ),
              message && h('p', `cmsg ${message.tone}`, message.text),
            ),
            methods.length > 0 && h('div', 'cfield', h('label', { htmlFor: 'cart-shipping' }, 'Shipping'), shipping),
          ),
          summary ? totals(summary) : h('p', 'dim', 'Totals appear once the cart has packages.'),
        ),
        summary && total(summary),
      ),
    ];
  };

  return { view, dialog: picker.dialog };
}
