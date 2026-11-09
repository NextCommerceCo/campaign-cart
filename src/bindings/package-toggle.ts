import type { Engine } from '../engine/engine';
import { toggleGroup } from '../engine/cart/toggles';
import type { Package } from '../engine/types';
import { markedSelected, ownProperties, pageProperties, setState } from './cards';
import { type BindContext, type Render } from './context';
import { bindToggle } from './dom';

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
  const isOn = () => !!engine.cart.line(packageId);
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
  const resync = bindToggle(
    b,
    el,
    packageId,
    quantity,
    add,
    [...el.querySelectorAll('[data-next-property]'), ...document.querySelectorAll('[data-next-default-property]')],
    isOn,
    markedSelected(el),
  );

  if (sync.length || products.length) b.offs.push(engine.on('cart.updated', resync));

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
