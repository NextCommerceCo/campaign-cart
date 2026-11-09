import { bundleGroup, cardSlots } from '../../engine/cart/selectors';
import { variantChoices } from '../../engine/cart/variants';
import type { Line, SummaryDiscount, SummaryLine } from '../../engine/cart/types';
import type { Engine } from '../../engine/engine';
import type { Package } from '../../engine/types';
import { icon } from '../ui/icons';
import { thumb } from '../ui/picker';
import { badge, h, iconButton, type Row, rows, stepper } from '../ui/view';

export type Money = (amount: string | number | undefined) => string;

/** What the parts of the cart view share. */
export interface Cart {
  engine: Engine;
  ui: { open: Set<string>; render: () => void; showState: () => void };
  money: Money;
  /** Runs a cart action, then paints again; `done` sees its result first. */
  act: (work: Promise<unknown>, done?: (result: unknown) => void) => void;
  coupon: HTMLInputElement;
  apply: () => void;
  openPicker: () => void;
  message?: { text: string; tone: 'green' | 'amber' };
}

const BUNDLE = bundleGroup('');

const source = (group: string) =>
  group === 'items'
    ? 'added'
    : group.startsWith(BUNDLE)
      ? `bundle ${group.slice(BUNDLE.length)}`
      : group.startsWith('toggle:')
        ? 'toggle'
        : group;

export function swapPackage(engine: Engine, from: number, to: number): Promise<void> {
  const swaps = Object.entries(engine.getState().cart.groups).flatMap(([groupId, group]) => {
    if (!group.lines.some((l) => l.packageId === from)) return [];
    const selectorId = groupId.startsWith(BUNDLE) ? groupId.slice(BUNDLE.length) : '';
    const selector = selectorId ? engine.selectors.get(selectorId) : undefined;
    const card = selector && engine.selectors.picked(selectorId);
    const slots =
      selector && card ? cardSlots(selector, card).flatMap((s, i) => (s.packageId === from ? [i] : [])) : [];
    if (!slots.length) {
      const lines = group.lines.map((l) => (l.packageId === from ? { ...l, packageId: to } : l));
      return [engine.cart.setGroup(groupId, { ...group, lines })];
    }
    const written = Promise.all(slots.map((i) => engine.selectors.setSlot(selectorId, card!.id, i, { packageId: to })));
    return [selector!.mode === 'swap' ? written : written.then(() => engine.selectors.addToCart(selectorId))];
  });
  return Promise.all(swaps).then(() => undefined);
}

export const lower = (before: string | undefined, now: string | undefined) =>
  before && now && Number(before) > Number(now) ? before : undefined;

export const discountName = (d: SummaryDiscount) => d.name || `Offer #${d.offer_id}`;

function linePrice(money: Money, priced: SummaryLine | undefined, p: Package | undefined, count: number) {
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
}

function variantField(c: Cart, packageId: number, choice: ReturnType<typeof variantChoices>[number]) {
  const { code, name, value, options } = choice;
  const id = `variant-${packageId}-${code}`;
  const select = h(
    'select',
    { id, className: 'select' },
    ...options.map((o) => h('option', { value: o.value, disabled: !o.packageId }, o.value)),
  );
  select.value = value ?? '';
  select.onchange = () => {
    const to = options.find((o) => o.value === select.value)?.packageId;
    if (to) c.act(swapPackage(c.engine, packageId, to));
  };
  return h('div', 'cfield', h('label', { htmlFor: id }, name), select);
}

function lineDetails(c: Cart, packageId: number, priced: SummaryLine | undefined, from: string[], codes: Set<string>) {
  const { money } = c;
  const p = c.engine.getPackage(packageId);
  const variants = variantChoices(c.engine.getState().campaign?.packages ?? [], packageId);
  const recurring = (priced?.is_recurring ?? p?.is_recurring) && (priced?.price_recurring ?? p?.price_recurring);
  const every =
    p?.interval_count && p.interval_count > 1 ? `${p.interval_count} ${p.interval}s` : (p?.interval ?? 'month');
  const discounts = (priced?.discounts ?? []).map((d): Row => [
    codes.has(d.name ?? '') ? `Code ${d.name}` : discountName(d),
    `−${money(d.amount)}`,
    'green',
  ]);
  return h(
    'div',
    'cmore',
    variants.length > 0 && h('div', 'cvars', ...variants.map((v) => variantField(c, packageId, v))),
    rows('', [
      ['Package', `#${packageId}${p?.product_sku ? ` · SKU ${p.product_sku}` : ''}`],
      ['From', from.join(', ')],
      ['Price', priced ? `${priced.quantity} × ${money(priced.package_price)}` : 'not priced yet'],
      ...discounts,
      ...(recurring ? [['Then', `${money(recurring)} every ${every}`] as Row] : []),
    ]),
  );
}

export function cartLine(c: Cart, line: Line, priced: SummaryLine | undefined, codes: Set<string>) {
  const { package_id: packageId, quantity: count } = line;
  const p = c.engine.getPackage(packageId);
  const from = Object.entries(c.engine.getState().cart.groups)
    .filter(([, g]) => g.lines.some((l) => l.packageId === packageId))
    .map(([id]) => source(id));
  const key = `line-${packageId}`;
  const open = c.ui.open.has(key);
  const name = p?.name ?? `Package ${packageId}`;
  const set = (n: number) => () => c.act(c.engine.cart.setQuantity(packageId, n));
  const toggle = h(
    'button',
    {
      type: 'button',
      className: 'cname',
      ariaExpanded: String(open),
      onclick: () => {
        if (open) c.ui.open.delete(key);
        else c.ui.open.add(key);
        c.ui.render();
      },
    },
    h('span', {}, name),
    icon('chevron'),
  );
  const values = (p?.product_variant_attribute_values ?? []).map((a) => a.value).join(' / ');
  const info = h(
    'small',
    {},
    h('span', 'devonly', `#${packageId} · `),
    values || h('span', 'devonly', p?.product_sku || 'no SKU'),
    !(from.length === 1 && from[0] === 'added') && h('span', 'devonly', ...from.map((f) => badge(f, 'outline'))),
  );
  return h(
    'div',
    open ? 'cline open' : 'cline',
    h('div', 'cpkg', thumb(p?.image), h('div', 'cinfo', toggle, info)),
    stepper(count, set),
    linePrice(c.money, priced, p, count),
    iconButton('close', `Remove ${name}`, set(0)),
    open && lineDetails(c, packageId, priced, from, codes),
  );
}
