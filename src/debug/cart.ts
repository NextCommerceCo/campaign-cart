import { bundleGroup, cardSlots, pickedCard } from '../engine/cart/selectors';
import type { CartSummary, Discount, SummaryLine } from '../engine/cart/types';
import { variantChoices } from '../engine/cart/variants';
import type { Engine } from '../engine/engine';
import { format } from '../engine/format';
import { avatar, productPicker } from './picker';
import { badge, type Child, empty, expandable, h, hoverCard, time, tsugi } from './view';

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

const button = (label: Child, onclick: () => void, data: Record<string, string>, title = '') =>
  tsugi(h('button', { type: 'button', className: 'btn', title, onclick }, label), data);

export function cartView(engine: Engine, ui: { open: Set<string>; render: () => void; showState: () => void }) {
  let message: { text: string; tone: 'green' | 'amber' } | undefined;
  let pricedAt: number | undefined;
  engine.on('cart.calculated', (e) => (pricedAt = e.at), { replay: true });

  const coupon = h('input', { id: 'cart-coupon', type: 'text', placeholder: 'Coupon code', className: 'input' });
  const shipping = h('select', {
    id: 'cart-shipping',
    className: 'select',
    onchange: () => act(engine.cart.setShipping(Number(shipping.value))),
  });
  const picker = productPicker(engine, ui);
  const addProducts = (data: Record<string, string>) =>
    tsugi(h('button', { type: 'button', className: 'btn', onclick: () => picker.open() }, 'Add products'), data);

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

  const priceDetails = (
    packageId: number,
    count: number,
    priced: SummaryLine | undefined,
    from: string[],
    codes: Set<string>,
  ): Child[] => {
    const p = engine.getPackage(packageId);
    const row = (label: Child, value: Child, className = '') => [h('dt', className, label), h('dd', className, value)];
    const unit = priced?.package_price ?? p?.price_total;
    const was = Number(priced?.original_package_price ?? p?.price_retail_total ?? 0);
    const units = p && p.qty > 1 ? ` (${p.qty} × ${money(priced?.unit_price ?? p.price)})` : '';
    const recurring = (priced?.is_recurring ?? p?.is_recurring) && (priced?.price_recurring ?? p?.price_recurring);
    return [
      h(
        'header',
        {},
        h('b', {}, p?.name ?? `Package ${packageId}`),
        h(
          'small',
          {},
          [`Package #${packageId}`, p?.product_sku && `SKU ${p.product_sku}`, `from ${from.join(', ')}`]
            .filter(Boolean)
            .join(' · '),
        ),
      ),
      h(
        'dl',
        {},
        ...row(`${count} × ${money(unit)}${units}`, money(priced?.subtotal ?? Number(unit) * count)),
        ...(was > Number(unit) ? row('Compare at', h('s', {}, money(was * count)), 'dim') : []),
        ...(priced?.discounts ?? []).flatMap((d) =>
          row(
            h(
              'span',
              {},
              codes.has(d.name ?? '') && badge('code', 'outline'),
              d.name || 'Offer',
              Number(d.percentage) ? ` · ${Math.round(Number(d.percentage))}%` : '',
            ),
            `−${money(d.amount)}`,
            'green',
          ),
        ),
        ...row('Total', money(priced?.total ?? Number(unit) * count), 'htotal'),
        ...(recurring ? row('Then', `${money(String(recurring))} every ${p?.interval ?? 'month'}`, 'dim') : []),
      ),
      !priced && h('p', 'amber', 'Estimated from campaign prices: the server has not priced this line yet.'),
    ];
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
    const set = (n: number) => () => act(engine.cart.setQuantity(packageId, n));
    const step = { variant: 'outline', size: 'icon-xs' };
    const variant = ({ code, name, value, options }: ReturnType<typeof variantChoices>[number]) => {
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
      return h('div', 'field', h('label', { htmlFor: id }, name), select);
    };
    const variants = variantChoices(engine.getState().campaign?.packages ?? [], packageId);
    return h(
      'div',
      'cline',
      !!priced?.discounts.length && h('div', 'cbadges', ...priced.discounts.map((d) => discount(d, codes))),
      hoverCard(
        h(
          'div',
          'cmain',
          avatar(p?.image, count),
          h(
            'div',
            'cinfo',
            h(
              'div',
              'cname',
              h('b', { title: `Package #${packageId}` }, p?.name ?? `Package ${packageId}`),
              ...(from.length === 1 && from[0] === 'added' ? [] : from.map((f) => badge(f, 'outline'))),
            ),
            h(
              'div',
              'cunit',
              `${money(priced?.package_price ?? p?.price_total)} ×`,
              h(
                'span',
                'cstep',
                button('−', set(count - 1), step, 'One less'),
                h('span', {}, String(count)),
                button('+', set(count + 1), step, 'One more'),
              ),
            ),
          ),
          h(
            'div',
            'cprice',
            before && h('s', {}, money(before)),
            h('b', {}, money(total)),
            !priced && h('small', {}, 'estimate'),
            button('Remove', set(0), { variant: 'link', size: 'sm' }),
          ),
        ),
        () => priceDetails(packageId, count, priced, from, codes),
      ),
      variants.length > 0 && h('div', 'cvars', ...variants.map(variant)),
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
    return h(
      'div',
      'ctotals',
      h(
        'div',
        'tlist',
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
        lines.length > 0 && addProducts({ variant: 'outline', size: 'sm' }),
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
        : [emptyCart()]),
      h(
        'div',
        'cctl',
        h(
          'div',
          'field',
          h('label', { htmlFor: 'cart-coupon' }, 'Coupon'),
          h('div', 'crow', coupon, button('Apply', apply, { variant: 'outline' })),
          cart.coupons.length > 0 &&
            h(
              'div',
              'crow',
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
            ),
          message && h('p', `cmsg ${message.tone}`, message.text),
        ),
        methods.length > 0 && h('div', 'field', h('label', { htmlFor: 'cart-shipping' }, 'Shipping'), shipping),
      ),
      summary && lines.length > 0 && totals(summary),
    ];
  };

  const emptyCart = () => {
    const el = empty('Cart is empty', 'Pick packages from the campaign, or use the page.', 'cart');
    el.append(h('footer', {}, addProducts({})));
    return el;
  };

  return { view, dialog: picker.dialog };
}
