import type { Engine } from '../engine/engine';
import { toggleGroup } from '../engine/cart/toggles';
import type { Package } from '../engine/types';
import { type BindContext, type Render } from './context';
import { isFormControl, onceVisible, ownProperties, pageProperties, setState } from './dom';

const ids = (el: Element, attr: string) => (el.getAttribute(attr) ?? '').split(',').map(Number).filter(Boolean);

function syncedQuantity(engine: Engine, group: string, sync: number[], products: number[]): number {
  const synced = (packageId: number) =>
    sync.includes(packageId) || products.includes(engine.getPackage(packageId)?.product_id ?? 0);
  let qty = 0;
  for (const [id, g] of Object.entries(engine.getState().cart.groups)) {
    if (id !== group)
      for (const l of g.lines) if (synced(l.packageId)) qty += l.quantity * (engine.getPackage(l.packageId)?.qty ?? 1);
  }
  return qty;
}

function showToggleState(el: HTMLElement, container: Element | null, on: boolean): void {
  setState(el, on);
  el.classList.toggle('os--active', on);
  el.setAttribute('data-in-cart', String(on));
  el.setAttribute('data-next-in-cart', String(on));
  if (container) setState(container, on);
}

function showToggleImage(image: HTMLImageElement | null, pkg: Package | undefined): void {
  if (image && pkg?.image && image.getAttribute('src') !== pkg.image) {
    image.src = pkg.image;
    if (!image.alt) image.alt = pkg.name;
  }
}

function bindToggleCard(b: BindContext, el: HTMLElement): Render | undefined {
  const { engine } = b;
  const packageId = Number(el.getAttribute('data-next-package-id'));
  if (!packageId) {
    b.warn('data-next-toggle-card without data-next-package-id');
    return undefined;
  }
  const group = toggleGroup(packageId);
  const container = el.closest('[data-next-toggle-container]');
  const baseQty = Number(el.getAttribute('data-next-quantity') || 1);
  const sync = ids(el, 'data-next-package-sync');
  const products = ids(el, 'data-next-product-sync');
  const quantity = (): number =>
    sync.length || products.length ? syncedQuantity(engine, group, sync, products) : baseQty;
  const isUpsell = el.getAttribute('data-next-is-upsell') === 'true';
  const add = () => {
    const properties = { ...pageProperties(el), ...ownProperties(el) };
    return engine.cart.setGroup(group, {
      lines: [
        {
          packageId,
          quantity: quantity(),
          ...(isUpsell && { isUpsell }),
          ...(Object.keys(properties).length && { properties }),
        },
      ],
      vouchers: [],
    });
  };
  const isOn = () => engine.cart.lines().some((l) => l.package_id === packageId);

  let preselected =
    el.getAttribute('data-next-selected') === 'true' && !engine.getState().cart.dismissed.includes(group);
  const addPreselected = () => {
    if (!preselected || isOn() || quantity() <= 0) return;
    preselected = false;
    void add();
  };
  addPreselected();
  onceVisible(el, () => engine.toggles.view(packageId, quantity() || 1));

  const inputs = [
    ...el.querySelectorAll('[data-next-property]'),
    ...document.querySelectorAll('[data-next-default-property]'),
  ];
  for (const input of inputs)
    input.addEventListener('change', () => engine.getState().cart.groups[group] && void add());

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
  return () => {
    engine.toggles.price(packageId, quantity() || 1);
    showToggleState(el, container, isOn());
    showToggleImage(image, engine.getPackage(packageId));
  };
}

export function bindPackageToggles(root: ParentNode, b: BindContext): Render[] {
  const renders: Render[] = [];
  b.each(root, 'data-next-toggle-card', (el) => {
    const render = bindToggleCard(b, el);
    if (render) renders.push(render);
  });
  return renders;
}
