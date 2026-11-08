import type { Engine } from '../engine/engine';
import type { Package } from '../engine/types';
import { icon } from './icons';
import { quantities } from './state';
import { badge, button, h, iconButton, plural, priceText, tab, tablist, tsugi } from './view';

type Filter = 'all' | 'purchasable' | 'recurring' | 'selected';

const FILTERS: Array<[Filter, string]> = [
  ['all', 'All'],
  ['purchasable', 'Purchasable'],
  ['recurring', 'Recurring'],
  ['selected', 'Selected'],
];
const SHOWN = 200;

export const thumb = (image: string | undefined) =>
  h('span', 'pthumb', image ? h('img', { src: image, alt: '', loading: 'lazy' }) : icon('cart'));

const purchasable = (p: Package) =>
  !/unavail|out_of_stock|out-of-stock|sold/i.test(p.product_purchase_availability ?? '');

export const matches = (p: Package, query: string) => {
  const words = `${p.name} ${p.product_name ?? ''} ${p.product_sku ?? ''} ${p.ref_id}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => (/^#\d+$/.test(term) ? `#${p.ref_id}` === term : words.includes(term)));
};

export function productPicker(engine: Engine) {
  let filter: Filter = 'purchasable';
  let active = 0;
  const search = h('input', { type: 'search', className: 'input' });
  const filters = tablist({ size: 'sm' }, 'Filter packages');
  const list = h('div', 'plist scrollbar-sm');
  list.setAttribute('role', 'listbox');
  const summary = h('span', 'psum');
  const clear = button('Clear', () => void engine.cart.clear(), { variant: 'ghost' });
  const close = iconButton('close', 'Close dialog', () => dialog.close(), 'icon-sm');
  const kbd = (key: string) => h('kbd', 'kbd', key);
  const dialog = tsugi(
    h(
      'dialog',
      'dialog picker',
      h(
        'div',
        {},
        h(
          'header',
          {},
          h('h2', {}, 'Add packages to the cart'),
          h('p', {}, 'Search the whole catalog and set quantities. Totals recalculate as you go.'),
        ),
        h('section', {}, h('div', 'ptools', search, h('div', 'tabs', filters)), list),
        h(
          'footer',
          {},
          h('p', 'pfoot', summary, h('span', 'phint', kbd('↑'), kbd('↓'), ' move · ', kbd('Enter'), ' add')),
          clear,
          button('Done', () => dialog.close()),
        ),
        close,
      ),
    ),
    { size: 'lg' },
  );
  dialog.addEventListener('click', (e) => e.target === dialog && dialog.close());

  const shown = () => {
    const inCart = quantities(engine.cart.lines());
    return (engine.getState().campaign?.packages ?? []).filter(
      (p) =>
        matches(p, search.value) &&
        (filter === 'purchasable'
          ? purchasable(p)
          : filter === 'recurring'
            ? p.is_recurring
            : filter === 'selected'
              ? inCart.has(p.ref_id)
              : true),
    );
  };
  const set = (p: Package, n: number) => void engine.cart.setQuantity(p.ref_id, n);

  const fill = () => {
    if (!dialog.open) return;
    const packages = engine.getState().campaign?.packages ?? [];
    const inCart = quantities(engine.cart.lines());
    const rows = shown();
    active = Math.min(active, Math.max(0, rows.length - 1));
    search.placeholder = `Search ${packages.length} packages by name, ref_id or SKU`;
    filters.replaceChildren(
      ...FILTERS.map(([value, label]) =>
        tab(
          value === filter,
          () => {
            filter = value;
            active = 0;
            fill();
          },
          value === 'selected' && inCart.size ? `${label} (${inCart.size})` : label,
        ),
      ),
    );
    list.replaceChildren(
      ...rows.slice(0, SHOWN).map((p, i) => {
        const n = inCart.get(p.ref_id) ?? 0;
        const retail =
          Number(p.price_retail_total) > Number(p.price_total) && h('s', {}, priceText(engine, p.price_retail_total));
        const row = h(
          'div',
          `prow${n ? ' on' : ''}${i === active ? ' active' : ''}`,
          thumb(p.image),
          h(
            'span',
            'pinfo',
            h(
              'span',
              {},
              h('b', {}, p.name),
              p.is_recurring && badge('Recurring', 'outline'),
              !purchasable(p) && badge('Unavailable', 'destructive'),
            ),
            h('small', {}, `#${p.ref_id} · ${p.product_sku || 'no SKU'} · qty ${p.qty}`),
          ),
          h('span', 'pprice', priceText(engine, p.price_total), retail),
          n
            ? h(
                'span',
                'qty',
                h('button', { type: 'button', title: 'One less', onclick: () => set(p, n - 1) }, '−'),
                h('span', {}, String(n)),
                h('button', { type: 'button', title: 'One more', onclick: () => set(p, n + 1) }, '+'),
              )
            : button('Add', () => set(p, 1), { variant: 'outline', size: 'sm' }),
        );
        row.setAttribute('role', 'option');
        row.setAttribute('aria-selected', String(i === active));
        row.onmouseenter = () => {
          active = i;
          list.querySelector('.active')?.classList.remove('active');
          row.classList.add('active');
        };
        return row;
      }),
      ...(rows.length ? [] : [h('p', 'pempty', 'No package matches. Try another filter.')]),
      ...(rows.length > SHOWN
        ? [h('p', 'pempty', `Showing ${SHOWN} of ${rows.length}. Type to narrow the list.`)]
        : []),
    );
    const units = [...inCart.values()].reduce((a, b) => a + b, 0);
    const total = [...inCart].reduce(
      (sum, [id, q]) => sum + Number(packages.find((p) => p.ref_id === id)?.price_total ?? 0) * q,
      0,
    );
    summary.replaceChildren(
      `${plural(inCart.size, 'package')} · ${plural(units, 'unit')} · `,
      h('b', {}, priceText(engine, total)),
      ' before discounts',
    );
    clear.hidden = !inCart.size;
  };

  search.oninput = () => {
    active = 0;
    fill();
  };
  dialog.addEventListener('keydown', (e) => {
    const rows = shown().slice(0, SHOWN);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      active = Math.max(0, Math.min(rows.length - 1, active + (e.key === 'ArrowDown' ? 1 : -1)));
      fill();
      list.querySelector('.active')?.scrollIntoView?.({ block: 'nearest' });
    } else if (e.key === 'Enter' && e.target === search && rows[active]) {
      e.preventDefault();
      set(rows[active]!, (quantities(engine.cart.lines()).get(rows[active]!.ref_id) ?? 0) + 1);
    }
  });
  engine.subscribe(fill);

  return {
    dialog,
    open() {
      search.value = '';
      active = 0;
      dialog.showModal();
      fill();
      search.focus();
    },
  };
}
