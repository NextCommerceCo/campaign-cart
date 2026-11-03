import type { Engine } from '../engine/engine';
import { format } from '../engine/format';
import type { Package } from '../engine/types';
import { icon } from './icons';
import { badge, h, tsugi } from './view';

export const avatar = (image: string | undefined, count?: number) =>
  tsugi(
    h(
      'span',
      'avatar',
      image ? h('img', { src: image, alt: '' }) : h('span', {}, icon('cart')),
      count !== undefined && h('span', 'avatar-count', String(count)),
    ),
    { size: 'lg' },
  );

export function productPicker(engine: Engine, ui: { render: () => void }) {
  const picked = new Set<number>();
  const search = h('input', { type: 'search', className: 'input', placeholder: 'Search packages' });
  search.setAttribute('aria-label', 'Search packages');
  const list = h('ul', 'plist scrollbar-sm');
  const add = h('button', { type: 'button', className: 'btn' }, 'Add to cart');
  const close = tsugi(h('button', { type: 'button', className: 'btn', onclick: () => dialog.close() }, icon('close')), {
    variant: 'ghost',
    size: 'icon-sm',
  });
  close.setAttribute('aria-label', 'Close dialog');
  const title = h('p', {});
  const dialog = tsugi(
    h(
      'dialog',
      'dialog picker',
      h(
        'div',
        {},
        h('header', {}, h('h2', {}, 'Add products'), title),
        h('section', {}, search, list),
        h(
          'footer',
          {},
          tsugi(h('button', { type: 'button', className: 'btn', onclick: () => dialog.close() }, 'Close'), {
            variant: 'outline',
          }),
          add,
        ),
        close,
      ),
    ),
    { size: 'lg' },
  );
  dialog.addEventListener('click', (e) => e.target === dialog && dialog.close());

  const money = (p: Package) => {
    const { campaign } = engine.getState();
    return format({ type: 'money', value: Number(p.price_total) }, campaign?.currency, campaign?.language);
  };
  const words = (p: Package) =>
    [
      p.name,
      p.product_name,
      p.product_sku,
      `#${p.ref_id}`,
      ...(p.product_variant_attribute_values ?? []).map((a) => a.value),
    ]
      .join(' ')
      .toLowerCase();

  const refresh = () => {
    add.disabled = !picked.size;
    add.textContent = picked.size ? `Add ${picked.size} to cart` : 'Add to cart';
  };

  const fill = () => {
    const packages = engine.getState().campaign?.packages ?? [];
    const inCart = new Map(engine.cart.lines().map((l) => [l.package_id, l.quantity]));
    const query = search.value.trim().toLowerCase();
    const shown = packages.filter((p) => words(p).includes(query));
    const products = new Map<string, Package[]>();
    for (const p of shown) {
      const key = p.product_id ? `product ${p.product_id}` : `package ${p.ref_id}`;
      products.set(key, [...(products.get(key) ?? []), p]);
    }
    const box = (ids: number[]) => {
      const input = h('input', { type: 'checkbox', className: 'input' });
      const ticked = ids.filter((id) => picked.has(id)).length;
      input.checked = ticked === ids.length;
      input.indeterminate = ticked > 0 && ticked < ids.length;
      input.onchange = () => {
        for (const id of ids) input.checked ? picked.add(id) : picked.delete(id);
        fill();
      };
      return input;
    };
    const row = (p: Package, own: boolean) =>
      h(
        'li',
        {},
        h(
          'label',
          own ? '' : 'pvariant',
          own && avatar(p.image),
          h(
            'span',
            'pname',
            h(
              'span',
              {},
              p.name,
              p.product_purchase_availability === 'unavailable' && badge('Unavailable', 'outline'),
              inCart.has(p.ref_id) && badge(`In cart ×${inCart.get(p.ref_id)}`, 'secondary'),
            ),
            h(
              'small',
              {},
              [`#${p.ref_id}`, ...(p.product_variant_attribute_values ?? []).map((a) => a.value)].join(' · '),
            ),
          ),
          h('span', 'pprice', money(p)),
          box([p.ref_id]),
        ),
      );
    list.replaceChildren(
      ...[...products.values()].flatMap((group) =>
        group.length === 1
          ? [row(group[0]!, true)]
          : [
              h(
                'li',
                {},
                h(
                  'label',
                  {},
                  avatar(group[0]!.image),
                  h('span', 'pname', h('span', {}, group[0]!.product_name ?? group[0]!.name)),
                  box(group.map((p) => p.ref_id)),
                ),
              ),
              ...group.map((p) => row(p, false)),
            ],
      ),
      ...(shown.length ? [] : [h('li', 'pempty', 'No packages match.')]),
    );
    title.textContent = `${engine.getState().campaign?.name ?? 'Campaign'} · ${packages.length} packages`;
    refresh();
  };

  search.oninput = fill;
  add.onclick = () => {
    const ids = [...picked];
    picked.clear();
    dialog.close();
    void Promise.all(ids.map((id) => engine.cart.addItem(id))).then(ui.render);
  };

  return {
    dialog,
    open() {
      search.value = '';
      fill();
      dialog.showModal();
    },
  };
}
