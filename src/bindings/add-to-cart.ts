import { putInCart } from './bundle-selector';
import type { BindContext, Render } from './context';

const ONE_SHOT_PARAMS = ['reset', 'forcePackageId', 'debug', 'debugger'];

export function nextUrl(target: string, current: URL): string {
  const url = new URL(target, current);
  current.searchParams.forEach((value, key) => {
    if (!ONE_SHOT_PARAMS.includes(key) && !url.searchParams.has(key)) url.searchParams.set(key, value);
  });
  return url.toString();
}

export function bindAddToCart(root: ParentNode, b: BindContext, navigate: (url: string) => void): Render[] {
  b.each(root, 'data-next-action', (el) => {
    if (el.getAttribute('data-next-action') !== 'add-to-cart') return;
    el.addEventListener('click', (e) => {
      e.preventDefault();
      if (el.getAttribute('aria-busy') === 'true') return;
      const selectorId = el.getAttribute('data-next-selector-id');
      const packageId = Number(el.getAttribute('data-next-package-id'));
      const pick = selectorId ? b.selected(selectorId) : undefined;
      if (selectorId && !pick) return b.warn(`add-to-cart: selector "${selectorId}" has no selected card`);
      if (!pick && !packageId) return b.warn('add-to-cart needs data-next-package-id or data-next-selector-id');

      if (el.getAttribute('data-next-clear-cart') === 'true') void b.engine.clear();
      if (pick) putInCart(b, pick);
      else void b.engine.addItem(packageId, Number(el.getAttribute('data-next-quantity') || 1));

      const url = el.getAttribute('data-next-url');
      if (!url) return;
      el.setAttribute('aria-busy', 'true');
      el.classList.add('next-loading');
      navigate(nextUrl(url, new URL(location.href)));
    });
  });
  return [];
}
