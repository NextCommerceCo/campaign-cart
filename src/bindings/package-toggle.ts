import { toggleGroup } from '../engine/values';
import { type BindContext, isFormControl, type Render, setState } from './context';

export function bindPackageToggles(root: ParentNode, b: BindContext): Render[] {
  const renders: Render[] = [];
  const { engine } = b;

  b.each(root, 'data-next-toggle-card', (el) => {
    const packageId = Number(el.getAttribute('data-next-package-id'));
    if (!packageId) return b.warn('data-next-toggle-card without data-next-package-id');
    const group = toggleGroup(packageId);
    const container = el.closest('[data-next-toggle-container]');
    const baseQty = Number(el.getAttribute('data-next-quantity') || 1);
    const sync = (el.getAttribute('data-next-package-sync') ?? '').split(',').map(Number).filter(Boolean);

    const quantity = (): number => {
      if (!sync.length) return baseQty;
      let qty = 0;
      for (const [id, g] of Object.entries(engine.getState().cart.groups)) {
        if (id !== group) for (const l of g.lines) if (sync.includes(l.packageId)) qty += l.quantity;
      }
      return qty;
    };
    const add = () => engine.setGroup(group, { lines: [{ packageId, quantity: quantity() }], vouchers: [] });
    const isOn = () => engine.lines().some((l) => l.package_id === packageId);

    const { cart } = engine.getState();
    if (el.getAttribute('data-next-selected') === 'true' && !isOn() && !cart.dismissed.includes(group)) void add();

    el.addEventListener('click', (e) => {
      if (isFormControl(e.target)) return;
      if (!isOn()) void add();
      else if (engine.getState().cart.groups[group]) void engine.setGroup(group, null, { dismiss: true });
      else void engine.removeItem(packageId);
    });

    if (sync.length) {
      engine.on('cart.updated', () => {
        const current = engine.getState().cart.groups[group]?.lines[0]?.quantity;
        if (current !== undefined && current !== quantity()) void add();
      });
    }

    renders.push(() => {
      setState(el, isOn());
      if (container) setState(container, isOn());
    });
  });

  return renders;
}
