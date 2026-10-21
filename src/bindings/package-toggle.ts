import { toggleGroup } from '../engine/values';
import { type BindContext, type Render } from './context';
import { isFormControl, setState } from './dom';

export function bindPackageToggles(root: ParentNode, b: BindContext): Render[] {
  const renders: Render[] = [];
  const { engine } = b;

  b.each(root, 'data-next-toggle-card', (el) => {
    const packageId = Number(el.getAttribute('data-next-package-id'));
    if (!packageId) return b.warn('data-next-toggle-card without data-next-package-id');
    const group = toggleGroup(packageId);
    const container = el.closest('[data-next-toggle-container]');
    const baseQty = Number(el.getAttribute('data-next-quantity') || 1);
    const ids = (attr: string) => (el.getAttribute(attr) ?? '').split(',').map(Number).filter(Boolean);
    const sync = ids('data-next-package-sync');
    const products = ids('data-next-product-sync');
    const synced = (packageId: number) =>
      sync.includes(packageId) || products.includes(engine.getPackage(packageId)?.product_id ?? 0);

    const quantity = (): number => {
      if (!sync.length && !products.length) return baseQty;
      let qty = 0;
      for (const [id, g] of Object.entries(engine.getState().cart.groups)) {
        if (id !== group) for (const l of g.lines) if (synced(l.packageId)) qty += l.quantity;
      }
      return qty;
    };
    const isUpsell = el.getAttribute('data-next-is-upsell') === 'true';
    const add = () =>
      engine.cart.setGroup(group, {
        lines: [{ packageId, quantity: quantity(), ...(isUpsell && { isUpsell }) }],
        vouchers: [],
      });
    const isOn = () => engine.cart.lines().some((l) => l.package_id === packageId);

    let preselected =
      el.getAttribute('data-next-selected') === 'true' && !engine.getState().cart.dismissed.includes(group);
    const addPreselected = () => {
      if (!preselected || isOn() || quantity() <= 0) return;
      preselected = false;
      void add();
    };
    addPreselected();

    el.addEventListener('click', (e) => {
      if (isFormControl(e.target)) return;
      if (!isOn()) void add();
      else if (engine.getState().cart.groups[group]) void engine.cart.setGroup(group, null, { dismiss: true });
      else void engine.cart.removeItem(packageId);
    });

    if (sync.length || products.length) {
      engine.on('cart.updated', () => {
        addPreselected();
        const current = engine.getState().cart.groups[group]?.lines[0]?.quantity;
        if (current !== undefined && current !== quantity()) void add();
      });
    }

    const image = el.querySelector<HTMLImageElement>('img[data-next-toggle-image]');
    renders.push(() => {
      const on = isOn();
      setState(el, on);
      el.classList.toggle('os--active', on);
      el.setAttribute('data-in-cart', String(on));
      el.setAttribute('data-next-in-cart', String(on));
      if (container) setState(container, on);
      const pkg = engine.getPackage(packageId);
      if (image && pkg?.image && image.getAttribute('src') !== pkg.image) {
        image.src = pkg.image;
        if (!image.alt) image.alt = pkg.name;
      }
    });
  });

  return renders;
}
