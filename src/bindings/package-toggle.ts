import { type BindContext, type Render } from './context';

export const toggleGroup = (packageId: number) => `toggle:${packageId}`;

export function bindPackageToggles(root: ParentNode, b: BindContext): Render[] {
  const renders: Render[] = [];
  const { engine } = b;

  root.querySelectorAll('[data-next-toggle-card]').forEach((el) => {
    const packageId = Number(el.getAttribute('data-next-package-id'));
    if (!packageId) return b.warn('data-next-toggle-card without data-next-package-id');
    const group = toggleGroup(packageId);
    const baseQty = Number(el.getAttribute('data-next-quantity') || 1);
    const sync = (el.getAttribute('data-next-package-sync') ?? '')
      .split(',')
      .map(Number)
      .filter(Boolean);

    const wantedQty = (): number => {
      if (!sync.length) return baseQty;
      let qty = 0;
      for (const [id, g] of Object.entries(engine.getState().cart.groups)) {
        if (id === group) continue;
        for (const l of g.lines) if (sync.includes(l.packageId)) qty += l.quantity;
      }
      return qty;
    };

    const add = () => engine.setGroup(group, { lines: [{ packageId, quantity: wantedQty() }], vouchers: [] });

    const { cart } = engine.getState();
    if (el.getAttribute('data-next-selected') === 'true' && !cart.groups[group] && !cart.dismissed.includes(group)) {
      void add();
    }

    el.addEventListener('click', (e) => {
      if ((e.target as Element).closest('a')) return;
      if (engine.getState().cart.groups[group]) void engine.setGroup(group, null, { dismiss: true });
      else void add();
    });

    if (sync.length) {
      engine.on('cart.updated', () => {
        const current = engine.getState().cart.groups[group]?.lines[0]?.quantity;
        if (current !== undefined && current !== wantedQty()) void add();
      });
    }

    renders.push(() => {
      const on = !!engine.getState().cart.groups[group];
      el.classList.toggle('next-selected', on);
      el.setAttribute('data-next-active', String(on));
      el.setAttribute('aria-pressed', String(on));
      el.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((box) => (box.checked = on));
    });
  });

  return renders;
}
