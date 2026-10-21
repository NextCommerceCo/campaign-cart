import type { BindContext, Render } from './context';

const packageIdOf = (el: Element) => {
  const holder = el.closest('[data-package-id], [data-next-package-id]');
  return Number(holder?.getAttribute('data-package-id') ?? holder?.getAttribute('data-next-package-id'));
};

export function bindCartControls(root: ParentNode, b: BindContext): Render[] {
  const { engine } = b;
  if (root === document && b.claim(document.documentElement, 'cart-controls')) {
    document.addEventListener('click', (e) => {
      const el = (e.target as Element).closest?.(
        '[data-next-quantity="increase"], [data-next-quantity="decrease"], [data-next-remove-item]',
      );
      if (!el) return;
      const packageId = packageIdOf(el);
      if (!packageId) return b.warn('quantity control without data-package-id');
      e.preventDefault();
      const current = engine.cart.lines().find((l) => l.package_id === packageId)?.quantity ?? 0;
      const step = Number(el.getAttribute('data-step') || 1);
      const min = Number(el.getAttribute('data-min') ?? 1);
      const max = Number(el.getAttribute('data-max') || Infinity);
      if (el.hasAttribute('data-next-remove-item')) void engine.cart.removeItem(packageId);
      else if (el.getAttribute('data-next-quantity') === 'increase')
        void engine.cart.setQuantity(packageId, Math.min(max, current + step));
      else void engine.cart.setQuantity(packageId, Math.max(min, current - step));
    });
  }

  b.each(root, 'data-next-coupon', (el) => {
    const input = el.querySelector('input') ?? (el instanceof HTMLInputElement ? el : null);
    const button = el.querySelector('button');
    if (!input) return b.warn('data-next-coupon needs an <input>');
    const apply = async () => {
      const code = input.value.trim();
      if (!code || button?.classList.contains('next-loading')) return;
      button?.classList.add('next-loading');
      const applied = await engine.cart.applyCoupon(code);
      button?.classList.remove('next-loading');
      if (applied && input.value.trim() === code) input.value = '';
      button?.classList.toggle('next-disabled', !input.value.trim());
    };
    button?.addEventListener('click', (e) => {
      e.preventDefault();
      void apply();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void apply();
      }
    });
    input.addEventListener('input', () => button?.classList.toggle('next-disabled', !input.value.trim()));
  });

  return [];
}
