import type { Engine } from '../../engine/engine';
import type { Package } from '../../engine/types';
import { icon } from './icons';
import { quantities } from '../state';
import { badge, button, h, modal, plural, priceText, stepper, tab, tablist } from './view';

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

const kbd = (key: string) => h('kbd', 'kbd', key);

function pickerDialog(
  search: HTMLInputElement,
  filters: HTMLElement,
  list: HTMLElement,
  summary: HTMLElement,
  clear: HTMLElement,
) {
  const dialog = modal(
    'picker',
    'lg',
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
  );
  return dialog;
}

/** One package: its picture, name and badges, price, and a quantity stepper once it is in the cart. */
function pickerRow(engine: Engine, p: Package, n: number, active: boolean, set: (p: Package, n: number) => void) {
  const retail =
    Number(p.price_retail_total) > Number(p.price_total) && h('s', {}, priceText(engine, p.price_retail_total));
  return h(
    'div',
    { className: `prow${n ? ' on' : ''}${active ? ' active' : ''}`, role: 'option', ariaSelected: String(active) },
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
    n ? stepper(n, (to) => () => set(p, to)) : button('Add', () => set(p, 1), { variant: 'outline', size: 'sm' }),
  );
}

/** What the cart holds: its packages and units, and its subtotal once priced. */
function pickerSummary(engine: Engine) {
  const cart = engine.cart.current();
  const subtotal = cart.lines.length ? cart.subtotal : 0;
  return [
    `${plural(cart.lines.length, 'package')} · ${plural(cart.quantity, 'unit')} · `,
    subtotal === undefined ? 'pricing…' : h('b', {}, priceText(engine, subtotal)),
    subtotal === undefined ? '' : ' before discounts',
  ];
}

/** The packages the search and the filter keep. */
const shownPackages = (engine: Engine, filter: Filter, query: string) => {
  const inCart = quantities(engine.cart.lines());
  return (engine.getState().campaign?.packages ?? []).filter(
    (p) =>
      matches(p, query) &&
      (filter === 'purchasable'
        ? purchasable(p)
        : filter === 'recurring'
          ? p.is_recurring
          : filter === 'selected'
            ? inCart.has(p.ref_id)
            : true),
  );
};

const listNotes = (count: number) => [
  ...(count ? [] : [h('p', 'pempty', 'No package matches. Try another filter.')]),
  ...(count > SHOWN ? [h('p', 'pempty', `Showing ${SHOWN} of ${count}. Type to narrow the list.`)] : []),
];

export function productPicker(engine: Engine) {
  let filter: Filter = 'purchasable';
  let active = 0;
  const search = h('input', { type: 'search', className: 'input' });
  const filters = tablist({ size: 'sm' }, 'Filter packages');
  const list = h('div', { className: 'plist scrollbar-sm', role: 'listbox' });
  const summary = h('span', 'psum');
  const clear = button('Clear', () => void engine.cart.clear(), { variant: 'ghost' });
  const dialog = pickerDialog(search, filters, list, summary, clear);

  const shown = () => shownPackages(engine, filter, search.value);
  const set = (p: Package, n: number) => void engine.cart.setQuantity(p.ref_id, n);
  const pickFilter = (value: Filter) => () => {
    filter = value;
    active = 0;
    fill();
  };

  const fill = () => {
    if (!dialog.open) return;
    const inCart = quantities(engine.cart.lines());
    const rows = shown();
    active = Math.min(active, Math.max(0, rows.length - 1));
    search.placeholder = `Search ${engine.getState().campaign?.packages.length ?? 0} packages by name, ref_id or SKU`;
    filters.replaceChildren(
      ...FILTERS.map(([value, label]) =>
        tab(
          value === filter,
          pickFilter(value),
          value === 'selected' && inCart.size ? `${label} (${inCart.size})` : label,
        ),
      ),
    );
    list.replaceChildren(
      ...rows.slice(0, SHOWN).map((p, i) => {
        const row = pickerRow(engine, p, inCart.get(p.ref_id) ?? 0, i === active, set);
        row.onmouseenter = () => {
          active = i;
          list.querySelector('.active')?.classList.remove('active');
          row.classList.add('active');
        };
        return row;
      }),
      ...listNotes(rows.length),
    );
    summary.replaceChildren(...pickerSummary(engine));
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
  const stop = engine.subscribe(fill);

  return {
    dialog,
    open() {
      search.value = '';
      active = 0;
      dialog.showModal();
      fill();
      search.focus();
    },
    stop,
  };
}
